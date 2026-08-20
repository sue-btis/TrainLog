# Gym Mode — the session execution screen — Spec

Status: Ready for planning
Size: medium
Reliability: strict
Base: `master` at `6dbb8d9`, clean working tree

## Goal

A lifter can train. They open Today, press `Start workout`, and the phone shows
one exercise: what the programme asked for, what they did last time, and the set
they are about to perform. They log it, a rest timer starts, they work through
the session, and they finish it. If the phone dies mid-session, reopening the app
puts them back exactly where they were with nothing lost.

Done when a Session can be started from Today, every set is on disk the moment it
is logged, the rest timer stays correct across a locked phone, all five deviations
of FR-14/FR-15 are reachable, the session can be finished, and the dev harness is
gone because the product no longer needs it.

## Evidence and Current Behavior

Everything the execution flow needs already exists and is tested by
`docs/changes/2026-08-18-technical-spine/`. **No part of it is rebuilt.**

Domain — pure, clock-injected, unit-tested:

- `src/domain/session/index.ts` — `startSession`, `startPlannedExercise` (the
  ADR-0002 snapshot), `startUnplannedExercise`, `logSet` (returns the
  `CompletedSet` *and* the ExerciseSession moved to `performed`), `skipExercise`,
  `deriveSessionStatus`, `finishSession`.
- `src/domain/progression/index.ts` — `suggestLoad(exercise, history)` accepts a
  `PlannedExercise` **or** an `ExerciseSession` snapshot and returns
  `{ weight, unit, weightKg, targetMet }` or `null`. `null` for an unplanned
  exercise and for an exercise with no completed history.
- `src/domain/catalog/index.ts` — `CATALOG` ships in the build; catalog
  Exercises are never written to the `exercises` table (DEC-007).
- `src/domain/units.ts` — `toKg`. `src/domain/dates.ts` — `Timestamp`,
  `formatLocalDate`.

Persistence:

- `src/db/repositories/sessions.ts` — `createSession` refuses a second
  `in_progress` Session in one transaction (`SessionInProgressError`);
  `getInProgressSession` is the §35 recovery read; `saveFinishedSession` writes
  the Session and its ExerciseSessions together.
- `src/db/repositories/completedSets.ts` — `saveLoggedSet` writes the set and the
  `performed` transition in one transaction. **This is NFR-03's guarantee and is
  already correct.**
- `src/db/repositories/exerciseSessions.ts` — `addExerciseSession`,
  `saveExerciseSession` (single put), `listExerciseSessionsBySession` (sorted by
  `order`). No bulk write exists.
- `src/db/repositories/history.ts` — `getSessionDetail`, `getPreviousPerformance`,
  `listExerciseHistory`.
- `src/db/repositories/exercises.ts` — `listUserExercises`, `getExerciseNames`.
  **There is no write path; no Exercise can be created.** See A-1.
- `src/db/repositories/settings.ts` — `getDefaultUnit`. `Settings` holds
  `defaultUnit` and nothing else. See A-2.
- `src/db/schema.ts` — version 1 already declares every index this change reads:
  `sessions.status`, `sessions.startedAt`, `exerciseSessions.sessionId`,
  `exerciseSessions.exerciseId`, `completedSets.exerciseSessionId`. The file
  states that nothing outside it may add a table or index at version 1.
  **No schema change is required or permitted.**

Design — gym mode is already specified in `DESIGN.md`; this change implements it
rather than inventing it:

- `DESIGN.md:833-849` — **The Dome**, the signature component: one dome is one
  Set, keyed `planned | live | logged | suggested | missed | locked`, 76px
  default / 96px live, `animate-breathe` when live, an `aria-label` spelling out
  set number, state and load.
- `DESIGN.md:908-912` — **Rest timer**: the one full-bleed coloured surface,
  `live-ink` shell, white `type-clock`, a `scrim` track with a `live-rail` fill
  that **scales** as the rest runs out.
- `DESIGN.md:903-906` — the set logger's weight/reps/RIR readouts are `well`,
  flat, value in `type-readout`, unit as a smaller inline span, and
  **"adjustment is by ±2.5 stepper domes, not keyboard entry."**
