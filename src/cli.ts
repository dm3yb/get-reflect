#!/usr/bin/env node
/*
 * GetReflect CLI. Routes subcommands; the setup wizard is the default, so
 * `npx get-reflect` is the complete onboarding.
 */

import chalk from "chalk";
import { loadConfigFile } from "./config.js";
import { VERSION } from "./constants.js";
import * as log from "./utils/logger.js";

const HELP = `GetReflect — automatic 1Password vault backups on macOS

Usage: get-reflect [command]

Commands:
  setup       Guided onboarding (default): prerequisites, token, schedule
  backup      Back up all vaults now
  status      Show scheduler state, backup root, and last backup
  uninstall   Remove the scheduled agent (keeps config and backups)

Options:
  -v, --version   Print the version
  -h, --help      Show this help
`;

const FAILURE_LABELS: Record<string, string> = {
  setup: "Setup",
  backup: "Backup",
  status: "Status",
  uninstall: "Uninstall",
};

async function dispatch(command: string, args: string[]): Promise<void> {
  switch (command) {
    case "setup": {
      const { runSetup } = await import("./setup.js");
      return runSetup();
    }
    case "backup": {
      const { main } = await import("./backup.js");
      return main({ scheduled: args.includes("--scheduled") });
    }
    case "status": {
      const { runStatus } = await import("./status.js");
      return runStatus();
    }
    case "uninstall": {
      const { runUninstall } = await import("./uninstall.js");
      return runUninstall();
    }
    default: {
      console.error(`Unknown command: ${command}\n`);
      console.error(HELP);
      process.exit(1);
    }
  }
}

const [command = "setup", ...args] = process.argv.slice(2);

if (command === "--version" || command === "-v") {
  console.log(VERSION);
  process.exit(0);
}
if (command === "--help" || command === "-h" || command === "help") {
  console.log(HELP);
  process.exit(0);
}

loadConfigFile();

dispatch(command, args).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  log.error(message);
  log.end(chalk.red(`✖ ${FAILURE_LABELS[command] ?? "Command"} failed`));
  process.exit(1);
});
