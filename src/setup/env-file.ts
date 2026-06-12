/* Renders and writes the .env file produced by the setup wizard. */

import { chmod, writeFile } from "node:fs/promises";

export type EnvValues = {
  token: string;
  backupPath: string;
  /** Minimum days between scheduled runs; 0 means run every calendar cadence. */
  intervalDays: number;
};

export function renderEnvFile({ token, backupPath, intervalDays }: EnvValues): string {
  return [
    "# 1Password service account token (read-only access to your vaults)",
    `OP_SERVICE_ACCOUNT_TOKEN=${token}`,
    "",
    "# Backup destination directory",
    `BACKUP_PATH=${backupPath}`,
    "",
    "# Minimum days between scheduled runs (0 = every launchd cadence; e.g. 14 = every 2 weeks)",
    `BACKUP_INTERVAL_DAYS=${intervalDays}`,
    "",
  ].join("\n");
}

/**
 * Write `.env` owner-only (0600). It holds the service account token: `mode`
 * covers new files; `chmod` re-tightens an overwritten file (writeFile skips
 * mode on existing files).
 */
export async function writeEnvFile(envPath: string, values: EnvValues): Promise<void> {
  await writeFile(envPath, renderEnvFile(values), { mode: 0o600 });
  await chmod(envPath, 0o600);
}
