/*
 * Interactive setup wizard — the complete onboarding. Verifies the environment
 * (macOS, 1Password CLI — installing it via Homebrew if needed), collects and
 * live-verifies the settings, writes `.env`, installs the launchd agent, and
 * offers to run the first backup immediately.
 *
 * Run via: pnpm run setup
 */

import { confirm } from "@clack/prompts";
import chalk from "chalk";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathExists } from "path-exists";
import { main as runBackup } from "./backup.js";
import { LAUNCHD_LABEL, logFilePath } from "./constants.js";
import { writeEnvFile } from "./setup/env-file.js";
import { buildPlist, installAgent, scheduleToCalendarInterval } from "./setup/launchd.js";
import { assertMacos, ensureOpCli } from "./setup/preflight.js";
import { collectSetupInput } from "./setup/prompts.js";
import { describeSchedule, intervalToDays } from "./setup/schedule.js";
import * as log from "./utils/logger.js";
import { ask } from "./utils/prompt.js";

export async function main(): Promise<void> {
  log.start("🔐 GetReflect — Setup");

  assertMacos();
  await ensureOpCli();

  const { token, backupPath, schedule } = await collectSetupInput();
  const intervalDays = intervalToDays(schedule);

  const repoRoot = process.cwd();
  const envPath = join(repoRoot, ".env");
  if (await pathExists(envPath)) {
    const overwrite = await ask(
      confirm({
        message: ".env already exists. Overwrite it?",
        initialValue: false,
      }),
    );
    if (!overwrite) {
      log.end(chalk.yellow("✖ Setup cancelled — existing .env left untouched."));
      return;
    }
  }

  await log.run(
    "Writing .env...",
    () => writeEnvFile(envPath, { token, backupPath, intervalDays }),
    () => ({ msg: "Wrote .env", details: [`→ ${envPath}`, "permissions: owner-only (0600)"] }),
  );

  const logPath = logFilePath();
  const plistPath = join(repoRoot, "launchd", `${LAUNCHD_LABEL}.plist`);
  const plist = buildPlist({
    label: LAUNCHD_LABEL,
    nodePath: process.execPath,
    workingDir: repoRoot,
    scriptPath: join(repoRoot, "src", "index.ts"),
    envFile: ".env",
    calendarInterval: scheduleToCalendarInterval(schedule),
    logPath,
    pathEnv: `${dirname(process.execPath)}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
  });

  await log.run(
    "Generating launchd schedule...",
    async () => {
      await mkdir(dirname(plistPath), { recursive: true });
      await writeFile(plistPath, plist);
    },
    () => ({ msg: "Generated launchd plist", details: [`→ ${plistPath}`] }),
  );

  const installedPath = await log.run(
    "Installing scheduler...",
    () => installAgent(plistPath, LAUNCHD_LABEL),
    (dest) => ({
      msg: "Installed & loaded scheduler",
      details: [`→ ${dest}`, describeSchedule(schedule)],
    }),
  );

  log.step(
    "Setup complete",
    `Backups will be stored in: ${backupPath}`,
    `Schedule: ${describeSchedule(schedule)}`,
    `Installed agent: ${installedPath}`,
    "",
    "Check status:            pnpm run status",
    "Run a backup anytime:    pnpm run backup",
    `View logs:               tail -f ${logPath}`,
  );

  const runNow = await ask(confirm({ message: "Run your first backup now?", initialValue: true }));
  if (!runNow) {
    log.end(`${chalk.green("✔ Ready to go")} — ${log.timestamp()}`);
    return;
  }

  log.end(`${chalk.green("✔ Setup complete")} — starting your first backup`);

  /* The backup reads config from the environment; mirror what .env now holds. */
  process.env.OP_SERVICE_ACCOUNT_TOKEN = token;
  process.env.BACKUP_PATH = backupPath;
  process.env.BACKUP_INTERVAL_DAYS = String(intervalDays);
  await runBackup();
}

main().catch((err: unknown) => {
  /* Ctrl-C inside a prompt is handled by ask(); this catches real failures. */
  const message = err instanceof Error ? err.message : String(err);
  log.error(message);
  log.end(chalk.red("✖ Setup failed"));
  process.exit(1);
});
