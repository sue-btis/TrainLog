# Gym Mode Refinements and Exercise History — Spec

Status: Ready for planning
Size: medium
Reliability: strict
Base: `change/gym-mode` (gym mode implemented and verified, uncommitted)

## Goal

Six changes a lifter asked for after using gym mode.

Entering a number is no longer only a stepper: the readout takes typing too.
Rest can be extended by whatever the lifter chooses, not a fixed 30 seconds.
When the planned sets are done the green button stops asking for another one and
offers the next exercise instead. A set logged by mistake can be corrected or
removed. Every set of an exercise is visible at once rather than hidden behind a
sideways scroll. And each exercise gets the history screen §11.10 describes —
working weight, best set, session count, last performed, and every session with
its sets — reachable from gym mode and from the routine detail.

Done when all six behave as described, a deleted set leaves history consistent,
and the history screen renders §11.10's figures from real data.

## Evidence and Current Behavior

- `src/features/session/SetLogger.tsx` — `Field` renders a `READOUT` div between
  two stepper buttons. **Not an input**: there is no typing path and nothing to
  parse. `Complete set` is disabled at `reps === 0`.
- `src/features/session/RestTimer.tsx` — `BUMP_SECONDS = 30`, a single
  `Add 30 seconds` control. `added` is component state, not persisted (A-3 of
  the previous change).
- `src/features/session/ExerciseView.tsx` — `DomeStrip` renders
  `Math.max(plannedSets, setNumber)` domes inside
  `-mx-4 flex gap-3 overflow-x-auto px-4` — **the horizontal scroll to remove**.
  `openingValues` prefers the last logged set, then the suggestion, then the
  previous session's opening set.
- `src/db/repositories/completedSets.ts` — `saveLoggedSet` (add + status
  transition, one transaction), `listCompletedSetsByExerciseSession`,
  `groupCompletedSetsByExerciseSession`. **No update, no delete.**
- `src/domain/session/index.ts` — `logSet` builds a `CompletedSet` and moves its
  ExerciseSession to `performed`. There is no inverse: nothing returns an
  exercise to `pending`.
- `src/db/repositories/history.ts` — `listExerciseHistory(exerciseId)` returns
  `SessionHistory[]` newest first, spanning Routines, keyed by `exerciseId`
  (§26). `getPreviousPerformance` returns **exactly one** session — the most
  recent with any sets, current session excluded. This is what the PREVIOUS card
  shows today.
- `src/domain/progression/index.ts` — `suggestLoad`. Its private
  `lastCompletedSets` filters to `completed` sessions; nothing exported computes
  a best set, a max, a min or a session count.
- `src/features/data/queries.ts` — `useExerciseHistory`, `usePreviousPerformance`,
  `useExerciseNames` already exist.
- `src/App.tsx` — routes `/today`, `/calendar`, `/routines`,
  `/routines/:routineId` inside `AppShell`; `/import` and `/session` outside it.
- `src/features/routines/RoutineDetailScreen.tsx` — lists a Routine's Workouts
  and their PlannedExercises. A natural second entry point to an exercise's
  history.
- `src/db/schema.ts` — v1, frozen. `completedSets.exerciseSessionId` and
  `exerciseSessions.exerciseId` are declared; every read and write below is
  served by an existing index. **No schema change is required or permitted.**
- `src/features/ui/styles.ts` — `dome()`, `STEPPER`, `READOUT`, `TIMER_*`,
  `CARD`, `WELL`, `ROW_LIST`, `ROW`, `RULED`, `chip()`, `field()`.
  `field(invalid)` is the existing input face; `src/components/ui/input.tsx`
  wears it.

## Scope

Included:

- **R-1 Dual input** — weight, reps and RIR accept typing as well as stepping.
- **R-2 Custom rest extension** — the lifter chooses how much time to add.
- **R-3 Next exercise** — once the planned sets are logged, the primary action
  advances instead of asking for another set. An extra set stays reachable.
- **R-4 Edit and delete a logged set**, current session only.
- **R-5 No sideways scroll** on the set domes.
- **R-6 Exercise History screen (§11.10)** — its own route, reachable from gym
  mode and from the routine detail.

Excluded:

- Editing or deleting sets of a **past** session. Approved decision: gym mode
  edits the session being trained; history is history.
- Editing a finished Session's status, date, or which Workout it came from.
- The Progress dashboard (§11.11), charts, and any charting dependency.
- Estimated 1RM, PR detection, volume — §39 puts them after the MVP.
- Settings, backup, restore, CSV export, PWA.
- Any Dexie schema change, new dependency, or new design token.
- Persisting rest-timer state. It stays component state, as before (A-3).

## Decisions and Assumptions

