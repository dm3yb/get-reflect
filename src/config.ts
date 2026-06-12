/* Application configuration and environment validation. */

import { join } from "node:path";
import untildify from "untildify";

/** Default backup location: iCloud Drive → Documents/security/get-reflect-backups. */
export function defaultBackupRoot(): string {
  return join(
    process.env.HOME ?? "",
    "Library",
    "Mobile Documents",
    "com~apple~CloudDocs",
    "Documents",
    "security",
    "get-reflect-backups",
  );
}

/**
 * Backup root directory. Honors a `BACKUP_PATH` override (a leading `~` is
 * expanded to `$HOME`); falls back to {@link defaultBackupRoot} when unset.
 */
export function getBackupRoot(): string {
  const override = process.env.BACKUP_PATH?.trim();
  return override ? untildify(override) : defaultBackupRoot();
}

/**
 * Minimum number of days that must elapse between scheduled backups. Used to
 * implement "every N weeks/days/months" on top of launchd's calendar firing.
 * Returns 0 (no gating) when `BACKUP_INTERVAL_DAYS` is unset or not positive.
 */
export function getIntervalDays(): number {
  const days = Number(process.env.BACKUP_INTERVAL_DAYS);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/** Validate the required environment variables; throws when one is missing. */
export function loadConfig(): void {
  if (!process.env.HOME) {
    throw new Error("HOME environment variable is not set.");
  }
  if (!process.env.OP_SERVICE_ACCOUNT_TOKEN) {
    throw new Error("OP_SERVICE_ACCOUNT_TOKEN is not set. Add it to your .env file.");
  }
}
