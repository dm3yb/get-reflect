/* Wrappers around the 1Password CLI (`op`). Uses execFile (no shell) to avoid injection. */

import type { OpItemDetail, OpItemSummary, OpVault } from "../types.js";
import { execFileAsync } from "../utils/exec.js";

/** Max stdout buffer for `op` calls (50 MB) — large vaults exceed the 1 MB default. */
const MAX_BUFFER = 50 * 1_024 * 1_024;

/**
 * Token override for callers that have a token before it lives in the
 * environment (the setup wizard verifies tokens as they are entered).
 */
export type OpOptions = {
  token?: string;
};

function isMissingBinary(err: unknown): boolean {
  return err instanceof Error && "code" in err && err.code === "ENOENT";
}

/** Replace a raw ENOENT spawn failure with an actionable install hint. */
function toFriendlyError(err: unknown): unknown {
  if (isMissingBinary(err)) {
    return new Error("1Password CLI (op) not found. Install it with: brew install 1password-cli", {
      cause: err,
    });
  }
  return err;
}

/** Run an `op` subcommand (with `--cache`) and return its stdout. */
export async function execOp(args: string[], opts: OpOptions = {}): Promise<string> {
  try {
    const { stdout } = await execFileAsync("op", [...args, "--cache"], {
      maxBuffer: MAX_BUFFER,
      ...(opts.token ? { env: { ...process.env, OP_SERVICE_ACCOUNT_TOKEN: opts.token } } : {}),
    });
    return stdout;
  } catch (err: unknown) {
    throw toFriendlyError(err);
  }
}

/** Verify `op` is installed and return its version string. */
export async function checkOpCli(): Promise<string> {
  try {
    const { stdout } = await execFileAsync("op", ["--version"]);
    return stdout.trim();
  } catch (err: unknown) {
    throw toFriendlyError(err);
  }
}

export async function listVaults(opts: OpOptions = {}): Promise<OpVault[]> {
  const output = await execOp(["vault", "list", "--format", "json"], opts);
  return JSON.parse(output);
}

export async function listItems(vaultId: string): Promise<OpItemSummary[]> {
  const output = await execOp(["item", "list", "--vault", vaultId, "--format", "json"]);
  return JSON.parse(output);
}

export async function getItem(itemId: string, vaultId: string): Promise<OpItemDetail> {
  const output = await execOp(["item", "get", itemId, "--vault", vaultId, "--format", "json"]);
  return JSON.parse(output);
}
