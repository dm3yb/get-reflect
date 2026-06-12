import chalk from "chalk";
import { main } from "./backup.js";
import * as log from "./utils/logger.js";

/*
 * `--scheduled` (set by the launchd agent) enables interval gating; manual runs
 * omit it and always back up.
 */
const scheduled = process.argv.includes("--scheduled");

main({ scheduled }).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  log.error(message);
  log.end(`${chalk.red("✖ Backup failed")}`);
  process.exit(1);
});
