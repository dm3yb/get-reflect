# Changelog

## 1.0.0 — 2026-06-12

Initial public release.

- Install and onboard with a single command: `npx get-reflect` (config lives in
  `~/.config/get-reflect/`, owner-only).
- Automatic, scheduled backups of 1Password vaults to JSON + CSV via the official `op` CLI.
- Guided setup wizard: installs the 1Password CLI via Homebrew when missing, verifies the
  service-account token live, writes `.env` (owner-only), installs and loads the launchd
  agent, and offers to run the first backup immediately.
- Interval schedules ("every 2 weeks", "every 3 months") on top of launchd's calendar
  cadence, gated by the dated backup folders — no extra state file.
- `pnpm run status` (scheduler state, last backup, gating) and `pnpm run uninstall`.
- Backups written owner-only (files 0600, folders 0700); read-only Service Account access.
