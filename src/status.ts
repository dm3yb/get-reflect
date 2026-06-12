/*
 * Status command: read-only snapshot of the GetReflect installation —
 * scheduler state, backup root, last backup date, and gating interval.
 */

import chalk from "chalk";
import { format } from "date-fns";
import { pathExists } from "path-exists";
import { configFilePath, getBackupRoot, getIntervalDays } from "./config.js";
import { agentPlistPath, LAUNCHD_LABEL, logFilePath } from "./constants.js";
import { execFileAsync } from "./utils/exec.js";
import * as log from "./utils/logger.js";
import { findLastBackupDate } from "./utils/schedule-gate.js";

async function isAgentLoaded(): Promise<boolean> {
  try {
    await execFileAsync("launchctl", ["list", LAUNCHD_LABEL]);
    return true;
  } catch {
    return false;
  }
}

function describeAgent(installed: boolean, loaded: boolean): string {
  if (loaded) return chalk.green("loaded");
  if (installed) return chalk.yellow("installed but not loaded");
  return chalk.yellow("not installed");
}

export async function runStatus(): Promise<void> {
  log.start("🔐 GetReflect — Status");

  const installed = await pathExists(agentPlistPath());
  const loaded = installed && (await isAgentLoaded());
  log.step(
    "Scheduler",
    `Agent: ${describeAgent(installed, loaded)} (${LAUNCHD_LABEL})`,
    `Log: ${logFilePath()}`,
  );

  const root = getBackupRoot();
  const lastBackup = await findLastBackupDate(root);
  const intervalDays = getIntervalDays();
  log.step(
    "Backups",
    `Root: ${root}`,
    `Last backup: ${lastBackup ? format(lastBackup, "yyyy-MM-dd") : "never"}`,
    `Interval gating: ${intervalDays > 0 ? `every ${intervalDays} day(s)` : "none (runs on every scheduled fire)"}`,
  );

  if (!(await pathExists(configFilePath()))) {
    log.step(chalk.yellow("Not configured yet"), "Run: get-reflect setup");
  }

  log.end(`${chalk.green("✔ Status")} — ${log.timestamp()}`);
}
