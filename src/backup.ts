import chalk from "chalk";
import { format } from "date-fns";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import pLimit from "p-limit";
import { getBackupRoot, getIntervalDays, loadConfig } from "./config.js";
import { checkOpCli, getItem, listItems, listVaults } from "./services/op-cli.js";
import type { OpVault } from "./types.js";
import { itemsToCsv } from "./utils/csv.js";
import { getBackupDir } from "./utils/fs.js";
import * as log from "./utils/logger.js";
import { findLastBackupDate, isBackupDue } from "./utils/schedule-gate.js";

/** Max parallel `op item get` calls, shared across all vaults. */
const CONCURRENCY = 3;
const limit = pLimit(CONCURRENCY);

/** Backups hold plaintext passwords and TOTP secrets — restrict to owner-only. */
const SECRET_FILE_MODE = 0o600;

export async function backupVault(vault: OpVault, dateStr: string): Promise<void> {
  const items = await listItems(vault.id);
  const s = log.spinner(`Fetching ${items.length} items from ${vault.name}`);

  let fetched = 0;
  const detailedItems = await Promise.all(
    items.map((item) =>
      limit(async () => {
        const result = await getItem(item.id, vault.id);
        fetched++;
        if (fetched % 100 === 0) {
          s.message(`Fetching items from ${vault.name}... ${fetched}/${items.length}`);
        }
        return result;
      }),
    ),
  );
  log.succeedSpinner(s, `Fetched ${detailedItems.length} items from ${vault.name}`);

  const dir = await getBackupDir(vault.name, dateStr);

  const jsonPath = join(dir, "backup.json");
  await writeFile(jsonPath, JSON.stringify(detailedItems, null, 2), { mode: SECRET_FILE_MODE });

  const csvContent = itemsToCsv(detailedItems);
  const csvPath = join(dir, "backup.csv");
  await writeFile(csvPath, csvContent, { mode: SECRET_FILE_MODE });

  log.step("Saved backup files", `→ ${jsonPath}`, `→ ${csvPath}`);
}

export async function main(options: { scheduled?: boolean } = {}): Promise<void> {
  log.start("🔐 GetReflect");

  await log.run(
    "Loading configuration...",
    async () => loadConfig(),
    () => ({ msg: "Loaded configuration", details: ["Service account token verified"] }),
  );

  /*
   * For scheduled runs, honor the configured interval (e.g. "every 2 weeks"):
   * launchd fires on its calendar cadence, but we skip until enough days pass.
   * Manual runs (no --scheduled) always proceed.
   */
  if (options.scheduled) {
    const intervalDays = getIntervalDays();
    const lastBackup = await findLastBackupDate(getBackupRoot());
    if (lastBackup && !isBackupDue(lastBackup, intervalDays, new Date())) {
      const lastBackupDate = format(lastBackup, "yyyy-MM-dd");
      log.end(
        `${chalk.yellow("● Skipped")} — last backup ${lastBackupDate}, next due after ${intervalDays} day(s)`,
      );
      return;
    }
  }

  await log.run(
    "Checking 1Password CLI...",
    async () => checkOpCli(),
    (version) => ({ msg: "Checked 1Password CLI", details: [`op v${version}`] }),
  );

  const vaults = await log.run(
    "Discovering vaults...",
    async () => listVaults(),
    (v) => ({
      msg: "Discovered vaults",
      details: [`Found ${v.length} vault(s): ${v.map((vault) => vault.name).join(", ")}`],
    }),
  );

  const dateStr = format(new Date(), "yyyy-MM-dd");

  await Promise.all(vaults.map((vault) => backupVault(vault, dateStr)));

  log.end(`${chalk.green("✔ Backup complete")} — ${log.timestamp()}`);
}
