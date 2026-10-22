# Release hardening (lote B) Audit

Status: Ready for specification
Size: medium
Reliability: strict
Audit trigger: strict (item 2 changes a destructive path over persisted data)

## Evidence Facts
| Fact | Evidence |
|---|---|
| Entry point | Restore: `src/features/settings/SettingsScreen.tsx:128` `confirmRestore` → `src/db/repositories/backup.ts:91` `restoreBackup`. SW: `src/pwa/config.ts:4`. Chart: `src/features/progress/ProgressScreen.tsx:16`. |
| Covering tests | `src/db/repositories/backup.test.ts` (export/restore round trip), `workouts.test.ts`, `measurement-round-trip.test.ts`. None for the Settings UI, the SW config or the Progress screen. |
| Consumers of altered contracts | `restoreBackup`: Settings only in app code (grep `restoreBackup src`), tests above. `pwaOptions`: `vite.config.ts` only. `ExerciseChart` module: `ProgressScreen.tsx` only (grep `ExerciseChart'`). |

## Baseline
| Field | Value |
|---|---|
| Repository root | `mine/TrainLog` |
| Branch | `change/routine-export` |
| Commit SHA | `22a4114` |
| Working tree | Clean — lote A is already committed in `22a4114` (briefing said uncommitted; it is not) |
| Audit date | 2026-10-22 |

## Current Behavior Trace
1. Restore: `choose` validates the file → `restoreSummary` counts → user confirms → `confirmRestore` calls `restoreBackup`, which clears and refills all `RESTORED_TABLES` in one transaction. Nothing is saved first.
2. SW: `registerType: 'autoUpdate'` + `skipWaiting` + `clientsClaim`; registration is injected by the plugin (no `virtual:pwa-register` import anywhere in `src`; `src/main.tsx` has none). A deploy swaps the SW and may reload the tab.
3. Progress: `ProgressScreen` statically imports `ExerciseChart` (recharts), so recharts is in the single entry chunk: `dist/assets/index-C8LdC7YC.js` 1,234.99 kB (gzip 371.58 kB), with the Vite 500 kB warning.
4. Docs: `docs/PRD.md:2449` lists `SessionHistoryScreen.tsx`/`/sessions` (neither exists; `App.tsx` routes only `/sessions/:sessionId`); `README.MD:93` says there is no list, reached "from the calendar or an exercise's history".

## Contradictions and Risks
- `docs/changes/2026-08-20-pwa/spec.md` DEC-2 (user-approved `autoUpdate`, no prompt UI) is superseded by item 3; the new spec records that. Old spec stays as history.
- A fresh-phone restore (empty DB) would download a pointless empty backup; skip when every table is empty.
- If the safety export or download throws, restore must not run (data-loss guard). `download` is a synchronous anchor click; the browser cannot confirm the user kept the file — residual risk, stated in the UI copy.
- `useRegisterSW` needs types: add `vite-plugin-pwa/react` to `tsconfig.json` `types`; virtual modules do not resolve under Vitest (node env) — the update component stays untested by unit tests.
- Offline precache: `globPatterns` already covers `**/*.js`, so a lazy chunk is precached.
- Whole-route lazy is the smallest split: `ExerciseChart.tsx` also exports `metricsFor`/`round`/`Metric` used by ProgressScreen, so lazy-loading only the chart component would need splitting that module.

## Candidate Ownership (one writer)
Write set: `docs/PRD.md`, `README.MD`, `src/features/settings/{SettingsScreen.tsx, safeRestore.ts(+test)}`, `src/pwa/config.ts`, `src/pwa/UpdatePrompt.tsx`, `src/App.tsx`, `tsconfig.json`, change folder. No generated files except `dist/` (ignored).

## Supported Options (none needs approval)
Item 2: UI-layer orchestration (chosen: features→db direction, `download` lives in features) vs. inside `restoreBackup` (would put DOM in db — rejected by layering).

## Material Decisions Needed
None blocking. Defaults taken: abort restore if safety backup fails; skip backup when DB is empty.

## Do Not Touch
progression basing, `.impeccable`, `CLAUDE.MD`, `docs/bloque-*.yaml`, branch `change/planned-unit-migration`.

## Recommended Next Step
Write spec.
