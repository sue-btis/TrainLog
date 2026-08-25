# Routine Authoring — Verification

## Verdict

**Pass with accepted limitations.**

Every applicable `REQ-*`, `AC-*` and `TST-*` is satisfied by implementation
evidence *and* by validation that was re-run here rather than taken from the
execution record. The limitations are recorded in full below; none is a
behavioural gap.

## Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Branch | `change/routine-authoring` |
| Base commit | `16cf1e9` |
| Waves A, B | committed: `8f979ae`, `8ab1082` (verified separately, diff `40e0c02..8ab1082`) |
| Waves C, D, E | uncommitted working tree on `16cf1e9` |
| Governing spec | `spec.md` · reliability **strict** |
| Excluded as unrelated | `src/domain/session-summary.ts` + its test, `src/features/history/SessionDetailScreen.tsx` (session Effort metric); `docs/changes/2026-08-24-exercise-measurement/` |
| Untracked, never touched | `docs/PRD-DMS.md`, `docs/bloque-a-acumulacion.yaml`, `docs/bloque-b-intensificacion.yaml` |

Diff range inspected: `git diff -- . ':!<the three excluded paths>'` plus the
seven new untracked source files. 26 tracked files, 813 insertions.

## Re-run evidence

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass |
| `pnpm test` | Pass — **543** tests, 33 files, 0 skipped |
| `pnpm build` | Pass — `dist/sw.js` generated, 23 precache entries |

Regression floor (§12): 458. Actual 543. No test skipped or weakened.

Superseded figure, kept as the reading of this verification: two later
passes moved the count — the third deleted a dead decider and the fifth
added `features/import/issues.test.ts`. The current suite is **551** across
34 files; `execution.md`’s fifth-pass section carries the measurement and the
shared-tree caveat that goes with it.

### Changed-line coverage on new production logic

Strict profile asks ≥90% line and ≥80% branch where supported. `@vitest/coverage-v8`
is already a devDependency, so it is supported.

| File | Stmts | Branch | Lines |
|---|---:|---:|---:|
| `domain/routine-file/offer.ts` | 100% | 100% | 100% |
| `domain/routine-file/planned-exercise-draft.ts` | 100% | 100% | 100% |
| `domain/scheduling/index.ts` | 100% | 96.7% | 100% |
| `db/repositories/workouts.ts` | 96.3% | 100% | 95.5% |
| `db/repositories/plannedExercises.ts` | 93.8% | 100% | 92.9% |
| **All** | **97.9%** | **97.1%** | **98.2%** |

The two uncovered repository lines are the pre-existing `getWorkout` and
`getPlannedExercise` read helpers, untouched by this change. The one uncovered
scheduling branch is `nextWorkoutInRotation`'s `?? null`, also pre-existing.

**Mutation testing was not run.** Stryker's config covers
`domain/scheduling/index.ts`, but no npm script runs it and §12 states plainly it
must not be assumed a gate for this change.

## Findings this pass produced

Six things the implementation report had wrong or missing. All six were fixed
before this verdict; they are recorded because a verification that finds nothing
after a self-implementation is not evidence of quality.

1. **`pnpm build` had never been run.** It is one of §12's four gates. Run here —
   passes.
2. **`execution.md` was overwritten and its Waves A–B record destroyed.** A fresh
   Waves C–E document was written over the existing 288-line file. Recovered from
   `HEAD` via `git show` and the new waves appended instead. The defect is that
   the file was not read before being written over.
3. **A recorded blocker was stepped over.** Wave B's record left Wave E blocked on
   concurrent edits to `CONTEXT.md` and `docs/PRD.md`. Wave E proceeded without
   the log answering it. The blocker was in fact stale — the "concurrent session"
   was this same operator's Effort work — and the owner directed the remaining
   waves be completed. Now answered in `execution.md` rather than left dangling.
4. **Two REQ-906 copy blocks were still stale.** `TodayScreen.tsx` told a lifter
   to "Import a routine file that declares at least one Workout" when adding one
   in place is now possible, and `RoutineDetailScreen.tsx` said "Everything you
   have imported is on the routines screen". Both amended.
5. **A branch written in this change had no test.** The blank-draft-name guard in
   `offeredExercises` was uncovered — found by measuring coverage, not by reading.
   Test added; `offer.ts` is now 100% on all four metrics.
6. **AC-414b and AC-421 had not been observed**, though §12 names both explicitly
   as obligations to observe rather than assert. Both observed here; see below.

## Acceptance criteria — observed by running the app

Driven at 375×812 against a real IndexedDB. Method: events dispatched at the page
(the Browser pane is hidden in this session, so `computer` clicks time out). This
runs the components' real handlers and the real repositories; it is not a trusted
user gesture, and it is recorded as what it is.

### AC-414b — the DEC-B safety claim, observed

The one that matters most, and the reason DEC-B is safe at all.

1. A Session was recorded against Push through the real UI: started from Today,
   one set logged (0 kg × 12, RIR 0), finished as partial.
