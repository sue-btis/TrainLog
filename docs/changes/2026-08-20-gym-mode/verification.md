# Gym Mode Verification

Verdict: **Pass with accepted limitations**
Base: `master@6dbb8d9`
Head/working tree: `change/gym-mode`, dirty (uncommitted)
Reliability: strict

Diff range inspected: `git diff 6dbb8d9` plus the untracked `src/features/session/`
and `docs/changes/2026-08-20-gym-mode/`. No unrelated work was present in the
tree at any point; `change/app-shell` was already merged before this change began.

## Requirement Evidence

| Requirement / AC | Evidence | Result |
|---|---|---|
| R-1 / AC-1 | Browser: `Start workout` on Today → `/session`, one `in_progress` row in `sessions`. | Pass |
| R-1 / AC-2 | `TodayScreen.tsx` renders `Resume session` when `useInProgressSession()` resolves; the §35 alert links `/session`. No harness link remains. | Pass |
| R-2 / AC-3 | `sessions.test.ts` "writes the Session and every ExerciseSession together, in order"; browser read-back: 3 rows, orders 0/1/2, all `pending`. | Pass |
| R-2 / AC-4 | `index.test.ts` "copies every target by value…" asserts `plannedProgression` is not the template's object. Browser read-back matched the file field for field. | Pass |
| R-2 / AC-5 | `sessions.test.ts` "leaves neither the Session nor any exercise behind when a write fails" — forced duplicate key, then asserted `getInProgressSession()`, `getSession()` and the exercise list are all empty. | Pass |
| R-3 / AC-6 | `sessions.test.ts` "refuses a second concurrent Session and writes nothing". | Pass |
| R-4 / AC-7 | Browser: `/session` page text contains no `TODAY/CALENDAR/ROUTINES` nav; one exercise rendered. | Pass |
| R-4 / AC-8 | Browser: pager moved 1→2→3 of 3, changing only the exercise shown. | Pass |
| R-5 / AC-9 | Browser: after 4×8 @ 40 kg (increment 5) in a **completed** session, the next session's RDL opened at **45 kg** with `TARGET MET · 45 KG`. Front Squat correctly did *not* advance from a **partial** session, which §11.9 excludes — a stronger check than the AC asked for. | Pass |
| R-5 / AC-10 | Browser: unplanned Dip showed no suggestion chip. | Pass |
| R-6 / AC-11 | Browser: `{weight: 20, unit: 'kg', weightKg: 20, reps: 6, rir: 1, setNumber: 1, completedAt: <number>}`, exercise `performed`. | Pass |
| R-6 / AC-12 | Browser: full `location.reload()` mid-exercise; the logged set was still rendered and still on disk. | Pass |
| R-6 (unit) | After the B-1 fix: `Sandbag Bear Hug Carry` (declared `lb`) opened at `0 lb` and stored `{weight: 30, unit: 'lb', weightKg: 13.608}` — conversion asserted correct to 1e-3. | Pass |
| R-7 / AC-13 | Browser: main thread blocked **7 774 ms** so the 1 s interval could fire at most once on resume; the timer dropped **7 s**. An accumulating timer would have dropped 1. | Pass |
| R-7 / AC-14 | Browser: reload during a 210 s rest logged ~140 s earlier rebuilt to `1:10`. | Pass |
| R-7 / AC-15 | Browser: pause held `0:33` across 2.5 s; resume continued to `0:29`; `+30` took `0:28`→`0:58`; restart returned to `3:30` (the planned 210 s); skip dismissed. | Pass |
| R-8 / AC-16 | `useWakeLock.ts`: guarded by `'wakeLock' in navigator`, `request` wrapped in `try/catch` with an empty handler, `release` catches. No error surfaced in the console during any session. | Pass (see Limitations) |
| R-8 / AC-17 | Effect cleanup sets `dropped`, removes the `visibilitychange` listener and releases the sentinel. | Pass (static) |
| R-9 / AC-18 | Browser: 5 sets logged on a 4-set exercise, `setNumbers` 1–5, no error. | Pass |
| R-9 / AC-19 | Browser: skip → `incline-dumbbell-press=skipped`; `deriveSessionStatus` treats it as not-pending (existing unit tests). | Pass |
| R-9 / AC-19b | Browser: `1 EXTRA` chip on the over-set exercise, `UNPLANNED` chip on the added one. Nothing blocked or errored anywhere in the flow. | Pass |
| R-10 / AC-20 | Browser: front-squat 0→1, orders remained `0,1,2`, and a serialized snapshot of every `plannedExercises` row was **identical** before and after. `sessions.test.ts` asserts `db.plannedExercises.count() === 0` after a persisted reorder. | Pass |
| R-11 / AC-21 | Browser: added row has `plannedExerciseId: null` and `'plannedSets' in row === false`. | Pass |
| R-11 / AC-22 | Browser: no suggestion rendered for the unplanned exercise. | Pass |
| R-11 / AC-23 | Browser: logged `unit: 'kg'` with no `settings` row present, i.e. `DEFAULT_UNIT`. The `exercises` table did **not** grow — A-1 held. | Pass |
| R-12 / AC-24 | Browser, both branches: one pending → armed prompt → `partial`; nothing pending → finished with no prompt → `completed`. | Pass |
| R-12 / AC-25 | Browser: `completedAt` is a number on both finished sessions. | Pass |
| R-12 / AC-26 | Browser: returned to `/today`, `Start workout` offered again, zero `in_progress` rows. | Pass |
| R-13 / AC-27 | Browser: fresh navigation to `/session` after a reorder resumed the same session, same order, all 6 sets. | Pass |
| R-14 / AC-28 | `grep -rn "harness" src/` → no matches. | Pass |
| R-14 / AC-29 | `pnpm test`, `typecheck`, `lint`, `build` all clean. | Pass |

