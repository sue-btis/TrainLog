# Compare an exercise across routines

Status: Ready for implementation
Size: quick
Reliability: lean
Implementation effort: medium
Triggered artifacts: none

Goal: on Progress, an exercise trained under more than one Routine shows one row
per Routine, oldest first: the Routine's name, the dates it was trained there,
what was planned (from the Session snapshots) and the best set performed. Bloque
A → B → C reads as a sequence without opening each Session.

Evidence facts:
- Entry point: `src/features/progress/ProgressScreen.tsx:121` (`ExerciseProgress`, which already loads `useExerciseHistory`).
- Covering tests: `src/domain/history.test.ts` (summaries, series and records over `SessionHistory`).
- Consumers of altered contracts: no contract altered. `Session.routineId` and the `PlannedExerciseSession` snapshot already exist; nothing stored changes.

Scope:
- Include: a pure `routineBlocks(history)` in `src/domain/history.ts` grouping by `session.routineId`; distinct planned prescriptions per Routine read from snapshots (ADR 0002), never from templates; best set via the existing record rule; a "by routine" list in `ExerciseProgress`, shown only when there are two or more Routines.
- Exclude: charts per Routine, picking two Routines to diff, weekly volume, any schema change, unplanned-only exercises' plans (they have no snapshot; their row shows dates and best set only).

Acceptance:
- AC-1 Sessions from two Routines produce two rows ordered by first Session; each lists its own date span and session count.
- AC-2 A Routine whose snapshots differ (Front Squat 4×5–8 RIR 3 Monday and RIR 2 Thursday) lists both prescriptions once each.
- AC-3 Sessions with no sets for the exercise are ignored, as in the rest of history.
- AC-4 With a single Routine the list does not render.
- AC-5 Editing a template after the fact does not change a row (the row reads the snapshot).

Change surface:
- Expected: `src/domain/history.ts` (+test), `src/features/progress/ProgressScreen.tsx`.
- Do not touch: repositories, Dexie schema, `exerciseSeries`, progression.

Canonical design:
- Affected authorities: `docs/adr/0002-snapshot-planned-targets-on-session-start.md` is followed, not changed. `DESIGN.md` One Surface Rule: rows divided by hairlines inside the existing well.
- Required synchronization: none.

Quality:
- Tests: `routineBlocks` unit tests for AC-1, AC-2, AC-3.
- Static/build: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- QA: dev server with sessions under two routines; Progress shows both rows.

Done when: Progress for an exercise trained under two Routines shows two rows with their plans and best sets.

Implementation:
1. `routineBlocks` + tests.
2. Rows in `ExerciseProgress` with Routine names from `useRoutines`.
3. Checks and browser walkthrough.

Stop if:
- Routine names need a new query that changes a repository contract.
