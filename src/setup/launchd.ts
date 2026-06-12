/* launchd LaunchAgent generation and installation (macOS scheduler). */

import { chmod, copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { build as buildPlistXml } from "plist";
import { execFileAsync } from "../utils/exec.js";
import type { Schedule } from "./schedule.js";

/** launchd StartCalendarInterval dict: Hour + Minute, plus Weekday (weekly) or Day (monthly). */
export type CalendarInterval = Record<string, number>;

export function scheduleToCalendarInterval(schedule: Schedule): CalendarInterval {
  const time = { Hour: schedule.hour, Minute: schedule.minute };
  switch (schedule.frequency) {
    case "daily":
      return time;
    case "weekly":
      return { Weekday: schedule.weekday, ...time };
    case "monthly":
      return { Day: schedule.day, ...time };
  }
}

export type PlistOptions = {
  label: string;
  programArguments: string[];
  workingDir: string;
  calendarInterval: CalendarInterval;
  logPath: string;
  pathEnv: string;
};

/** Render a LaunchAgent plist XML document. `plist.build` handles escaping. */
export function buildPlist(opts: PlistOptions): string {
  return buildPlistXml({
    Label: opts.label,
    ProgramArguments: opts.programArguments,
    WorkingDirectory: opts.workingDir,
    EnvironmentVariables: { PATH: opts.pathEnv },
    StartCalendarInterval: opts.calendarInterval,
    StandardOutPath: opts.logPath,
    StandardErrorPath: opts.logPath,
  });
}

/**
 * Install a generated plist as a user LaunchAgent and (re)load it.
 * Returns the installed path under ~/Library/LaunchAgents.
 */
export async function installAgent(plistPath: string, label: string): Promise<string> {
  const dest = join(process.env.HOME ?? "", "Library", "LaunchAgents", `${label}.plist`);

  await mkdir(dirname(dest), { recursive: true });
  await copyFile(plistPath, dest);
  await chmod(dest, 0o600);

  /*
   * Unload first in case a previous version is already loaded; ignore failures
   * (it simply isn't loaded yet).
   */
  try {
    await execFileAsync("launchctl", ["unload", dest]);
  } catch {
    /* not loaded — fine */
  }
  await execFileAsync("launchctl", ["load", dest]);

  return dest;
}
