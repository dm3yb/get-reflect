# Changelog

## [1.2.0](https://github.com/dm3yb/get-reflect/compare/v1.1.0...v1.2.0) (2026-06-14)


### Features

* enhance GitHub Actions workflow for automated release and publishing to npm and GitHub Packages ([f18858a](https://github.com/dm3yb/get-reflect/commit/f18858a324576eadaf84ff2832ea35008f10aceb))

## [1.1.0](https://github.com/dm3yb/get-reflect/compare/v1.0.0...v1.1.0) (2026-06-12)


### Features

* add 1Password CLI wrapper functions for vault and item management ([da8bed1](https://github.com/dm3yb/get-reflect/commit/da8bed1327fefc3bb788b267a0d3c4923c2844bc))
* add pre-push hook for automated checks on formatting, linting, and testing ([0a3fda9](https://github.com/dm3yb/get-reflect/commit/0a3fda9140cd542600194b34e2449f85e5543d93))
* add shared test helpers for item summaries and details ([577a9e5](https://github.com/dm3yb/get-reflect/commit/577a9e51b8032297996842d1c3d4d417fc3b3110))
* implement backup functionality with vault data retrieval, file writing, and scheduling support ([2094321](https://github.com/dm3yb/get-reflect/commit/2094321cfd5f566d458dbf2ad0f8b9e1f28576c3))
* implement setup wizard with environment configuration, scheduling, and interactive prompts ([33a6a7d](https://github.com/dm3yb/get-reflect/commit/33a6a7d2d3fb1e7e049f50380d63d74ddd640f2d))
* implement utility modules for CSV export, filesystem management, logging, prompts, and backup scheduling ([4304dd8](https://github.com/dm3yb/get-reflect/commit/4304dd8303850e2b42f03e81030e54bdd91a42ee))
* introduce GetReflect CLI for command routing and user onboarding ([92a82d6](https://github.com/dm3yb/get-reflect/commit/92a82d627590647199f2e4cbc1d6bc871a52912d))

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
