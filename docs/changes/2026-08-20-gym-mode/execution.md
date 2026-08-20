# Gym Mode Execution

## Baseline

| Field | Value |
|---|---|
| Repository | `TrainLog` |
| Branch | `change/gym-mode` |
| Planned base | `master@6dbb8d9` |
| Current start commit | `6dbb8d9` |
| Working tree before edits | Clean except this change's own `docs/changes/2026-08-20-gym-mode/` |
| Pre-existing relevant changes | None. `change/app-shell` was already merged into `master`. |

## Preflight Verdict

**Safe.**

Root, branch and base match the plan. No unrelated work overlaps the write set.
`src/features/harness/` — the only deletion — is touched by nothing else.

## Execution Topology

Sequential, single agent, one working tree, as `plan.md` specifies.

## Executed Work

| Task | Requirements | Status | Files Changed | Checks | Evidence |
|---|---|---|---|---|---|
| T-1 Domain | R-2, R-7, R-10 | Completed | `src/domain/session/index.ts`, `index.test.ts` | `pnpm vitest run src/domain/session`, `pnpm typecheck` | Red first: 12 new tests failed (`restRemaining is not a function`), 14 existing passed. Green after: 26/26. |
| T-2 Persistence | R-2, R-3, R-10 | Completed | `src/db/repositories/sessions.ts`, `sessions.test.ts`, `exerciseSessions.ts`, `src/db/index.ts` | `pnpm vitest run src/db/repositories/sessions`, `pnpm test` | Red first: 6 new failed, 9 passed. Green after: 15/15, then 223/223 suite-wide. |
| T-3 Screen + logging | R-1, R-4, R-5, R-6 | Completed | `src/features/session/{SessionScreen,ExerciseView,SetLogger}.tsx`, `src/features/ui/styles.ts`, `src/features/data/queries.ts`, `src/features/today/TodayScreen.tsx`, `src/App.tsx` | `pnpm typecheck`, `pnpm lint`, browser QA | Session started from Today; 3 snapshotted exercises read back from IndexedDB in order; set logged and survived a full page reload. |
| T-4 Rest timer + wake lock | R-7, R-8 | Completed | `src/features/session/{RestTimer.tsx,useWakeLock.ts,SessionScreen.tsx}`, `src/features/ui/styles.ts` | `pnpm typecheck`, `pnpm lint`, browser QA | Reload mid-rest rebuilt 1:10 from a 210s rest logged ~140s earlier. Main thread blocked 7.8s → timer dropped 7s, not 1s. |
| T-5 Deviations | R-9, R-10, R-11 | Completed | `src/features/session/{ExercisePicker.tsx,SessionScreen.tsx,SetLogger.tsx}` | `pnpm typecheck`, `pnpm lint`, browser QA | 5th set on a 4-set exercise + `1 EXTRA` chip; skip → `skipped`; reorder verified against untouched `plannedExercises`; unplanned Dip added with `plannedExerciseId: null` and no row added to `exercises`. |
| T-6 Finish, recovery, harness | R-12, R-13, R-14 | Completed | `src/features/session/SessionScreen.tsx`, `src/features/today/TodayScreen.tsx`, `src/App.tsx`, `src/features/import/ImportWizard.tsx`, `src/features/shell/AppShell.tsx`, `src/db/schema.ts` (comment only), deleted `src/features/harness/**` | `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `rg harness` | Partial and completed both derived correctly; recovery resumed a reordered session with all 6 sets; `grep -rn harness src/` returns nothing. |

## Integration Gates

| Gate | Diff Inspected? | Checks | Result |
|---|---|---:|---|
| Wave 1 | Yes | `pnpm test` 223/223, `typecheck`, `lint`, `build` all clean; `git diff --exit-code` on the four frozen files clean | Pass |
| Wave 2 | Yes | `pnpm test` 224/224, `typecheck`, `lint`, `build` clean; `theme.css`/`package.json`/`pnpm-lock.yaml` clean; no `.tsx` imports `dexie` | Pass, with one blocker raised below |

## Requirement Status

| Requirement | Acceptance Evidence | Status |
|---|---|---|
| R-1 | AC-1: `Start workout` pressed → `/session`, one `in_progress` Session. AC-2: alert and card both offer `Resume session` while one is open; harness link gone. | Completed |
| R-2 | AC-3: 3 ExerciseSessions, orders 0/1/2, all `pending`, each carrying its own `plannedSets`/reps/RIR/rest/progression read back from IndexedDB. AC-4: values match the template exactly. AC-5: forced duplicate-key write left neither Session nor exercises (`fake-indexeddb` test). | Completed |
| R-3 | AC-6: second concurrent start rejected with `SessionInProgressError`, nothing written. | Completed |
| R-4 | AC-7: `/session` renders one exercise, no `BottomNav`. AC-8: pager moves between exercises only. | Completed |
| R-5 | AC-9: RDL opened at **45 kg** with a `TARGET MET · 45 KG` chip after 4×8 @ 40 kg with increment 5. Front Squat correctly did **not** advance — its session was `partial`, which §11.9 excludes. AC-10: unplanned Dip showed no suggestion. | Completed |
| R-6 | AC-11: `{weight: 20, unit: 'kg', weightKg: 20, reps: 6, rir: 1, setNumber: 1, completedAt}` on disk, exercise `performed`. AC-12: full page reload showed the logged set. Unit correctness closed by B-1's fix: 30 lb stored as `unit: 'lb'`, `weightKg: 13.608`. | Completed |
| R-7 | AC-13: main thread blocked 7 774 ms → timer dropped **7 s**, proving derivation not accumulation. AC-14: reload rebuilt 1:10 from the stored `completedAt`. AC-15: pause held 0:33 across 2.5 s; resume continued; +30 s took 0:28→0:58; restart returned to 3:30; skip dismissed. | Completed |
| R-8 | AC-16: no error surfaced; every failure path swallows. AC-17: released on unmount via the effect's cleanup. **Not exercised on a browser lacking the API** — this Chrome has `wakeLock`, so the degrade path is verified by code shape only. | Completed, with a stated limit |
| R-9 | AC-18: 5th set on a 4-set exercise stored as `setNumber: 5`, no error. AC-19: skip → `skipped`, not `pending`. AC-19b: `1 EXTRA` and `UNPLANNED` chips shown; nothing blocked. | Completed |
| R-10 | AC-20: front-squat moved 0→1, orders stayed 0/1/2 contiguous, `plannedExercises` byte-identical before and after, pager followed the moved exercise. | Completed |
| R-11 | AC-21: `plannedExerciseId: null`, no `planned*` fields. AC-22: no suggestion. AC-23: logged in `kg`, the settings default. The `exercises` table did **not** grow — A-1 held. | Completed |
| R-12 | AC-24: pending exercise → armed prompt → `partial`; nothing pending → finished directly as `completed`. AC-25: `completedAt` stamped. AC-26: returned to Today, `Start workout` offered again. | Completed |
| R-13 | AC-27: fresh navigation to `/session` resumed the session with the reordered order and all 6 sets intact. | Completed |
| R-14 | AC-28: `grep -rn "harness" src/` returns nothing. AC-29: `pnpm test` 223/223, `typecheck`, `lint`, `build` all clean. | Completed |

## Deviations

1. **`.claude/launch.json`** — added a `trainlog-verify` entry on port 5233.
   Port 5173 was held by another session's dev server for this same project, so
   the change could not otherwise be driven in a browser. Dev tooling only; it
   reaches no build and no product code. Remove it if unwanted.
2. **`src/db/schema.ts`** — one comment line changed, from "the harness's
   'which routine is active' read" to "Today's". The plan froze this file, but
   the sentence named a screen the change deletes, so leaving it would have left
   the file factually wrong while still failing AC-28. `SCHEMA_V1` and the
   `TrainLogDatabase` class were verified byte-identical against `HEAD`; no
   table, index, version or field changed.
3. **`src/features/import/ImportWizard.tsx`** — not in T-6's planned write set.
   Its success screen linked to `/harness`, which AC-28 required removing; the
   link now goes to Today. One button and one icon import.
4. **Zero-rep guard added to `SetLogger`** — not a listed requirement. Browser QA
   logged a 0-rep set against the unplanned exercise, which would enter history
   and progression as a set that failed its target. `Complete set` is now
   disabled at 0 reps and reads "Set the reps first". Weight 0 (bodyweight) and
   RIR 0 (to failure) remain loggable, because both are real training.
5. **Browser QA was driven through JavaScript-dispatched events**, not synthetic
   mouse input: the Browser pane was not displayed in this session, so
   screenshots and `computer` clicks were unavailable. Every interaction went
   through the app's real React handlers and every assertion was read back from
   real IndexedDB, but no visual screenshot was captured. **The rendered
   appearance of gym mode against DESIGN.md has not been eyeballed.**

## Ownership / Contract Conflicts

`src/db/schema.ts` was frozen by the plan and AC-28 required a string inside it
to change. Resolved as deviation 2 — the guard's purpose is the schema
declaration, which is untouched and was verified so.

## Blockers

**B-1 — the target snapshot carries no unit, so a non-kg exercise logs its first
ever set in the wrong unit.**

`PlannedExercise` carries `unit` (`src/domain/types.ts:133`), but
`startPlannedExercise` does not copy it, and `PlannedExerciseSession` has no
field for it. Nothing before this change ever had to choose a unit from an
ExerciseSession: the harness held the `PlannedExercise` itself and read
`planned.unit` straight off it.

Observed: the routine file declares `Sandbag Bear Hug Carry` in `lb`. Gym mode
opened it at `0 kg`, and logging there would have stored `unit: 'kg'` with
`weightKg` converted as kilograms — silently wrong, and wrong in the one place
AGENTS.MD calls an invariant ("Weight carries its unit").

Scope: only the **first** set of a planned exercise with no prior history. Once
any set exists, `CompletedSet.unit` is authoritative and the screen reads it
back correctly, which is why every other check in this change passed.

Both fixes are small and both cross a line this spec froze:

- (a) read `PlannedExercise.unit` live through `plannedExerciseId` — cheapest,
  but ADR 0002 says targets are never read back through that id, and deciding
  that `unit` is not a target is an ADR interpretation, not an implementation
  detail;
- (b) add `plannedUnit` to the snapshot — the correct shape, and it needs **no
  Dexie version bump** because the field is not indexed, but it is a new stored
  field, which `spec.md` names as a stop condition.

**Resolved — option (b), approved by the user.**

`plannedUnit: Unit` was added to `PlannedExerciseSession` and copied by
`startPlannedExercise`. No Dexie version bump: the field is not indexed, so
`SCHEMA_V1` is byte-identical to `HEAD` (verified). The screen now resolves the
unit as `lastSet.unit → plannedUnit → suggestion → previous → settings default`,
so the settings default is reached only by an unplanned exercise, which has no
plan to take a unit from.

Files: `src/domain/types.ts`, `src/domain/session/index.ts`,
`src/domain/session/index.test.ts`, `src/db/schema.test.ts` (fixture),
`src/features/session/ExerciseView.tsx`.

Evidence — red first: two tests failed on the missing `plannedUnit`. Green
after: 27/27 domain, 224/224 suite-wide. In the browser, `Sandbag Bear Hug
Carry` now opens at **`0 lb`** where it previously read `0 kg`, and a logged set
stored `{weight: 30, unit: 'lb', weightKg: 13.608}` — the correct conversion.

Rows written before this fix carry no `plannedUnit`; the resolution chain falls
through for them without error. No migration is needed, and none is possible at
schema v1.

## Independent Verification Readiness

**Ready.** Every requirement R-1…R-14 is implemented and evidenced, and B-1 is
closed. The one stated limit is deviation 5: gym mode's rendered appearance
against DESIGN.md has not been visually inspected, because the Browser pane was
unavailable in this session.