- `DESIGN.md:358-360` — Signal Amber is only what is happening right now.
- `src/styles/theme.css` — every token needed exists: `--color-live`,
  `--color-live-ink`, `--color-live-rail`, `--color-on-live`, `--color-scrim`,
  `type-clock`, `type-readout`, `--animate-breathe`, `--shadow-dome-lift`.
  **No new token is expected.**
- `src/features/ui/styles.ts` — the class vocabulary (`SCREEN`, `COLUMN`, `CARD`,
  `WELL`, `RULED`, `chip`, `alert`, `FOCUS_RING`, `PRESS`, `ICON_STROKE`). It is
  where a Dome's classes belong; a colour literal in a `.tsx` violates the
  Token-Only Rule.

Current gaps — what does not exist:

- No execution screen and no route to one. `src/App.tsx` routes `/today`,
  `/calendar`, `/routines`, `/import`, `/harness`.
- `src/features/today/TodayScreen.tsx` carries **no `Start workout`** and shows an
  alert pointing an open session at `/harness`.
- `src/features/harness/` (4 files) is the only way to write a Session today.
- No rest timer, no wake lock, no order write, no session-start transaction.

## Scope

Included:

- Starting a Session from Today, snapshotting every PlannedExercise in one
  transaction (DEC-1).
- The gym-mode screen at `/session`: one exercise at a time, outside the app
  shell (§21).
- Set logging with the Dome strip, stepper adjustment, previous performance
  (§11.8) and the progression suggestion as the opening load (§11.9).
- The rest timer (§11.6): auto-start, pause, reset, skip, add time — derived from
  a stored instant, never a counter (§35).
- Screen Wake Lock while a session is open, degrading silently (§11.6).
- Deviations (FR-14, FR-15): extra sets, fewer sets, skip exercise, reorder
  exercises, add an unplanned exercise.
- Finishing a Session, with `completed`/`partial` derived (§36, DEC-009).
- Recovery: reopening the app resumes the open Session (§35).
- Deleting `src/features/harness/` and its route (DEC-4).

Excluded:

- Creating a **new** Exercise by name. An unplanned exercise is picked from the
  bundled catalog and existing user Exercises (A-1).
- Settings for timer sound, timer vibration and wake lock (§32) — there is no
  Settings screen and `Settings` holds only `defaultUnit` (A-2).
- **Timer sound.** Vibration ships; sound needs a bundled audio asset and the
  §32 setting that gates it. Both arrive with Settings.
- Notifications — §11.6 puts them outside the MVP explicitly.
- Substituting an exercise as its own mechanism. §11.5: a substitution *is* skip
  plus unplanned, and must not grow a third path.
- Editing or deleting a set already logged, and editing a finished Session.
- Exercise history screen (§11.10), progress dashboard (§11.11), Settings,
  backup, restore, CSV export, PWA.
- Any Dexie schema change, any new dependency, any new design token, any change
  to `domain/progression` or `domain/scheduling`.

## Decisions and Assumptions

- **DEC-1** — Starting a Workout snapshots **every** PlannedExercise into
  ExerciseSessions in one transaction with the Session. Approved. Lazy
  per-exercise snapshotting would leave an untouched exercise with no row, so
  `deriveSessionStatus` would report `completed` for a session in which nothing
  was done, and reorder would have nothing to reorder.
- **DEC-2** — One exercise fills the screen (§21). Approved.
- **DEC-3** — All five deviations of FR-14/FR-15 ship in this change. Approved.
- **DEC-4** — `src/features/harness/` is deleted. Approved. The real screen
  supersedes it, and two ways to write a Session is two ways to be wrong.
- **DEC-5** — Adjustment is by steppers, not keyboard entry
  (`DESIGN.md:903-906`). Weight steps by the exercise's own
  `progression.increment` where the rule is `double_progression`, otherwise by
  2.5. Reps and RIR step by 1. This removes free-text parsing and its validation
  entirely.
