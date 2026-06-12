/*
 * Interactive setup wizard — the complete onboarding. Verifies the environment
 * (macOS, 1Password CLI — installing it via Homebrew if needed), collects and
 * live-verifies the settings, writes the config file, installs the launchd
 * agent, and offers to run the first backup immediately.
 */

import { confirm } from "@clack/prompts";
import chalk from "chalk";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathExists } from "path-exists";
import { main as runBackup } from "./backup.js";
import { configDir, configFilePath } from "./config.js";
import { LAUNCHD_LABEL, logFilePath } from "./constants.js";
import { writeEnvFile } from "./setup/env-file.js";
import { buildPlist, installAgent, scheduleToCalendarInterval } from "./setup/launchd.js";
import { assertMacos, ensureOpCli } from "./setup/preflight.js";
import { collectSetupInput } from "./setup/prompts.js";
import { describeSchedule, intervalToDays } from "./setup/schedule.js";
import * as log from "./utils/logger.js";
import { ask } from "./utils/prompt.js";

/**
 * The scheduled agent re-invokes whatever entry is running right now: the
 * compiled `dist/cli.js` for installed copies, or the TypeScript sources via
 * tsx during development.
 */
function agentProgramArguments(): { programArguments: string[]; workingDir: string } {
  const entry = process.argv[1] ?? "";
  if (entry.endsWith(".ts")) {
    return {
      programArguments: [process.execPath, "--import", "tsx/esm", entry, "backup", "--scheduled"],
      workingDir: process.cwd(),
    };
  }
  return {
    programArguments: [process.execPath, entry, "backup", "--scheduled"],
    workingDir: process.env.HOME ?? "/",
  };
}

export async function runSetup(): Promise<void> {
  log.start("🔐 GetReflect — Setup");

  assertMacos();
  await ensureOpCli();

  const { token, backupPath, schedule } = await collectSetupInput();
  const intervalDays = intervalToDays(schedule);

  const configPath = configFilePath();
  if (await pathExists(configPath)) {
    const overwrite = await ask(
      confirm({
        message: "GetReflect is already configured. Overwrite the existing configuration?",
        initialValue: false,
      }),
    );
    if (!overwrite) {
      log.end(chalk.yellow("✖ Setup cancelled — existing configuration left untouched."));
      return;
    }
  }

  await log.run(
    "Writing configuration...",
    async () => {
      await mkdir(configDir(), { recursive: true, mode: 0o700 });
      await writeEnvFile(configPath, { token, backupPath, intervalDays });
    },
    () => ({
      msg: "Wrote configuration",
      details: [`→ ${configPath}`, "permissions: owner-only (0600)"],
    }),
  );

  const logPath = logFilePath();
  const plistPath = join(configDir(), `${LAUNCHD_LABEL}.plist`);
  const { programArguments, workingDir } = agentProgramArguments();
  const plist = buildPlist({
    label: LAUNCHD_LABEL,
    programArguments,
    workingDir,
    calendarInterval: scheduleToCalendarInterval(schedule),
    logPath,
    pathEnv: `${dirname(process.execPath)}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
  });

  await log.run(
    "Generating launchd schedule...",
    () => writeFile(plistPath, plist),
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
    "Check status:            get-reflect status",
    "Run a backup anytime:    get-reflect backup",
    `View logs:               tail -f ${logPath}`,
  );

  const runNow = await ask(confirm({ message: "Run your first backup now?", initialValue: true }));
  if (!runNow) {
    log.end(`${chalk.green("✔ Ready to go")} — ${log.timestamp()}`);
    return;
  }

  log.end(`${chalk.green("✔ Setup complete")} — starting your first backup`);

  /* The backup reads config from the environment; mirror what the config file now holds. */
  process.env.OP_SERVICE_ACCOUNT_TOKEN = token;
  process.env.BACKUP_PATH = backupPath;
  process.env.BACKUP_INTERVAL_DAYS = String(intervalDays);
  await runBackup();
}
