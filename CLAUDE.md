# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Stack at a glance:** TypeScript (ESM, no build step — `tsx` runs sources directly) · Node >= 20.12 · pnpm · Vitest · Oxlint + Oxfmt · @clack/prompts · macOS launchd · 1Password CLI (`op`).

## Commands

| Command                            | Purpose                                                  |
| ---------------------------------- | -------------------------------------------------------- |
| `pnpm test`                        | Run all tests (Vitest).                                  |
| `pnpm vitest run tests/utils/csv.test.ts` | Run a single test file.                           |
| `pnpm vitest run -t "name"`        | Run tests matching a name.                               |
| `pnpm run typecheck`               | `tsc --noEmit`.                                          |
| `pnpm run lint`                    | Oxlint over `src` and `tests`.                           |
| `pnpm run format` / `format:check` | Oxfmt write / check (also sorts imports).                |
| `pnpm run backup`                  | Real backup run — see warning below.                     |
| `pnpm run setup`                   | Interactive wizard — see warning below.                  |
| `pnpm run status`                  | Read-only install/backup status.                         |
| `pnpm run uninstall`               | Remove the launchd agent (confirm-gated).                |

The Husky pre-push hook runs `format:check`, `lint`, and `test`; run all three (plus `typecheck`) before declaring work done.

**⚠️ Side effects:** `pnpm run backup` reads every vault item from the real 1Password service account (`.env`) and writes files into the user's backup directory. `pnpm run setup` overwrites `.env`, (re)installs the launchd agent in `~/Library/LaunchAgents`, may run `brew install`, and can launch a real backup at the end. Don't run either casually; `pnpm run setup </dev/null` is a safe smoke test (renders the first prompt, then cancels).

## Architecture

**One CLI entry** — `src/cli.ts` (the npm `bin`, shebang preserved by tsc) routes subcommands and loads `~/.config/get-reflect/config.env` into the environment via `loadConfigFile()` before dispatch. `setup` is the default command, so `npx get-reflect` is the full onboarding. Dev runs use tsx on the sources (`pnpm run <cmd>` → `tsx src/cli.ts <cmd>`); npm ships the compiled `dist/` (`pnpm run build`, `tsc -p tsconfig.build.json`).

1. **Backup** — `src/backup.ts` (`main`) → `src/services/op-cli.ts` (wrappers around the `op` CLI; `execFile` only, never a shell) → writes `backup.json` plus a TSV `backup.csv` (`src/utils/csv.ts`, papaparse) into `<backup root>/<YYYY-MM-DD>/<vault-slug>/`. The backup root comes from `src/config.ts` (`BACKUP_PATH` or the iCloud Drive default). Item fetches share one global `p-limit(3)`.
2. **Setup wizard** — `src/setup.ts` (`runSetup`) orchestrates `src/setup/preflight.ts` (macOS guard; offers `brew install 1password-cli` when `op` is missing) → `src/setup/prompts.ts` (clack prompts; the token is **live-verified** via `op vault list` before being accepted) → `src/setup/env-file.ts` (writes the config file, mode 0600, dir 0700) → `src/setup/launchd.ts` (renders the plist into the config dir, copies it to `~/Library/LaunchAgents`, reloads via `launchctl`) → optional first backup (calls backup `main()` directly). The agent's `ProgramArguments` re-invoke the *currently running entry*: `dist/cli.js` when installed, the sources via `--import tsx/esm` in dev (`agentProgramArguments` in setup.ts).
3. **Status / Uninstall** — `src/status.ts` (`runStatus`, read-only report) and `src/uninstall.ts` (`runUninstall`, unload + remove the agent). Shared names live in `src/constants.ts` (`LAUNCHD_LABEL`, `VERSION` — kept in sync with package.json, plist/log paths).

### The interval-gating design (spans several files — read before touching scheduling)

launchd's `StartCalendarInterval` cannot express "every N weeks". The workaround:

