/*
 * Timeline-style CLI output, rendered by @clack/prompts (the library behind
 * Sentry's wizard UI).
 */

import { intro, log, outro, spinner as clackSpinner, type SpinnerResult } from "@clack/prompts";
import chalk from "chalk";
import { format } from "date-fns";

/** Print indented dim detail lines under the current timeline entry. */
function printDetails(details: string[]): void {
  if (details.length > 0) {
    log.message(details.map((detail) => chalk.dim(detail)).join("\n"));
  }
}

export function start(title: string): void {
  intro(chalk.bold(title));
}

export function step(msg: string, ...details: string[]): void {
  log.step(msg);
  printDetails(details);
}

export function error(msg: string, ...details: string[]): void {
  log.error(chalk.red(msg));
  printDetails(details);
}

export function end(msg: string): void {
  outro(msg);
}

/**
 * clack's spinner animates frames even without a TTY (it only special-cases
 * `CI=true`), which would fill the launchd log with escape codes. Without a
 * TTY, fall back to a static stand-in that just prints the final step line.
 */
function staticSpinner(): SpinnerResult {
  return {
    start() {},
    message() {},
    stop(msg?: string) {
      if (msg) log.step(msg);
    },
    error(msg?: string) {
      if (msg) log.error(msg);
    },
    cancel() {},
    clear() {},
    isCancelled: false,
  };
}

export function spinner(msg: string): SpinnerResult {
  const s = process.stdout.isTTY ? clackSpinner() : staticSpinner();
  s.start(msg);
  return s;
}

export function succeedSpinner(s: SpinnerResult, msg: string, ...details: string[]): void {
  s.stop(msg);
  printDetails(details);
}

export async function run<T>(
  label: string,
  fn: () => Promise<T>,
  done: (result: T) => { msg: string; details?: string[] },
): Promise<T> {
  const s = spinner(label);
  try {
    const result = await fn();
    const { msg, details = [] } = done(result);
    succeedSpinner(s, msg, ...details);
    return result;
  } catch (err) {
    s.error(chalk.red(label));
    throw err;
  }
}

export function timestamp(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd HH:mm:ss");
}
