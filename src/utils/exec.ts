/* Promisified child_process.execFile, in its own module so tests can mock it. */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const execFileAsync = promisify(execFile);