## Automated Checks

| Command | Result | Notes |
|---|---|---|
| `pnpm test` | Pass | 228/228 across 18 files (223 at base, +5 net from this verification pass). |
| `pnpm typecheck` | Pass | Both projects clean. |
| `pnpm lint` | Pass | Clean after removing the `coverage/` artifact this verification generated. |
| `pnpm build` | Pass | Built in 1.94 s. The >500 kB chunk warning is pre-existing. |
| `npx vitest run --coverage` (domain/session) | Pass | 100% statements, branches, functions, lines. |
| `npx vitest run --coverage` (repositories) | Pass | Branches 100%; the two uncovered statements are `getExerciseSession` and `listExerciseSessionsByExercise`, both pre-existing and untouched. |
| `npx stryker run --mutate src/domain/session/index.ts` | Pass | 98.75%, 1 survivor, classified below. Repo break threshold is 80. |
| `git diff --exit-code src/styles/theme.css package.json pnpm-lock.yaml` | Pass | No diff. No dependency was added; the Offline Rule holds. |
| `SCHEMA_V1` byte-diff vs `HEAD` | Pass | Identical. No table, index, version or stored-key change. |
| `grep -rn "from 'dexie'" src/ --include=*.tsx` | Pass | No component imports Dexie; `features → db → domain` holds. |

## Defects Found and Fixed During Verification

Verification disagreed with the implementation report in three places. All three
were fixed and re-verified.

1. **Stale rest timer after a set on a rest-less exercise** (`SessionScreen.pendingRest`).
   The loop skipped entries whose exercise declares no `plannedRestSeconds`, so
   the most recent set could not clear a rest started by an *earlier* exercise.
   Logging a set on an unplanned exercise left the previous exercise's countdown
   visibly running. Now the latest set decides unconditionally and a `null` rest
   yields no timer. Re-verified in the browser: timer present before, absent
   after.

2. **Two missing reorder cases**, surfaced by mutation testing, not by coverage —
   the file was already at 100% branch coverage.
   - No test moved a **middle** element, the ordinary case. Two mutants survived
     (`from === -1`→`+1`, `to < 0`→`to <= 0`) because only the ends were tested.
   - No test used an **unknown id with direction `'down'`**. That path is a real
     corruption route: `to` becomes `0`, inside both bounds, so without the
     `from === -1` guard the swap would index `ordered[-1]` and the map would
     emit `{order: 0}` — a row with no id. Only the `'up'` variant was covered,
     where `to` is `-2` and the lower bound catches it.
   Both are now tested; the score moved 95.00 → 98.75.

3. **Duplicated default-unit literal** — `SessionScreen` fell back to a bare
   `'kg'` rather than the repository's `DEFAULT_UNIT`, so changing that constant
   would have left one path behind. Now imported.

Also corrected: `createSession`'s doc comment claimed "this is what the Today
screen calls", which stopped being true when `createStartedWorkout` superseded
it. See Observations.

## Surviving Mutant Classification

| Mutant | Location | Classification |
|---|---|---|
| `it.order === order ? it : { ...it, order }` → `false ? …` | `session/index.ts:276` | **Equivalent.** The ternary avoids re-allocating rows whose `order` is already correct; forcing the copy produces a deep-equal result. Only object identity differs, and no caller compares element identity — `SessionScreen` compares the *array* reference, which is freshly built on every real move. No behavioral assertion is missing. Accepted. |

## QA Procedure

Driven against a real dev server on a 375×812 viewport with a real IndexedDB,
seeded by importing `docs/examples/routine.yaml` through the actual wizard.

1. Import the example routine, open Today, press `Start workout`.
   Expected: `/session`, one `in_progress` Session, N snapshotted exercises.
   Actual: as expected; 3 rows, orders 0/1/2, targets matching the file.
2. Step the weight, press `Complete set`, reload the page.
   Expected: the set persists and is rendered.
   Actual: `20 kg × 6 @1` on disk and on screen after reload.
3. Block the main thread ~8 s during a rest.
   Expected: the timer loses the wall-clock time, not one tick.
   Actual: 7 s lost against 7 774 ms stalled.
4. Reload during a rest.
   Expected: countdown rebuilt from the stored `completedAt`.
   Actual: `1:10` of a 210 s rest logged ~140 s earlier.
