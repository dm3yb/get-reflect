# GetReflect

> Automatic, scheduled backups of your 1Password vaults — on your own Mac.

[![CI](https://github.com/dm3yb/get-reflect/actions/workflows/ci.yml/badge.svg)](https://github.com/dm3yb/get-reflect/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey)

## What this does

GetReflect is a small command-line tool for macOS that makes **automatic, scheduled backups of your 1Password vaults to local files** — so you keep your own copy of your passwords instead of relying solely on 1Password's servers and your account staying accessible.

On the schedule you choose (daily, weekly, or monthly — including intervals like *every 2 weeks*), it logs in with a read-only 1Password Service Account, reads every item from each vault you've granted it, and saves two files per vault into a dated folder:

- **`backup.json`** — the complete data for every item (all fields, sections, URLs, tags, metadata). The faithful, full record.
- **`backup.csv`** — a flattened, spreadsheet-friendly table of the common login fields (title, URL, username, password, one-time-password seed, notes), in the same column layout as 1Password's own CSV export.

By default the files land in your **iCloud Drive**, so backups sync across your devices automatically. You can point it at any folder instead (e.g. an external drive).

### Why you might want it

- **Disaster recovery** — if you ever lose access to your 1Password account, you still have a readable, offline copy of your logins.
- **It runs itself** — macOS's built-in scheduler (`launchd`) triggers it in the background. No app to keep open, nothing to remember.
- **You stay in control of where the data lives** — backups are plain files on your own machine and cloud, not a third-party service.

### What you should know

The backup files contain your **actual passwords and TOTP secrets in plain text**. That's the point — they're a usable backup — but it means the destination folder is as sensitive as your vault itself. GetReflect writes files owner-only (`0600`) inside owner-only folders (`0700`); if you use the iCloud Drive default, the files still sync to Apple's cloud. Service accounts also **cannot** read your Personal/Private/Employee or default Shared vaults — only custom vaults you explicitly grant.

## Prerequisites

- macOS
- Node.js >= 20.12
- A [1Password Service Account](https://my.1password.com) with read access to the vaults you want backed up

The 1Password CLI itself is optional to pre-install — the setup wizard offers to install it via Homebrew when it's missing.

## Quick start

### 1. Create a Service Account

1. Go to **my.1password.com → Developer → Service Accounts**
2. Create a new service account (e.g. `backup-agent`)
3. Grant **read-only** access to each vault you want backed up
4. Copy the token immediately — it's shown only once

### 2. Run the wizard

```bash
npx get-reflect
```

That's it. The guided wizard does the rest:

- checks for the 1Password CLI and offers to **install it via Homebrew** if missing,
- **verifies your token live** the moment you paste it (and shows which vaults it can see),
- asks where to store backups (iCloud Drive default or a custom path),
- asks how often to run — daily / weekly / monthly, each with an **"every N"** interval (e.g. *every 2 weeks*),
- writes the config file (owner-only, `0600`, in `~/.config/get-reflect/`),
- generates and **installs the launchd scheduler**, and
- offers to **run your first backup right away**.

For repeated use, install it globally — `npm install -g get-reflect` — and the `get-reflect` command is always available.

### 3. Check on it anytime

```bash
npx get-reflect status
```

```
┌  🔐 GetReflect — Status
│
●  Scheduler
│  Agent: loaded (com.user.get-reflect)
│  Log: ~/Library/Logs/get-reflect.log
│
●  Backups
│  Root: ~/Library/Mobile Documents/com~apple~CloudDocs/Documents/security/get-reflect-backups
│  Last backup: 2026-06-11
│  Interval gating: every 14 day(s)
│
└  ✔ Status — 2026-06-12 10:00:00
```

## Commands

| Command                 | What it does                                                       |
| ----------------------- | ------------------------------------------------------------------ |
| `get-reflect` / `setup` | Guided onboarding: prerequisites, token, schedule, agent install.  |
| `get-reflect backup`    | Back up all vaults right now (always runs, ignores the interval).  |
| `get-reflect status`    | Show scheduler state, backup root, last backup, gating interval.   |
| `get-reflect uninstall` | Remove the scheduled agent (keeps config and all backup files).    |

(Prefix with `npx ` if you haven't installed globally.)

## Manual setup (without the wizard)

Configuration lives in `~/.config/get-reflect/config.env` (env format). Create it owner-only:

```bash
mkdir -p ~/.config/get-reflect && chmod 700 ~/.config/get-reflect
touch ~/.config/get-reflect/config.env && chmod 600 ~/.config/get-reflect/config.env
```

Set at least the service account token (and optionally `BACKUP_PATH` / `BACKUP_INTERVAL_DAYS`):

```
OP_SERVICE_ACCOUNT_TOKEN=ops_...your_token...
```

Then run `get-reflect setup` anyway when you want the scheduler — or manage launchd by hand:

```bash
launchctl list | grep get-reflect            # verify it's active
launchctl start com.user.get-reflect        # trigger a scheduled run now
tail -f ~/Library/Logs/get-reflect.log      # watch the log
```

## Interval schedules (e.g. every 2 weeks)

launchd's `StartCalendarInterval` is calendar-based and can't natively express "every other week". To support intervals, the scheduler fires on its base cadence (e.g. weekly on the chosen day/time) while the backup script skips runs until `BACKUP_INTERVAL_DAYS` have elapsed since the last backup:

- The launchd agent invokes the CLI with `--scheduled`, which enables this gating.
- The last backup date is read from the dated folders already in your backup directory — no extra state file.
- Manual runs (`get-reflect backup`) omit `--scheduled` and **always** back up.

The wizard sets `BACKUP_INTERVAL_DAYS` for you (e.g. `14` for every 2 weeks, `56` for every 2 months). `0` or unset means "run on every cadence".

## Output structure

```
…/get-reflect-backups/
└── 2026-06-12/
    ├── my-vault/
    │   ├── backup.json    # Full item data (all fields)
    │   └── backup.csv     # Flattened fields (tab-separated)
    └── work-vault/
        ├── backup.json
        └── backup.csv
```

If run multiple times on the same day, subsequent runs append a timestamp suffix (e.g. `my-vault-143052`). Files are written `0600` inside `0700` folders.

## CSV columns

| Column   | Source                              |
| -------- | ----------------------------------- |
| Title    | Item title                          |
| Url      | Primary URL from item               |
| Username | Field with purpose USERNAME         |
| Password | Field with purpose PASSWORD         |
| OTPAuth  | OTP field value (TOTP seed URI)     |
| Favorite | Whether item is favorited           |
| Archived | Whether item is archived            |
| Tags     | Semicolon-separated tags            |
| Notes    | Field with purpose NOTES            |

## How it works

The 1Password CLI has no `export` command, so GetReflect:

1. Lists all vaults via `op vault list --format json`
2. For each vault, lists items via `op item list --vault <id> --format json`
3. Fetches full details for each item concurrently (global limit of 3) via `op item get`
4. Writes `backup.json` (array of all items) and `backup.csv` (flattened fields)

All CLI calls use `--cache` to reduce redundant server requests, and every subprocess runs through `execFile` with argument arrays — never a shell.

## Development

```bash
git clone git@github.com:dm3yb/get-reflect.git && cd get-reflect && pnpm install

pnpm run setup         # run any command from sources via tsx (also: backup/status/uninstall)
pnpm run test          # Vitest
pnpm run typecheck     # tsc --noEmit
pnpm run lint          # Oxlint
pnpm run format        # Oxfmt (also sorts imports)
pnpm run build         # compile to dist/ (what npm publishes)
```

A Husky pre-push hook runs `format:check`, `lint`, and `test`. CI runs the same checks plus `typecheck` on every push and PR.

## License

[MIT](LICENSE) © Dmytro Bobryshev
