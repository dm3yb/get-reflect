/* Cancel-aware wrapper around @clack/prompts results. */

import { cancel, isCancel } from "@clack/prompts";

/** Await a clack prompt, exiting cleanly when the user hits Ctrl-C. */
export async function ask<T>(prompt: Promise<T | symbol>): Promise<T> {
  const value = await prompt;
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(130);
  }
  /* Sanctioned cast: TS cannot narrow `T | symbol` to `T` for a generic T. */
  return value as T;
}