5. Log a 5th set on a 4-set exercise.
   Expected: stored, flagged, not blocked.
   Actual: `setNumber: 5`, `1 EXTRA` chip, no error.
6. Skip an exercise; reorder two; inspect `plannedExercises`.
   Expected: statuses and orders change, templates do not.
   Actual: `skipped` written; orders `0,1,2` after the move; templates identical.
7. Add an unplanned exercise and log a set.
   Expected: no targets, no suggestion, no new `exercises` row.
   Actual: `plannedExerciseId: null`, no suggestion, table unchanged.
8. Log a set on the rest-less unplanned exercise while a rest runs.
   Expected: the timer clears.
   Actual: present before, absent after. (Regression test for defect 1.)
9. Open the `lb` exercise and log a set.
   Expected: `lb`, with `weightKg` converted.
   Actual: `0 lb` opening, `{30, 'lb', 13.608}` stored.
10. Finish with a pending exercise, then finish another with none.
    Expected: `partial` after a prompt; `completed` with none.
    Actual: both as expected, `completedAt` stamped, Today reset.

## Quality Metrics

- Changed-line coverage: `src/domain/session/index.ts` **100%**; changed
  repository functions fully covered (the 2 uncovered statements in
  `exerciseSessions.ts` are pre-existing and untouched).
- Changed-branch coverage: **100%** on both changed files.
- Mutation scope and score: `src/domain/session/index.ts`, **98.75%** (79/80).
- Surviving mutants: 1, classified Equivalent above.
- Flaky/skipped tests affecting scope: none.

## Diff and Scope Review

Files changed (20 tracked + 2 untracked trees):
`src/domain/{session/index.ts,session/index.test.ts,types.ts}`,
`src/db/{index.ts,schema.ts,schema.test.ts,repositories/sessions.ts,repositories/sessions.test.ts,repositories/exerciseSessions.ts}`,
`src/features/{session/**,data/queries.ts,today/TodayScreen.tsx,ui/styles.ts,import/ImportWizard.tsx,shell/AppShell.tsx}`,
`src/App.tsx`, `.claude/launch.json`, deleted `src/features/harness/**`,
plus `docs/changes/2026-08-20-gym-mode/`.

- **Unrelated changes:** none. Every edit traces to a requirement or to a
  recorded deviation in `execution.md`.
- **Ownership:** three departures from `plan.md`, all recorded as deviations
  1–3 there and all justified: `.claude/launch.json` (dev tooling, forced by a
  port conflict with another session's server), `ImportWizard.tsx` (required by
  AC-28 — it linked to `/harness`), and one comment line in the frozen
  `schema.ts` (also AC-28; the declaration was proven identical).
- **Lockfile / generated files:** `package.json` and `pnpm-lock.yaml` untouched.
  No generated output is committed. The `coverage/` directory produced during
  this verification was deleted and is gitignored.
- **Frozen contracts:** `SCHEMA_V1` identical; `theme.css` untouched, so no new
  design token was introduced; `logSet`, `skipExercise`, `finishSession`,
  `deriveSessionStatus` and `saveLoggedSet` are unchanged in signature and
  behavior.
- **ADR fidelity:** `startPlannedExercise` still copies by value and nothing
  reads a target through `plannedExerciseId`. `plannedUnit` was added *to the
  snapshot* rather than read live, which strengthens ADR 0002 rather than
  bending it.

## Observations (non-blocking)

- **`createSession` now has no production caller.** `createStartedWorkout`
  supersedes it, including the empty-exercise case. It survives as the narrow
  primitive `sessions.test.ts` and `history.test.ts` build fixtures from, and
  its misleading comment has been corrected. Deleting it would mean rewriting
  fixtures in a file outside this change's write set; recommended as a separate
  cleanup, not done here.
- **Pre-existing console error**, unrelated to this change: React reports a
  missing `key` in `src/features/import/ScheduleStep.tsx` on the import
  wizard's step 2. Filed as its own task.
- `restRemaining` does not guard `pausedAt < since`, which no caller can produce
  (`pausedAt` is always `Date.now()` at or after the set). Not defended, by
  choice.

## Limitations or Deviations

1. **Gym mode's rendered appearance has not been visually inspected.** The
   Browser pane was not displayed in this session, so `computer` screenshots and
   synthetic clicks were unavailable; every interaction was driven through
   JavaScript-dispatched events into the app's real React handlers, and every
   assertion was read back from real IndexedDB. Behavior is therefore verified;
   the Dome strip, the amber timer shell and the stepper layout have **not** been
   checked against `DESIGN.md` by eye. Recommended before merge.
2. **The wake-lock degrade path is verified statically only.** The test browser
   implements `navigator.wakeLock`, so the "API absent" branch was never
   executed. The guard is a plain `'wakeLock' in navigator` check with every
   failure swallowed.
3. **`.claude/launch.json` carries an extra `trainlog-verify` entry** on port
   5233, added because port 5173 was held by another session's dev server for
   this same project. Dev tooling only; safe to drop.

Limitations 1 and 2 are non-behavior-breaking and are recorded for the change
owner's acceptance. Nothing else prevents merge.
