/* Shared application constants used by the setup, status, and uninstall commands. */

import { join } from "node:path";

export const APP_NAME = "GetReflect";

/* Bumped together with package.json by release-please. */
export const VERSION = "1.0.0"; /* x-release-please-version */

/** launchd job label for the scheduled-backup LaunchAgent. */
export const LAUNCHD_LABEL = "com.user.get-reflect";

/** Where the LaunchAgent plist is installed for the current user. */
export function agentPlistPath(): string {
  return join(process.env.HOME ?? "", "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`);
}

/** Log file the scheduled agent writes to. */
export function logFilePath(): string {
  return join(process.env.HOME ?? "", "Library", "Logs", "get-reflect.log");
}