2. Its detail screen rendered: `Front Squat 3×8–12 · SETS 1 · 0 KG × 12 RIR 0`,
   `Barbell Row NOT STARTED 3×12–15 · rest 120s`.
3. **Two** Planned Exercises were then added to that same Workout — Overhead
   Press and Lateral Raise — taking it from 2 stored rows to **4**.
4. The recorded Session was re-rendered from the same route:
   **byte-identical** (`before === after` → `true`). Neither added exercise
   appears in it. Front Squat still shows its snapshotted `3×8–12`.

The snapshot holds. Adding to a template does not reach back into what was
recorded.

### AC-421 — the abandoned draft warns

With an unsaved draft named "Throwaway", `history.back()` left the wizard mounted
and raised *"Discard this import? Nothing has been…"*. The pushed history
sentinel and its `popstate` handler work. (The `beforeunload` half is asserted
from code, not observed — a browser will not surface it to a script.)

### Wave C

| AC | Observed |
| --- | --- |
| AC-300 | Picking closed the picker, appended `Front Squat 3×8–12 · kg`, opened the editor with `sets = 3` |
| AC-301 | 96 catalog offers, catalog first, list capped at 288px and scrolling inside itself |
| AC-302 | "Sled Push" typed as new in Push, then offered in Pull labelled **in this routine** |
| AC-306 | `  front   SQUAT ` → "Front Squat already exists — adding it will use that movement, not make a second one"; one row; no "add as new" |
| AC-307 | Problem count unchanged across every add |
| AC-308 | `elementFromPoint` at the ActionBar centre returns the ActionBar; both its buttons enabled with the picker open |
| AC-309 | The emptied-Workout well carries the control |
| AC-310 | Two rows both named "Front Squat"; exactly one editor open |
| AC-311 | `git status` reports `ExercisePicker.tsx` unmodified |

### Wave D

| AC | Observed |
| --- | --- |
| AC-400, AC-415 | Both adds render on the active Routine only |
| AC-403 | "No day is selected, so no sessions will be placed. The Workout is still added…" |
| AC-405, AC-406 | The collision warning names Push, both consequences, and the recovery — verbatim, and saving stayed enabled |
| AC-404 | Preview "4 sessions … 2026-08-24 → 2026-09-14"; after saving "Workout added, with 4 sessions placed"; IndexedDB held exactly those four dates |
| AC-401 | Pull stored at `order: 1`, listed last |
| AC-408, AC-409 | Barbell Row at `order: 1`, `focus: null`, `notes: []`; `exercises` table 0 → **0** rows |
| AC-410 | "Push → Barbell Row: min_reps cannot be greater than max_reps." with Save disabled; repairing re-enabled it |
| AC-417 | Pull rendered "This Workout has no exercises." and stayed trainable |

## Scope and ownership

- **Stop condition 8** — `SCHEMA_V1`, `SCHEMA_VERSION = 2` and
  `BACKUP_VERSION = 1` are byte-identical to `HEAD`; confirmed by
  `git diff src/db/schema.ts src/domain/backup/document.ts` returning empty.
  TST-419 demonstrates ASM-1 positively: export → reset → restore round-trips the
  added Workout, its Placements and the added Planned Exercise.
- **Stop condition 9** — the only new writers are `addWorkoutToRoutine` and
  `addPlannedExercise`. Neither calls `update`, `delete`, `put` or `modify`.
- **Stop condition 10** — the three untracked user files are unmodified and
  unstaged.
- **REQ-905** — writers are named `addWorkoutToRoutine` / `addPlannedExercise`,
  not colliding with Gate 0's draft verbs.
- **Frozen contracts (§6)** — `Offer` is the union §6 declares and
  `resolveTypedName` is total. Both barrels were appended to. *Corrected after
  audit:* the routine-file barrel's `edit` block was also re-alphabetized —
  `toggleSuggestedDay` moved from before `setWeeks` to after `setWorkoutName`.
  No consumer can observe it (these are named exports, and no member was added,
  removed or renamed), but "never reordered" was false as written.
- **No extra diff.** Every changed file maps to a REQ. The Effort work is
  excluded above and is separable by pathspec.

## Accepted limitations

1. **Implementation and verification share an operator.** This pass was run
   adversarially and did disagree with the implementation six times, but it is
   not organisationally independent. A reviewer who did not write the code would
   be worth more.
2. **AC-419 / AC-420 are unreachable.** They describe the preview disagreeing
   with the in-transaction read, which needs a contrived concurrent write. The
   path that reports the transaction's own count is exercised; the divergence is
   not.
3. **UI evidence is dispatched, not gestured.** Same limitation Waves A and B
   recorded. The handlers and repositories are real; the gesture is not.
4. **No mutation testing.** Tooling exists, no script runs it, §12 excludes it.
5. **`beforeunload` asserted, not observed** — browsers do not expose it to
   scripts.

## Not verified

- Long-run rotation behaviour across many real sessions. `nextWorkoutInRotation`
  reaching an added Workout is covered as a pure function (TST-408) only.
- The concurrent-session conflict logged at `16cf1e9` is untouched by this work
  and remains open.
