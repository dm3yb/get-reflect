/*
 * Uninstall command: unload the scheduled-backup agent and remove its plist.
 * `.env` and all backup files are left untouched.
 *
 * Run via: pnpm run uninstall
 */

import { confirm } from "@clack/prompts";
import chalk from "chalk";
import { rm } from "node:fs/promises";
import { pathExists } from "path-exists";
import { agentPlistPath } from "./constants.js";
import { execFileAsync } from "./utils/exec.js";
import * as log from "./utils/logger.js";
import { ask } from "./utils/prompt.js";

async function main(): Promise<void> {
  log.start("🔐 GetReflect — Uninstall");

  const plist = agentPlistPath();
  if (!(await pathExists(plist))) {
    log.end(`${chalk.green("✔ Nothing to uninstall")} — no scheduled agent is installed.`);
    return;
  }

  const proceed = await ask(
    confirm({
      message: "Remove the scheduled backup agent? (.env and existing backups are kept)",
      initialValue: false,
    }),
  );
  if (!proceed) {
    log.end(chalk.yellow("✖ Uninstall cancelled."));
    return;
  }

  /* Unload may fail when the agent isn't loaded — removing the plist is what matters. */
  try {
    await execFileAsync("launchctl", ["unload", plist]);
  } catch {
    /* not loaded — fine */
  }
  await rm(plist);

  log.step("Removed scheduled agent", `→ ${plist}`, ".env and backups were left untouched.");
  log.end(`${chalk.green("✔ Uninstalled")} — ${log.timestamp()}`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  log.error(message);
  log.end(chalk.red("✖ Uninstall failed"));
  process.exit(1);
});
