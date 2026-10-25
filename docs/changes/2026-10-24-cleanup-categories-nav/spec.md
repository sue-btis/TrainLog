# Cleanup: one category list, bottom nav at 320 px

Status: Ready for implementation
Size: quick
Reliability: lean
Implementation effort: medium
Triggered artifacts: none

Goal: the weekly volume reads the catalog's existing `CATALOG_CATEGORIES` instead of a second list added beside it, and the bottom nav labels stay on one line at 320 px.

Evidence facts:
- Entry points: `src/domain/catalog/index.ts` (`CATEGORIES`, duplicate of `CATALOG_CATEGORIES`, noted as F-4 in `docs/changes/2026-10-23-exercise-rename-delete/audit.md`); `src/features/shell/BottomNav.tsx:13`.
- Covering tests: `src/domain/volume.test.ts`, `src/domain/catalog/index.test.ts`.
- Consumers of altered contracts: `CATEGORIES` — only `src/domain/volume.ts` (`grep -rn "CATEGORIES\b" src`).

Scope:
- Include: delete `CATEGORIES`; volume orders muscles alphabetically, as `CATALOG_CATEGORIES` does. Below 360 px the nav row uses `gap-1 px-2` and the label drops its tracking.
- Exclude: any other nav or catalog change.

Acceptance:
- AC-1 Volume tests pass with alphabetical order.
- AC-2 At 320 px, TODAY / CALENDAR / PROGRESS / MORE each render on one line, no horizontal scroll; at 375 px spacing and tracking are unchanged.

Done when: both acceptance checks hold in tests and in the dev server.