- **DEC-1** — The history view is the full §11.10 screen on its own route, not a
  panel inside gym mode. Approved.
- **DEC-2** — Only the current session's sets are editable and deletable.
  Approved. Editing a months-old set would silently change what progression
  suggests today.
- **DEC-3** — Deleting a set renumbers the remaining sets of that exercise to a
  contiguous `1..n`. `setNumber` is a position, not an identity, and §29 reads
  "the first N sets" — a gap would make that ambiguous.
- **DEC-4** — Deleting the last remaining set of an exercise returns it to
  `pending`. `performed` means "sets were logged here"; leaving it `performed`
  with none would make `deriveSessionStatus` call a session `completed` in which
  that exercise was, in the end, not done (DEC-009 of the previous change).
- **DEC-5** — Typing and stepping edit the same value; neither is authoritative.
  The field commits on blur and on Enter, and rejects nothing silently — an
  unparseable or negative entry reverts to the last good value.
- **A-1** — "Best set" is the heaviest set by `weightKg`, ties broken by reps.
  §11.10 shows `77.5 × 5` without defining it. Stop if a different definition is
  required — it changes a displayed figure, not a stored one.
- **A-2** — "Current working weight" is the `weightKg` of the most recent
  completed session's heaviest set, shown in that set's own unit. §11.10 names
  the figure without defining it, and §11.9 forbids storing one.
- **A-3** — Max and min are over sets of `completed` **and** `partial` sessions,
  matching §11.8's rule that history shows what happened. Only progression
  restricts itself to `completed` (§11.9).

## Requirements and Acceptance

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-1 | Weight, reps and RIR can be typed directly as well as stepped. The two paths edit one value. A committed entry that is not a non-negative number reverts to the previous value rather than being stored. | AC-1: Typing `62.5` into weight and blurring leaves the readout at `62.5`; logging stores `62.5`. AC-2: Stepping after typing continues from the typed value. AC-3: Typing `abc` or `-5` and blurring restores the prior value; nothing is logged from it. AC-4: The numeric keypad is what a phone offers for these fields. |
| R-2 | The lifter chooses how much rest to add, rather than a fixed amount. | AC-5: A rest can be extended by an amount the lifter picks, and the countdown and the rail both reflect the new total. AC-6: The choice does not persist across a reload, consistent with pause (A-3 of the previous change). |
| R-3 | While fewer than the planned sets are logged, the primary action completes a set. Once the planned count is reached it advances to the next exercise instead — and on the last exercise it offers to finish. Logging an extra set remains possible (FR-14). | AC-7: On a 4-set exercise the primary action reads `Complete set` for sets 1–4 and changes after the 4th. AC-8: Pressing it then shows the next exercise. AC-9: An extra 5th set can still be logged, and is stored with `setNumber: 5`. AC-10: An exercise with no planned count (unplanned) never switches — it has no target to reach. |
| R-4 | A set logged in the current session can be corrected or removed. Editing recomputes `weightKg` from the entered value and unit. Deleting asks first (§37), renumbers the remaining sets contiguously, and returns the exercise to `pending` when none remain. | AC-11: Editing a set's weight/reps/RIR updates the stored row, and `weightKg` matches the new weight and unit. AC-12: Deleting set 2 of 3 leaves sets numbered 1 and 2, with the original set 3's values now at position 2. AC-13: Deleting the only set of an exercise returns its ExerciseSession to `pending`. AC-14: Deletion is confirmed before it happens. AC-15: Sets of a session that is not `in_progress` are not editable from gym mode. |
| R-5 | Every set of an exercise is visible without scrolling sideways. | AC-16: The dome strip has no horizontal scroll; with more domes than fit a row they wrap onto the next. |
| R-6 | Each exercise has the screen §11.10 describes: its name, current working weight, best set, session count, last performed date, and every session with its sets and reps, newest first. Reachable from gym mode and from the routine detail. | AC-17: The screen shows all five figures for an exercise with history. AC-18: Sessions are listed newest first, each with its date and its sets as `weight × reps`. AC-19: An exercise never performed renders an empty state, not zeros or a crash. AC-20: A `History` control in gym mode opens the current exercise's screen and returns to the open session. AC-21: The screen is reachable from the routine detail. |

## Contracts and Risk Controls

Changed:

- `src/domain/session/index.ts` gains pure functions for editing a set and for
  removing one — the latter returning the renumbered survivors and the
  ExerciseSession's resulting status (DEC-3, DEC-4).
- New `src/domain/history.ts` — pure derivation of §11.10's figures from
  `SessionHistory[]`. No storage, consistent with §11.9.
- `src/db/repositories/completedSets.ts` gains an update and a transactional
  delete that writes the renumbered sets and the ExerciseSession together.
