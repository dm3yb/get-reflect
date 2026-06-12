/*
 * Interactive prompts for the setup wizard, built on @clack/prompts. All user
 * input lives here so the orchestrator (src/setup.ts) stays focused on applying
 * the collected config.
 */

import { password, path, select, text } from "@clack/prompts";
import chalk from "chalk";
import { isAbsolute, resolve } from "node:path";
import untildify from "untildify";
import { defaultBackupRoot } from "../config.js";
import { listVaults } from "../services/op-cli.js";
import type { OpVault } from "../types.js";
import * as log from "../utils/logger.js";
import { ask } from "../utils/prompt.js";
import { parseTime, WEEKDAYS, type Frequency, type Schedule } from "./schedule.js";

export type WizardInput = {
  token: string;
  backupPath: string;
  schedule: Schedule;
};

function vaultSummary(vaults: OpVault[]): string {
  if (vaults.length === 0) {
    return "No vaults granted yet — grant the service account access and they'll be picked up.";
  }
  return vaults.map((vault) => vault.name).join(", ");
}

/** Check the token against 1Password by listing its vaults. True when usable. */
async function verifyToken(token: string): Promise<boolean> {
  const s = log.spinner("Verifying token with 1Password...");
  try {
    const vaults = await listVaults({ token });
    log.succeedSpinner(
      s,
      `Token verified — ${vaults.length} vault(s) accessible`,
      vaultSummary(vaults),
    );
    return true;
  } catch {
    s.error(chalk.red("Could not verify the token"));
    log.error("Check that the token is complete and the service account has vault access.");
    return false;
  }
}

/* clack's validate is synchronous, so the live check runs after each submit; retry on failure. */
async function promptVerifiedToken(): Promise<string> {
  const token = await ask(
    password({
      message: "1Password service account token (starts with ops_):",
      validate: (v) => (v?.trim() ? undefined : "Service account token is required"),
    }),
  );
  if (await verifyToken(token)) {
    return token;
  }
  return promptVerifiedToken();
}

/** Prompt for a whole number, optionally bounded. */
async function promptNumber(
  message: string,
  opts: { min: number; max?: number; initialValue: string; error: string },
): Promise<number> {
  const value = await ask(
    text({
      message,
      initialValue: opts.initialValue,
      validate: (v) => {
        const n = Number(v);
        const valid = Number.isInteger(n) && n >= opts.min && n <= (opts.max ?? Infinity);
        return valid ? undefined : opts.error;
      },
    }),
  );
  return Number(value);
}

async function promptTime(): Promise<{ hour: number; minute: number }> {
  const value = await ask(
    text({
      message: "Time of day to run (24-hour HH:MM):",
      initialValue: "02:00",
      validate: (v) => (parseTime(v ?? "") ? undefined : "Enter a valid 24-hour time, e.g. 02:00"),
    }),
  );
  const parsed = parseTime(value);
  /* validate guarantees parseTime succeeds on the accepted value. */
  if (!parsed) throw new Error(`Invalid time: ${value}`);
  return parsed;
}

/** Unit word for "Run every how many <unit>?". */
const FREQUENCY_UNITS: Record<Frequency, string> = {
  daily: "days",
  weekly: "weeks",
  monthly: "months",
};

async function promptSchedule(): Promise<Schedule> {
  const frequency = await ask(
    select<Frequency>({
      message: "How often should the backup run?",
      options: [
        { value: "daily", label: "Every day" },
        { value: "weekly", label: "Every week" },
        { value: "monthly", label: "Every month" },
      ],
    }),
  );

  const interval = await promptNumber(`Run every how many ${FREQUENCY_UNITS[frequency]}?`, {
    min: 1,
    initialValue: "1",
    error: "Enter a whole number of 1 or more",
  });

  switch (frequency) {
    case "daily":
      return { frequency, interval, ...(await promptTime()) };
    case "weekly": {
      const weekday = await ask(
        select<number>({
          message: "Which day of the week?",
          initialValue: 1,
          options: WEEKDAYS.map((name, value) => ({ value, label: name })),
        }),
      );
      return { frequency, interval, weekday, ...(await promptTime()) };
    }
    case "monthly": {
      const day = await promptNumber("Which day of the month? (1-28)", {
        min: 1,
        max: 28,
        initialValue: "1",
        error: "Enter a day between 1 and 28",
      });
      return { frequency, interval, day, ...(await promptTime()) };
    }
  }
}

async function promptBackupPath(): Promise<string> {
  const choice = await ask(
    select({
      message: "Where should backups be stored?",
      options: [
        { value: "default", label: `Default — iCloud Drive (${defaultBackupRoot()})` },
        { value: "custom", label: "Custom path" },
      ],
    }),
  );

  if (choice === "default") {
    return defaultBackupRoot();
  }

  const custom = await ask(
    path({
      message: "Enter the backup directory path:",
      root: process.env.HOME ?? "/",
      directory: true,
      validate: (v) => {
        const expanded = untildify((v ?? "").trim());
        if (!expanded) return "Path cannot be empty";
        if (!isAbsolute(expanded)) return "Enter an absolute path (or one starting with ~/)";
        return undefined;
      },
    }),
  );
  return resolve(untildify(custom.trim()));
}

export async function collectSetupInput(): Promise<WizardInput> {
  const token = await promptVerifiedToken();
  const backupPath = await promptBackupPath();
  const schedule = await promptSchedule();

  return { token, backupPath, schedule };
}
