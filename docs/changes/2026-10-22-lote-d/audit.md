# Lote D (real-season findings) Audit

Status: Ready for specification
Size: medium
Reliability: strict
Audit trigger: strict (progression rules, persisted `rir`, import path deleting placements)

## Evidence Facts
| Fact | Evidence |
|---|---|
| Entry points | Progression `src/domain/progression/index.ts:88` `lastCompletedSets`, `:197` `suggestLoad`; prefill `src/features/session/ExerciseView.tsx:351` `openingValues`; off-plan `SetLogger.tsx:324` `Field`; resume `SessionScreen.tsx:74`; backup age `SettingsScreen.tsx:393`; summary `src/domain/session-summary.ts:56`; banner `SessionDetailScreen.tsx:137`; progress `ProgressScreen.tsx:47`, `ExerciseChart.tsx:158,236`; missed `src/domain/scheduling/index.ts:100`; import `ImportWizard.tsx:180`, `src/db/repositories/import.ts:7`, `generatePlacements` `scheduling/index.ts:33`. |
| Covering tests | `progression/index.test.ts`, `history.test.ts`, `session-summary.test.ts`, `scheduling/index.test.ts`, `SetLogger.test.ts` (pure fns only), `backup/schema.test.ts`, `csv.test.ts`, `repositories/import.test.ts`, `backup.test.ts`, `safeRestore.test.ts`, `ExerciseChart.test.ts`. None for SessionScreen, SettingsScreen, ProgressScreen, calendar, Field rendering. |
| Consumers | `suggestLoad`: `PreviousPanel.tsx:19`, `ExerciseView.tsx:58` (grep `suggestLoad src`); `projectNextLoad`: tests only. `set.rir`: `history.ts:110`, `session-summary.ts:165`, `backup/csv.ts:12,42`, `backup/schema.ts:238`, `SessionDetailScreen.tsx:257`, `ExerciseHistoryScreen.tsx:142`, `SetLogger.tsx`, `SessionScreen.tsx:112,128`, `domain/session/index.ts:111,138,253` (grep). `isMissed/dayState/tallyMonth/placementState`: `CalendarScreen.tsx:41`, `MonthGrid.tsx:95`, `DaySheet.tsx:61` (grep). `importRoutine`: `ImportWizard.tsx:200` + tests. |

## Baseline
Repo `mine/TrainLog`, branch `change/routine-export`, base `b9d7f77`, working tree clean, 2026-10-22. Method: three read-only scout passes (domain, UI, import), key lines re-read.

## Findings that shape the spec
- `CompletedSet.rir: number` (types.ts:145) while planned RIR and `Settings.defaultRir` are already nullable. The `?? 0` at `ExerciseView.tsx:360` is the source of RIR 0. Backup schema `rir: measure` rejects null (schema.ts:238) → null needs `BACKUP_VERSION` 2→3 (document.ts:16). Dexie needs no migration (field unindexed). Historic 0s are indistinguishable from real 0.
- Banner shows only the set; record is e1RM incl. RIR (`history.ts:188-241`); `SessionRecord.value/previousValue` exist and are unused by the UI.
- Progression: `lastCompletedSets` filters `status==='completed'` (`:95`); contradicts AGENTS.MD "Only `completed` sessions feed it" and PRD §29 (`PRD.md:948`). `doubleProgression` takes `plannedSets/targetMax` from the *opening* exercise; the previous session's snapshot (`plannedSets`, `plannedMaxReps`, `plannedMaxTarget`) is on `ExerciseSessionHistory.exerciseSession`.
- Prefill ignores `suggestion.value` when the axis is not load (`ExerciseView.tsx:378-395`); off-plan windows come from `targetsOf` (`SetLogger.tsx:112`).
- `isMissed` is exact-date only; `tallyMonth` would also count a done-early session as "unplanned". Calendar sessions are fetched for the visible grid range only.
- `importRoutine` archives active routines but never touches their placements; `placements` indexed by `routineId` and `date`; no start-date state; `generatePlacements` is Monday-aligned and skips dates before the anchor. `AddToRoutine.tsx:56` derives `remainingWeeks` from `routine.createdAt`.
- `focus` and `notes` are on PlannedExercise (not Workout); not on the ExerciseSession snapshot; reachable via `plannedExerciseId`.
- Restore safety file name in code is already `trainlog-before-restore-<date>.json` (`safeRestore.ts:17`); the toast text at `SettingsScreen.tsx:133` omits date/extension — text is the defect.
- Chart scroll effect keys on `[data.length, metric]` (`ExerciseChart.tsx:236-241`): switching exercise with equal length keeps old scroll; first label clipped by left margin 0; flat series gets range 3 → 0.25 steps.
- Spinner glyph on "Days and weeks": no code cause found; needs reproduction in a browser.

## Contradictions and Risks
- AGENTS.MD invariant + PRD §29 + `SessionDetailScreen.tsx:214,217` copy must be rewritten with the progression rule.
- ADR 0001 / PRD §11.3 say missed = past placement without Session; same-week early rule extends it (derived, nothing written) → PRD wording update.
- Done-early near month borders may miss sessions outside the fetched grid range (accepted limit).
- Changing `generatePlacements` to N×7 days from anchor changes `remainingWeeks` semantics.

## Candidate Ownership (one writer, sequential)
domain: `types.ts`, `history.ts`, `session-summary.ts`, `progression`, `scheduling`, `backup/{schema,document,csv}`, `session/index.ts`; db: `repositories/import.ts`, `backup.ts`, `placements.ts`; features: session, history, settings, progress, import, calendar, routines/AddToRoutine; docs: AGENTS.MD, PRD.md, CONTEXT.md.

## Do Not Touch
`docs/bloque-*.yaml`, `.impeccable`, `.claude/worktrees`, migrations of Dexie stores.

## Recommended Next Step
Write spec.