- `src/db/index.ts` re-exports both.
- `src/features/session/` — `SetLogger` (R-1, R-3), `RestTimer` (R-2),
  `ExerciseView` (R-3, R-4, R-5), `SessionScreen` (R-3, R-6 entry).
- New `src/features/history/` — the §11.10 screen.
- `src/App.tsx` — the new route.
- `src/features/routines/RoutineDetailScreen.tsx` — the second entry point.

Preserved — changing any of these is out of scope and a stop condition:

- The Dexie schema at version 1. No table, index, or stored field.
- `logSet`, `startWorkout`, `startPlannedExercise`, `skipExercise`,
  `finishSession`, `deriveSessionStatus`, `restRemaining`,
  `reorderExerciseSessions` — behavior and signatures.
- `saveLoggedSet`'s single-transaction guarantee (NFR-03).
- Progression stays derived, with nothing stored (§11.9). `suggestLoad` is not
  touched.
- Targets are never read back through `plannedExerciseId` (ADR 0002).
- A `CompletedSet` keeps `weight` as entered, its `unit`, and a derived
  `weightKg`; every comparison reads `weightKg` (§11.7).
- `features → db → domain`. No component imports `dexie`.
- The Token-Only Rule and the No-Dark-Variant Rule (DESIGN.md).
- No runtime network request; no new dependency.

Risk controls:

- Delete is the one destructive operation here. It must be transactional: the
  removal, the renumbering and any status change are one fact (DEC-3, DEC-4).
- Deleting changes what progression reads. R-4's tests must show that an
  exercise whose sets are all deleted stops feeding a suggestion.
- R-1 introduces the first parsed user input in gym mode. Its rejection path is
  a required behavior, not a nicety (AC-3).

## Quality Obligations

- Tests: unit tests in `src/domain/session/index.test.ts` for editing a set
  (`weightKg` recomputed, including a unit change) and for removing one
  (renumbering, last-set-returns-pending, removing an id the list lacks).
- Tests: `src/domain/history.test.ts` for every §11.10 figure — empty history,
  single session, ties on best set, a `partial` session included in max/min but
  excluded from working weight.
- Tests: `src/db/repositories/completedSets.test.ts` (new) against
  `fake-indexeddb` for the transactional delete — survivors renumbered, status
  reverted, nothing orphaned.
- QA, reproducible in the dev server: type a weight and log it; type garbage and
  confirm it reverts; add a custom rest amount; log the 4th of 4 sets and use
  the advance; log a 5th anyway; edit a set; delete the middle set of three;
  delete the last set of an exercise; count the domes without scrolling; open
  History from gym mode and from the routine detail.
- Static/build: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- Strict profile: changed-line coverage ≥90%, changed-branch ≥80%, and targeted
  mutation testing on the new pure logic — `stryker.config.json` already mutates
  `src/domain/session/index.ts`, and `src/domain/history.ts` is added to it.

## Change Surface

Expected edits:

- `src/domain/session/index.ts`, `index.test.ts`
- `src/domain/history.ts`, `src/domain/history.test.ts` — new
- `src/db/repositories/completedSets.ts`, `completedSets.test.ts` — new test file
- `src/db/index.ts`
- `src/features/data/queries.ts`
- `src/features/session/{SetLogger,RestTimer,ExerciseView,SessionScreen}.tsx`
- `src/features/history/` — new
- `src/features/ui/styles.ts` — only if a face is missing
- `src/features/routines/RoutineDetailScreen.tsx`
- `src/App.tsx`
- `stryker.config.json` — add the new domain file to `mutate`

Do not touch:

- `src/db/schema.ts`, `src/db/database.ts`
- `src/domain/progression/`, `src/domain/scheduling/`, `src/domain/routine-file/`,
  `src/domain/catalog/`, `src/domain/units.ts`, `src/domain/dates.ts`
- `src/db/repositories/` other than `completedSets.ts` and `index.ts`
- `src/features/import/`, `src/features/calendar/`, `src/features/today/`
- `src/styles/theme.css`, `DESIGN.md`, `docs/PRD.md`, `package.json`

## Planning Decision

Plan required: **Yes**.

Reason: the domain and persistence for set editing must land before its UI, the
history screen is independently implementable and shippable on its own, and the
four gym-mode refinements are small and unordered among themselves. That is three
distinct shapes of work, and their ordering is not obvious from the requirements.

## Stop Conditions

- A requirement appears to need a schema change, a new index, or a new stored
  field.
- A requirement appears to need a new dependency or a new design token.
- Deleting or editing a set would have to write to `plannedExercises`,
  `workouts` or `routines`.
- §11.10 turns out to require a figure A-1 or A-2 defines differently.
- Implementing R-6 requires charting.
- Unrelated working-tree changes overlap the write set.