- **A-1** — An unplanned exercise is *picked*, never *created*. Provenance: the
  exercises repository has no write path, and adding one drags in the §26
  name-normalization and dedupe rules. **Stop if** the catalog turns out not to
  cover the picker's needs — that is a scope decision, not an implementation one.
- **A-2** — Wake lock is requested unconditionally and vibration fires
  unconditionally, because the §32 settings that would gate them do not exist.
  Provenance: `Settings` in `src/domain/types.ts` holds `defaultUnit` only.
  **Stop if** implementing either requires a `Settings` field — that is a schema
  change and is excluded.
- **A-3** — Rest **pause** and **added time** are component state, not persisted.
  The countdown itself is derived from the last set's stored `completedAt`
  (§35), so a reload rebuilds a correct countdown; it simply forgets that the
  lifter had paused it. Provenance: `CompletedSet.completedAt` is already
  persisted by `saveLoggedSet`, and §35 requires only that the timer be
  reconstructed from a stored instant. Persisting pause state would need a
  schema change, which is excluded.
- **A-4** — An unplanned exercise logs in the settings default unit
  (`getDefaultUnit`), because it has no PlannedExercise to take a unit from and
  §11.7 fixes unit per Exercise, not per set.

## Requirements and Acceptance

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-1 | Today offers `Start workout` for the shown Workout. With a Session already `in_progress`, it offers `Resume session` instead and starting is not possible. | AC-1: Pressing `Start workout` navigates to `/session` and a Session exists in `sessions` with `status: 'in_progress'`. AC-2: With one open, Today shows `Resume session`, no `Start workout` is rendered, and the §35 alert no longer mentions the harness. |
| R-2 | Starting a Workout writes the Session and one ExerciseSession per PlannedExercise, in `order`, in a single transaction. Each ExerciseSession carries the targets copied by value from its PlannedExercise (ADR 0002). | AC-3: After starting a Workout with N planned exercises, `listExerciseSessionsBySession` returns N rows in planned order, each `pending`, each carrying `plannedSets`/`plannedMinReps`/`plannedMaxReps`/`plannedMinRir`/`plannedMaxRir`/`plannedRestSeconds`/`plannedProgression` equal to the template's. AC-4: Editing or re-importing the Routine afterwards does not change a single stored value. AC-5: A failure partway leaves neither the Session nor any ExerciseSession behind. |
| R-3 | Starting while another Session is `in_progress` is refused, surfacing `SessionInProgressError` rather than creating a second. | AC-6: `sessions` never holds two rows with `status: 'in_progress'`. |
| R-4 | `/session` renders one exercise at a time: its name, the programmed target line, rest, the previous performance (§11.8), the Dome strip for its sets, and the set logger. Nothing else competes with those controls (§21). It renders its own frame, outside `AppShell`, with no bottom navigation. | AC-7: `/session` shows exactly one exercise's controls and no `BottomNav`. AC-8: Moving to the next or previous exercise changes which exercise is shown and nothing else. |
| R-5 | The set logger opens on the progression suggestion where one exists (§11.9, §20 "previous values as defaults"), on the previous session's load where the engine returns `null` but history exists, and empty otherwise. Weight, reps and RIR are adjusted by steppers (DEC-5). | AC-9: For an exercise whose last completed session met the target, the weight readout opens at `suggestLoad`'s `weight` in that suggestion's `unit`. AC-10: For an unplanned exercise, no suggestion is claimed and the readout opens empty. |
| R-6 | Completing a set persists it immediately: the `CompletedSet` and the `performed` transition, together (NFR-03). Weight is stored as entered with its unit **and** as `weightKg`. | AC-11: Immediately after `COMPLETE SET`, a row exists in `completedSets` with `weight`, `unit`, `weightKg`, `reps`, `rir`, `setNumber`, `completedAt`, and its ExerciseSession reads `performed`. AC-12: Reloading the page mid-exercise shows every set already logged. |
| R-7 | Completing a set starts the rest timer where the exercise has a `plannedRestSeconds`. The timer allows pause, reset, skip and add time, and its remaining time is computed against the clock from a stored instant — never from an interval's accumulated ticks. | AC-13: With the tab hidden or the phone locked for 60s during a 180s rest, the timer reads ~120s remaining on return, not ~180s. AC-14: Reloading during a rest rebuilds a countdown consistent with the last set's `completedAt`. AC-15: Skip dismisses it; reset restarts it at the planned duration; add time extends it. |
| R-8 | While a Session is open the screen is kept awake, and where `Screen Wake Lock` is unavailable or refused the app degrades silently. | AC-16: No error is surfaced and no behavior changes on a browser without `navigator.wakeLock`. AC-17: The lock is released when the session screen is left. |
| R-9 | The lifter may log more sets than planned, fewer, or skip the exercise entirely. Deviation is indicated by colour and never blocks or errors (§11.5). | AC-18: A set beyond `plannedSets` is logged and stored with the next `setNumber`; no error appears. AC-19: Skipping sets an ExerciseSession to `skipped`; it is not `pending` and does not make the Session partial. AC-19b: An exercise that deviated from its plan — extra sets, fewer sets, skipped, unplanned — is marked by a chip in the hue of that state, and no error or block appears anywhere in the flow. |
| R-10 | The lifter may reorder the exercises of the open Session. Reordering rewrites `order` on the affected ExerciseSessions and never touches the Routine or its PlannedExercises. | AC-20: After moving an exercise, `listExerciseSessionsBySession` returns the new order, `order` values remain a contiguous 0-based sequence, and every `plannedExercises` row is byte-identical to before. |
| R-11 | The lifter may add an unplanned exercise, chosen from the bundled catalog or an existing user Exercise. It carries no targets, receives no progression suggestion, and is marked as unplanned. | AC-21: The added ExerciseSession has `plannedExerciseId: null` and no `planned*` fields. AC-22: No suggestion is shown for it. AC-23: Sets logged against it are stored in the settings default unit. |
| R-12 | Finishing derives the Session's status: `completed` when no ExerciseSession is `pending`, `partial` otherwise. Finishing with pending exercises asks first and names the consequence. | AC-24: Finishing with every exercise `performed` or `skipped` stores `completed`; finishing with one `pending` stores `partial`. AC-25: `completedAt` is stamped. AC-26: After finishing, `/session` no longer holds an open Session and Today offers `Start workout` again. |
| R-13 | Reopening the app with a Session `in_progress` resumes it, with every set already logged present (§35). | AC-27: Closing the tab mid-session and navigating to `/session` shows the same Session, the same exercise order and every logged set. |
| R-14 | The dev harness is gone: no `/harness` route, no `src/features/harness/`, and nothing links to it. | AC-28: `rg -n "harness" src/` returns nothing. AC-29: `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` all pass afterwards. |

