/*
 * Interval gating for scheduled backups.
 *
 * launchd fires on a calendar cadence (e.g. every Monday). To support "every N
 * weeks/days/months" we record the last backup as a dated folder under the
 * backup root and skip scheduled runs until `intervalDays` have elapsed.
 */

import { differenceInCalendarDays, isValid, max, parse } from "date-fns";
import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";

const DATE_DIR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Latest date among `YYYY-MM-DD` directory names, or null if there are none.
 * date-fns `parse` rejects overflow dates (e.g. 2026-13-99) as Invalid Date.
 */
export function parseLatestBackupDate(entries: string[]): Date | null {
  const dates = entries
    .filter((name) => DATE_DIR.test(name))
    .map((name) => parse(name, "yyyy-MM-dd", new Date()))
    .filter(isValid);
  return dates.length > 0 ? max(dates) : null;
}

/** Inspect the backup root's dated subfolders and return the most recent date. */
export async function findLastBackupDate(root: string): Promise<Date | null> {
  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    /* Root doesn't exist yet → no previous backup. */
    return null;
  }
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  return parseLatestBackupDate(names);
}

/**
 * True when a backup should run now. With no interval (<= 0) or no previous
 * backup, always due; otherwise due once `intervalDays` calendar days elapse.
 */
export function isBackupDue(lastBackup: Date | null, intervalDays: number, now: Date): boolean {
  if (intervalDays <= 0 || !lastBackup) {
    return true;
  }
  return differenceInCalendarDays(now, lastBackup) >= intervalDays;
}
