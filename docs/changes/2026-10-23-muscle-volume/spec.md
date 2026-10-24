# Weekly volume per muscle

Status: Ready for implementation
Size: quick
Reliability: lean
Implementation effort: medium
Triggered artifacts: none

Goal: Progress opens with this Monday-week's sets per muscle: what the active
Routine's Placements plan for the week beside what was logged. Categories the
catalog does not know are counted apart, by exercise, so dirty vocabulary is
visible instead of inflating a muscle (PRD §39 backlog item 8).

Evidence facts:
- Entry point: `src/features/progress/ProgressScreen.tsx:28` (`ProgressScreen`).
- Covering tests: `src/domain/history.test.ts` for the neighbouring summaries; none for volume (new).
- Consumers of altered contracts: no contract altered. New read-only repository function; Dexie schema, backup and routine-file schemas untouched.

Decisions (Josue, 2026-10-23):
- DEC-1 Planned vs performed, side by side.
- DEC-2 Unknown categories are grouped as "other" by exercise; the file format is not changed.

Scope:
- Include: `CATEGORIES` derived from the catalog; pure `weeklyVolume(planned, performed)` in `src/domain/volume.ts`; repository `listWeekVolume(routineId, from, to)`; a "this week" section on Progress.
- Planned = for each Placement of the active Routine in the week, the `sets` of its Workout's Planned Exercises. Performed = every logged set in Sessions started that week, any Routine. Category = the Exercise's category (catalog or user Exercise), never the file row.
- Exclude: validating `category` at import; fractional sets (a row counts toward its own category only); past weeks; warm-up distinction (not a concept yet).

Acceptance:
- AC-1 Two Placements of a Workout with 3 sets of a chest exercise plan 6 chest sets.
- AC-2 Logged sets count under their Exercise's category, whether or not they were planned.
- AC-3 An Exercise whose category is missing or not in the catalog list appears under "other" by name, not under a muscle.
- AC-4 Muscles with nothing planned and nothing logged do not render; order follows the catalog.
- AC-5 With no active Routine the section still shows what was logged.

Change surface:
- Expected: `src/domain/catalog/index.ts`, `src/domain/volume.ts` (+test), `src/db/repositories/history.ts`, `src/db/index.ts`, `src/features/data/queries.ts`, `src/features/progress/ProgressScreen.tsx`.
- Do not touch: Dexie schema, progression, routine-file validation.

Canonical design:
- Affected authorities: `docs/PRD.md` backlog item 8 (volume) — mark it in progress/done with this folder.
- Required synchronization: update that backlog row.

Quality:
- Tests: `weeklyVolume` unit tests for AC-1..AC-4.
- Static/build: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- QA: dev server with an imported routine and a few logged sets.

Done when: Progress shows this week's planned and logged sets per muscle for the active Routine, with uncategorized exercises listed apart.

Implementation:
1. `CATEGORIES`, `weeklyVolume` + tests.
2. Repository read and hook.
3. Section on Progress.
4. Checks and browser walkthrough.

Stop if:
- Planned volume needs data a Placement does not carry.