## Contracts and Risk Controls

Changed:

- `src/domain/session/index.ts` gains pure functions only — no existing signature
  changes. Expected: a composite that produces a Session with its ExerciseSessions
  from a Workout's PlannedExercises (R-2); a reorder that renumbers `order`
  (R-10); the rest-remaining arithmetic (R-7).
- `src/db/repositories/sessions.ts` gains a transactional start that writes the
  Session **and** its ExerciseSessions together (R-2), preserving the
  `SessionInProgressError` refusal inside the same transaction.
- `src/db/repositories/exerciseSessions.ts` gains a bulk write for reorder (R-10).
- `src/db/index.ts` re-exports the new repository functions.
- `src/App.tsx` gains `/session` and loses `/harness`.
- `src/features/ui/styles.ts` gains the Dome and rest-timer class vocabulary.

Preserved — a change to any of these is out of scope and a stop condition:

- The Dexie schema, at version 1. No table, no index, no stored field.
- `logSet`, `skipExercise`, `finishSession`, `deriveSessionStatus`,
  `startPlannedExercise`, `startUnplannedExercise` — behavior and signatures.
- `saveLoggedSet`'s single-transaction guarantee (NFR-03).
- No domain function reads the clock; every instant is a parameter (DEC-008).
- `plannedExerciseId` is provenance only. Nothing may read a target back through
  it (ADR 0002).
- Progression stays derived, with nothing stored (§11.9).
- A Session never references a Placement (ADR 0001).
- `features → db → domain`. No component imports `dexie`; reads go through
  `useLiveQuery` hooks in `src/features/data/queries.ts`.
