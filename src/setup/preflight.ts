/*
 * Setup preflight: verify the environment before asking the user anything.
 * macOS is required (scheduling is built on launchd), and the 1Password CLI
 * must be present — offered as a one-confirm Homebrew install when missing.
 */

import { confirm } from "@clack/prompts";
import chalk from "chalk";
import { checkOpCli } from "../services/op-cli.js";
import { execFileAsync } from "../utils/exec.js";
import * as log from "../utils/logger.js";
import { ask } from "../utils/prompt.js";

export function assertMacos(): void {
  if (process.platform !== "darwin") {
    log.error(
      "GetReflect requires macOS.",
      "Scheduling is built on launchd; Windows and Linux are not supported yet.",
    );
    log.end(chalk.red("✖ Setup aborted"));
    process.exit(1);
  }
}

async function hasHomebrew(): Promise<boolean> {
  try {
    await execFileAsync("brew", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

/** Make sure `op` is installed, offering a Homebrew install when it isn't. */
export async function ensureOpCli(): Promise<void> {
  try {
    const version = await checkOpCli();
    log.step("1Password CLI detected", `op v${version}`);
    return;
  } catch {
    /* missing — fall through to the install offer */
  }

  if (!(await hasHomebrew())) {
    log.error(
      "1Password CLI (op) not found, and Homebrew is not available to install it.",
      "Install it manually, then re-run setup:",
      "https://developer.1password.com/docs/cli/get-started/",
    );
    log.end(chalk.red("✖ Setup aborted"));
    process.exit(1);
  }

  const install = await ask(
    confirm({
      message: "1Password CLI (op) not found. Install it now via Homebrew?",
      initialValue: true,
    }),
  );
  if (!install) {
    log.end(chalk.yellow("✖ Setup cancelled — GetReflect needs the 1Password CLI."));
    process.exit(1);
  }

  await log.run(
    "Installing 1Password CLI (this can take a minute)...",
    () => execFileAsync("brew", ["install", "1password-cli"], { maxBuffer: 10 * 1_024 * 1_024 }),
    () => ({ msg: "Installed 1Password CLI" }),
  );
}