- The wizard stores `BACKUP_INTERVAL_DAYS` in `.env` (`src/setup/schedule.ts` → `intervalToDays`) and launchd fires at the base cadence with the `--scheduled` flag.
- On scheduled runs, `src/backup.ts` consults `src/utils/schedule-gate.ts`, which derives the last backup date **from the dated folder names in the backup root** (no separate state file) and skips the run until the interval has elapsed.
- Manual runs (`pnpm run backup`, no `--scheduled`) always back up.

### Logger

`src/utils/logger.ts` is a thin adapter over `@clack/prompts` (intro/outro/log/spinner). It contains a deliberate `staticSpinner` fallback for non-TTY output: clack animates spinner frames even without a TTY (only `CI=true` is special-cased), which would fill the launchd log with escape codes. Keep that fallback.

### Generated plist

The plist is machine-specific (absolute node/entry paths, schedule), generated into `~/.config/get-reflect/` by setup and installed into `~/Library/LaunchAgents` — change the generator in `src/setup/launchd.ts`, never a plist by hand.

## Testing conventions

- Tests mock at **module boundaries**, not Node built-ins: mock `src/utils/exec.js` (never `node:child_process`), `path-exists`, and `src/utils/logger.js`; `node:fs/promises` is mocked only where a module calls it directly.
- Shared fixtures live in `tests/helpers.ts` (`sampleItem`, `makeItemSummary`) — extend those instead of inlining item literals.
- Every test file resets state in `beforeEach` (`vi.clearAllMocks()` plus the `HOME` / `OP_SERVICE_ACCOUNT_TOKEN` env vars it needs).
- Tests pin observable behavior (plist XML output, TSV columns, gating decisions). When refactoring, expectations should not need to change.

## Code rules

### Project-specific

- **ESM with `.js` suffixes** on relative imports (`./config.js`), including in tests.
- **Prefer popular packages over hand-rolled utilities.** Precedents: `@clack/prompts` (prompts + spinners + timeline), `untildify` (`~` expansion), `path-exists`, `p-limit`, `date-fns` (all date parsing/math — no manual `Date` arithmetic), papaparse (TSV), plist (XML escaping).
- **No shell execution.** All subprocess calls go through `execFileAsync` (`src/utils/exec.ts`) with argument arrays — `op` handles secrets.
- **Comments are block-format only** — `/** … */` JSDoc on declarations, `/* … */` inside bodies; no `//` lines. Write one only for rationale, caveats, or workarounds the code can't express — never to restate the code. Each module starts with a short `/* … */` purpose header (keep non-obvious rationale notes, e.g. the launchd limitation).
- `~/.config/get-reflect/config.env` holds the 1Password service-account token (written 0600 in a 0700 dir). Never log token values; `op` output may contain secrets too — backup files must only be written under the backup root, mode 0600 in 0700 dirs.
- Formatting is Oxfmt's job (double quotes, semicolons, 100-col, sorted imports) — run `pnpm run format`, don't fix style by hand.
- `src/config.ts` is the only place that reads `process.env` for configuration and the only place that loads the config file (`HOME` for path building is the exception).

### TypeScript

- **No `any`** — use `unknown`, or `@ts-expect-error` with a `FIXME:` comment.
- **No `@ts-ignore`.**
- **No `as` type assertions** in `src/` (`as const` is fine) — use type guards. Sole sanctioned exception: generic narrowing TS can't express (`ask()` in `src/utils/prompt.ts`), with a comment. Tests may cast external/mock shapes (e.g. `parsePlist` results).
- **No `interface`** — default to `type` (nothing in this codebase extends).
- **No `enum`** — use `const X = { … } as const` plus a derived type.
- **No `class`** except custom `Error` subclasses.
- **No `export default`.** Export only what another module actually imports.
- **`function` keyword** for top-level declarations, not arrow constants.
- **Return types only on exported functions** — let TypeScript infer local ones.
- **kebab-case** filenames.

### Error handling

- Always `catch (err: unknown)` — never implicit `any`.
- Never swallow errors silently. Deliberate recoveries carry a comment explaining why ignoring is safe (see `installAgent`'s unload, `findLastBackupDate`'s missing root).