- The Token-Only Rule and the No-Dark-Variant Rule (`DESIGN.md`).
- The Offline Rule: no network request at runtime, no new dependency.

Risk controls:

- The at-most-one-`in_progress` invariant has no window in which it is false —
  the check and both writes share one transaction (R-2, R-3).
- Durability is verified by reload, not by inspection (AC-12, AC-14, AC-27).
- Reorder must be shown not to touch the template (AC-20); rewriting a
  PlannedExercise from the session screen would break routine immutability.

## Quality Obligations

- Tests (Vitest): unit tests for every new pure function in
  `src/domain/session/index.test.ts` — the composite start (order, snapshot
  fidelity, empty-workout case), reorder (bounds, contiguity, no-op at the ends),
  and rest-remaining (elapsed, exhausted, added time, negative clamp).
- Tests: `src/db/repositories/sessions.test.ts` against `fake-indexeddb` for the
  transactional start — the N+1 rows written together, the second-session
  refusal, and the atomicity of AC-5.
- QA (AGENTS.MD: "UI is verified by running it"), each reproducible in the dev
  server: start a session from Today; log a set and reload the page; background
  the tab for 60s during a rest; log an extra set; skip an exercise; reorder two
  exercises and confirm the Routine detail screen is unchanged; add an unplanned
  exercise; finish with a pending exercise and confirm `partial`.
- Static/build: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all
  green (AC-29).
- Coverage: every new `src/domain/` function carries tests. Domain is where
  correctness lives; the screen is verified by running it.

## Change Surface

Expected edits:

- `src/domain/session/index.ts`, `src/domain/session/index.test.ts`
- `src/db/repositories/sessions.ts`, `src/db/repositories/sessions.test.ts`
- `src/db/repositories/exerciseSessions.ts`
- `src/db/index.ts`
- `src/features/data/queries.ts`
- `src/features/session/` — new; the screen and its parts
- `src/features/ui/styles.ts`
- `src/features/today/TodayScreen.tsx`
- `src/App.tsx`
- Deleted: `src/features/harness/` (`Harness.tsx`, `SessionPanel.tsx`,
  `queries.ts`, `styles.ts`)
- `CONTEXT.md` — only if a term is settled during the work (AGENTS.MD)

Do not touch:

- `src/db/schema.ts`, `src/db/database.ts`
- `src/domain/progression/`, `src/domain/scheduling/`, `src/domain/routine-file/`,
  `src/domain/catalog/`, `src/domain/units.ts`, `src/domain/dates.ts`
- `src/db/repositories/completedSets.ts`, `history.ts`, `routines.ts`,
  `placements.ts`, `plannedExercises.ts`, `workouts.ts`, `import.ts`
- `src/features/import/`, `src/features/calendar/`, `src/features/routines/`
- `src/styles/theme.css`, `DESIGN.md`, `docs/PRD.md`
- `package.json`

## Planning Decision

Plan required: **Yes**.

Reason: the slices have a real dependency order that is not obvious from the
requirements. The transactional session start (R-2) must land and be tested
before the screen can read anything; the screen frame must exist before the
deviations attach to it; and the harness deletion (R-14) must land **last**,
because it is the only way to write a Session until the real screen works, and
deleting it early removes the fallback for verifying the persistence layer.
Reorder and the unplanned picker are independently verifiable and can be
sequenced or dropped without disturbing the rest.

## Stop Conditions

Stop and raise rather than inventing behavior if:

- a requirement appears to need a Dexie schema change, a new index, or a new
  stored field;
- a requirement appears to need a new dependency, a runtime network request, or
  a new design token;
- implementing R-11 requires creating an Exercise (A-1 false);
- implementing R-7 or R-8 requires a `Settings` field (A-2 false);
- a target would have to be read back through `plannedExerciseId` (ADR 0002);
- reordering or logging would have to write to `plannedExercises`, `workouts` or
  `routines` (routine immutability);
- repository evidence contradicts a requirement above;
- unrelated working-tree changes overlap the write set.
