# Release hardening (lote B) — Spec

Status: Approved by Josue (decisions in briefing)
Size: medium
Reliability: strict
Implementation effort: medium
Base: `22a4114`. Artifacts: `audit.md`, `spec.md`, `verification.md`. No plan (one writer), no execution.md (self-verified).
Supersedes: DEC-2 of `docs/changes/2026-08-20-pwa/spec.md`.

## Requirements
- REQ-1 PRD §History row and README state that session history lives in the Calendar (DaySheet → `/sessions/:id`); there is no `/sessions` list.
- REQ-2 Restoring a backup first downloads a backup of the current data (`trainlog-before-restore-<date>.json`); if that fails, nothing is restored. An empty database produces no file.
- REQ-3 The service worker no longer takes over on its own: a "New version — reload" notice appears when an update is waiting, and the update applies only when the user accepts. Offline precaching unchanged.
- REQ-4 The Progress route (and recharts) loads on demand with a `Reading` fallback.
- REQ-5 README says the live demo deploys from `master` via Cloudflare's Git integration (no workflow in the repo); placeholder link kept.

## Decisions
- Item 2 orchestration lives in `features/settings/safeRestore.ts` (needs `download`; db must stay DOM-free).
- Item 3: `registerType: 'prompt'`, no `skipWaiting`/`clientsClaim`; `UpdatePrompt` rendered in `App`, so it also shows on the Session screen as a dismissable-by-ignoring notice, never auto-reloading.
- Item 4: lazy the route in `App.tsx`, not the chart, because `ProgressScreen` also needs non-chart exports of the chart module.

## Acceptance
- AC-1 (REQ-2) test: with data, restore calls the download with the pre-restore document before tables change; with a throwing download, tables are untouched; with an empty DB, no download.
- AC-2 (REQ-3) built `dist/sw.js` has no unconditional `skipWaiting()`/`clientsClaim` activation; it handles the `SKIP_WAITING` message; precache manifest still lists the app shell.
- AC-3 (REQ-4) build emits a separate chunk containing recharts; entry chunk size reported before (1,234.99 kB / gzip 371.58 kB) and after.
- AC-4 `pnpm lint`, `typecheck`, `test`, `build` pass.
- Not verifiable without a browser: the notice rendering and reload flow, the lazy fallback visually, the file download.
