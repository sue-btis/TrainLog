# Empty routine accepted — Spec

Status: Ready for implementation
Size: quick
Reliability: strict
Base: `master` at `49efc78`, working tree clean in `src/`.

## Goal

A routine file that declares no Workouts is flagged in the wizard and cannot be
accepted, instead of being written as an empty Routine that displaces the
lifter's real one.

Done when: `validateRoutineFile` reports an issue for a routine with zero
Workouts, `Accept` is blocked while it stands, and no other semantic behaviour
changes.

Origin: finding **R-2** of
[`docs/changes/2026-08-24-routine-authoring/audit.md`](../2026-08-24-routine-authoring/audit.md),
raised during the audit for that change and split out here by decision DEC-Q5.

## Evidence and Current Behavior

Verified by direct read at `49efc78`, and by two independent adversarial
verifiers during the routine-authoring audit — one of which executed the actual
repository modules through `jiti` rather than a replica.

- **The structural tier accepts it.** `routineFileSchema` declares
  `workouts: z.array(workoutSchema)` with no `.min()` and no `.nonempty()`
  ([`schema.ts:79`](../../../src/domain/routine-file/schema.ts)). A repo-wide
  grep for `.min(`/`nonempty` across `src/domain` hits only
  `src/domain/backup/schema.ts`.
- **The semantic tier accepts it.** `validateRoutineFile` is two nested
  `forEach` loops over `routine.workouts` and `workout.exercises`, plus
  `sharedSuggestedDays`, which builds its Map from the same empty loop
  ([`validate.ts:39-99,102-123`](../../../src/domain/routine-file/validate.ts)).
  An empty array iterates zero times, so the function returns `[]`. There is no
  arity check anywhere in it.
- **`Accept` is therefore enabled.** The gate is `blocked = issues.length > 0`
  ([`ActionBar.tsx:62`](../../../src/features/import/ActionBar.tsx)), re-checked
  in the handler as `issues.length > 0`
  ([`ImportWizard.tsx:138`](../../../src/features/import/ImportWizard.tsx)).
- **Nothing downstream refuses it.** `importRoutine` has no arity guard: it does
  `db.routines.add` then three `bulkAdd` calls with empty arrays
  ([`import.ts:38-58`](../../../src/db/repositories/import.ts)).
- **The consequence.** Because a draft always arrives `active`, `importRoutine`
  archives every other active Routine in the same transaction
  ([`import.ts:47-51`](../../../src/db/repositories/import.ts)). Accepting an
  empty file therefore leaves the lifter with an empty active Routine, Today
  rendering "*{name}* has no Workouts"
  ([`TodayScreen.tsx:161-163`](../../../src/features/today/TodayScreen.tsx)),
  and their real programme archived.

**Severity, stated honestly.** This is disruptive, not destructive.
`archiveRoutine` leaves Sessions and history untouched (§37), and re-activation
is two taps from the Routines screen
([`RoutinesScreen.tsx:170`](../../../src/features/routines/RoutinesScreen.tsx)).
Nothing is lost; the lifter has to work out what happened and undo it.

## Scope

**In:**

- One new `SemanticIssueCode` for a routine that declares no Workouts.
- The check in `validateRoutineFile`.
- Its recovery sentence in the wizard's `FIX` map and its `problemOf` case.
- One regression test.

**Out:**

- **A Workout with zero exercises.** Deliberately left valid. It is supported
  end to end — `createStartedWorkout` guards
  `if (started.exerciseSessions.length > 0)`
  ([`sessions.ts:71-73`](../../../src/db/repositories/sessions.ts)) and
  `SessionScreen` renders a dedicated well for it — and `deleteExercise`'s
  contract explicitly permits emptying a Workout so the wizard cannot trap a
  user ([`edit.ts:49-52`](../../../src/domain/routine-file/edit.ts)). Flagging it
  would break documented behaviour.
- **A guard inside `importRoutine`.** Its header states the layering intent:
  "this function decides nothing, it only writes"
  ([`import.ts:22-24`](../../../src/db/repositories/import.ts)). Validation
  belongs in the semantic tier, which is where §11.1 puts it.
- Any bound on `weeks`, and any other missing numeric check. Real, but separate.

## Decisions and Assumptions

- **DEC-1 — a `SemanticIssueCode`, not an arity gate at the two Accept sites.**
  The issue mechanism is already wired end to end: it blocks Accept, lists the
  problem in the action bar, and states a recovery. Two hand-written gates would
  have to be kept in sync and would disable the button with no stated reason.
- **DEC-2 — the issue carries `paths: []`.** Every existing issue addresses a
  focusable control; a routine with no Workouts has no field to point at.
  Verified safe rather than assumed: `indexIssues` iterates `issue.paths`, so an
  empty array simply never enters the index
  ([`issues.ts:44-56`](../../../src/features/import/issues.ts)), and
  `jumpToIssue` already returns early on `paths[0] === undefined`
  ([`ImportWizard.tsx:187-188`](../../../src/features/import/ImportWizard.tsx)).
  The issue blocks Accept and shows its sentence; clicking it is inert, which is
  correct when there is nowhere to go.
- **ASM-1 — `stepOfIssue` needs no change.** It returns `2` only for
  `suggested_day_shared` and `1` otherwise
  ([`issues.ts:79-81`](../../../src/features/import/issues.ts)). Step 1 is the
  right home: it is where Workouts are shown.
- **ASM-2 — the compiler enforces the two UI updates.** `FIX` is a
  `Record<SemanticIssueCode, string>` and `problemOf` is an exhaustive switch
  with no `default`, so adding a union member fails `pnpm typecheck` until both
  are handled. No grep needed to find the call sites.

## Requirements and Acceptance

| ID | Requirement |
|---|---|
| REQ-1 | `SemanticIssueCode` gains `'routine_has_no_workouts'`. |
| REQ-2 | `validateRoutineFile` emits exactly one such issue when `file.routine.workouts` is empty, with `paths: []`. |
| REQ-3 | The issue's message names the problem; `FIX` supplies the recovery, per the module's stated rule. |
| REQ-4 | No other input changes its issue list. |

| ID | Acceptance |
|---|---|
| AC-1 | `validateRoutineFile` on a file with `workouts: []` returns one issue, code `routine_has_no_workouts`. |
| AC-2 | `validateRoutineFile` on a file with one Workout carrying zero exercises returns `[]` — the out-of-scope case stays valid. |
| AC-3 | The existing 456 tests still pass; `pnpm typecheck` and `pnpm lint` are clean. |
| AC-4 | With the issue standing, `blocked` is true at `ActionBar.tsx:62`, so `Accept` is disabled. Follows from REQ-2 and the existing gate; verified by running the wizard, since no DOM test environment exists. |

## Change Surface

| Path | Change |
|---|---|
| `src/domain/routine-file/validate.ts` | Add the union member and the check. |
| `src/features/import/issues.ts` | Add the `FIX` entry and the `problemOf` case. |
| `src/domain/routine-file/validate.test.ts` | Add AC-1 and AC-2. |

Three files. No schema change, no migration, no new dependency, no repository
touched.

## Stop Conditions

- Stop if the check would require touching `src/db/**` — that would mean the
  semantic tier is not the right level and the fix needs rethinking.
- Stop if making a Workout with zero exercises invalid turns out to be necessary
  to make this work; that is a behaviour change this spec excludes.
