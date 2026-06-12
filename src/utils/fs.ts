/* Filesystem helpers for backup directory management. */

import { format } from "date-fns";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "path-exists";
import { getBackupRoot } from "../config.js";

/** Lowercase a vault name and replace non-alphanumeric characters with hyphens. */
export function sanitizeVaultName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Resolve and create the dated backup directory for a vault. If the directory
 * already exists, appends a HHmmss timestamp suffix.
 */
export async function getBackupDir(vaultName: string, dateStr: string): Promise<string> {
  const base = join(getBackupRoot(), dateStr, sanitizeVaultName(vaultName));
  const dir = (await pathExists(base)) ? `${base}-${format(new Date(), "HHmmss")}` : base;
  /* Backups hold plaintext secrets — keep their folders owner-only. */
  await mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}
