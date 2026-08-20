# Gym Mode Refinements Verification

Verdict: **Pass with accepted limitations**
Base: `change/gym-mode`, tree as verified by `docs/changes/2026-08-20-gym-mode/verification.md`
Head/working tree: `change/gym-mode`, dirty (both changes uncommitted)
Reliability: strict

## Requirement Evidence

| Requirement / AC | Evidence | Result |
|---|---|---|
| R-1 / AC-1 | Browser: typed `62.5` into weight, committed on `focusout` → readout `62.5`. | Pass |
| R-1 / AC-2 | Browser: stepping after typing gave `67.5` — 62.5 + the exercise's own 5 kg increment, not 45 + 5. | Pass |
| R-1 / AC-3 | Browser: `abc` → reverted to `67.5`; `-5` → reverted to `67.5`. | Pass |
| R-1 / AC-4 | `inputMode="decimal"` on all three fields; read back from the DOM. | Pass |
| R-1 (bonus) | Typed `62.25` survived as `62.25` — rounding is to hundredths, so 0.25 microplates are not rounded away. | Pass |
| R-2 / AC-5 | Browser: amount field defaulted to `30`, typed `120`, control relabelled `Add 120 seconds to the rest`, rest went `2:44` → `4:43`. | Pass |
| R-2 / AC-6 | The amount is component state; no persistence path exists, consistent with pause (A-3 of the previous change). | Pass (static) |
| R-3 / AC-7 | Browser: primary read `Complete set` for sets 1–4 of a 4-set exercise, then became `Next exercise` + `Add another set`. | Pass |
| R-3 / AC-8 | Browser: pressing it moved `EXERCISE 1 OF 3` → `2 OF 3`. | Pass |
| R-3 / AC-9 | Browser: `Add another set` reopened the logger; the extra set stored as `setNumber: 5`; the view collapsed back to `Next exercise`. | Pass |
| R-3 / AC-10 | Browser: the unplanned exercise showed only `Complete set` after two logged sets — no count to reach, so it never switches. | Pass |
| R-4 / AC-11 | Browser: set 2 corrected to `70 kg × 5 @1`, `weightKg` recomputed to `70`, still 5 sets (no duplication). Unit tests cover a unit change: `weightKg` equals `toKg(100,'lb')`. | Pass |
| R-4 / AC-12 | Browser: deleted set 2 of 5 → survivors renumbered `1,2,3,4` contiguously, the deleted values gone. `completedSets.test.ts` asserts survivor ids and numbering after a middle deletion. | Pass |
| R-4 / AC-13 | Browser: deleting both sets of an exercise returned it from `performed` to `pending` with 0 sets. Same asserted against `fake-indexeddb`. | Pass |
| R-4 / AC-14 | Browser: the first press armed — consequence text shown, `Delete it` / `Keep it` offered — and the stored set count was **unchanged while armed** (20 before and during). | Pass |
| R-4 / AC-15 | Structural: gym mode renders only `useInProgressSession()`'s session, so no other session's sets are reachable from it. No separate guard exists or is needed. | Pass (static) |
| R-5 / AC-16 | Browser computed style: `flex-wrap: wrap`, `overflow-x: visible`, `scrollWidth <= clientWidth`. | Pass |
| R-6 / AC-17 | Browser: Romanian Deadlift showed all figures — `2 sessions · last Thu, Aug 20`, working weight `40 kg`, best set `62.25 × 8`, heaviest, lightest. | Pass |
| R-6 / AC-18 | Browser: sessions newest first, each with its date and `weight × reps @rir`; the open one carried an `IN PROGRESS` chip. | Pass |
| R-6 / AC-19 | Browser: `/exercises/box-squat` rendered "No history yet" with an explanation — not zeros, not a crash. | Pass |
| R-6 / AC-20 | Browser: the PREVIOUS card's `previous · all history` link opened the screen; `Back` returned to `/session` with the session resumed. | Pass |
| R-6 / AC-21 | Browser: all six exercises on the routine detail link to their history; Front Squat's opened. | Pass |

Two behaviors worth naming because they are the assumptions holding under load:

- **A-2 verified twice over.** Romanian Deadlift's working weight showed `40 kg`
  while an in-progress session held heavier `62.25 kg` sets — the figure comes
  from the last *completed* session. Front Squat, whose sessions are all
  `partial`, showed `—`. That is the same rule under which progression refused to
  advance off a partial session in the previous change.
- **A-3 verified.** Those partial sessions still appear in the session list and
  still feed heaviest/lightest, which is §11.8's rule, not §11.9's.

## Automated Checks

| Command | Result | Notes |
|---|---|---|
| `pnpm test` | Pass | 254/254 across 20 files (243 → 254 across this change). |
| `pnpm typecheck` | Pass | Both projects clean. |
| `pnpm lint` | Pass | Clean. |
| `pnpm build` | Pass | 804 ms. |
| `vitest --coverage` (`domain/history.ts`, `domain/session/index.ts`, `repositories/completedSets.ts`) | Pass | 100% statements, branches, functions and lines after closing one gap. |
| `stryker --mutate src/domain/session/index.ts` | Pass | 97.48% (116/119), 3 survivors classified. |
| `stryker --mutate src/domain/history.ts` | Pass | 91.07% (51/56), 5 survivors classified. |
| `git diff --exit-code src/styles/theme.css package.json pnpm-lock.yaml` | Pass | No diff — no dependency, no new token. |
| `SCHEMA_V1` byte-diff vs `HEAD` | Pass | Identical. No table, index or stored-key change. |
| `grep -rn "from 'dexie'" src/ --include=*.tsx` | Pass | No component imports Dexie. |

## Defects Found During Verification

Two gaps found by mutation testing that coverage could not see — both files were
already at 100% branch coverage when these survived.

1. **Nothing proved the working weight came from the most recent completed
   session.** Three mutants survived on `summarizeExercise`'s recency reduce,
   including `true ? entry : latest`, which discards the comparison entirely.
   The repository hands history over newest-first, so "most recent" and "last in
   the array" agreed by accident in every test. Now asserted in **both** orders
   via `it.each`. Score 85.71 → 91.07.

2. **`removeSet`'s no-op returned a value only checked for deep equality.** Two
   mutants survived by deleting the `sets.some(...)` guard: without it, an
   unknown id still produces a deep-equal *copy*. The documented contract is that
   the same list comes back — so the test now asserts identity (`toBe`), which is
   both stricter and what the comment claims. Score 95.80 → 97.48.

One correction to my own test, not to the code: an `editSet` assertion hardcoded
`45.359237` for 100 lb, but `toKg` rounds to three decimals. Rewritten to assert
against `toKg(100, 'lb')` so the expectation cannot drift from the one conversion
the codebase owns.

## Surviving Mutant Classification

All eight survivors are `>` ↔ `>=` / `<` ↔ `<=` flips or ternary-branch removals
whose two outcomes are indistinguishable in every observable field.

| Mutant | Location | Classification |
|---|---|---|
| `a.weightKg > b.weightKg` → `>=` | `history.ts:46` | **Equivalent.** Guarded by `weightKg !== weightKg`; the equal case cannot reach it. |
| `a.reps >= b.reps` → `>` | `history.ts:47` | **Equivalent.** Differs only when weight *and* reps are equal — two records that render identically. |
| `startedAt > latest.startedAt` → `>=` | `history.ts:80` | **Equivalent.** Differs only for two completed sessions at the identical millisecond; which wins is arbitrary and unobservable. |
| `b.weightKg > a.weightKg` → `>=` | `history.ts:89` | **Equivalent.** Ties in heaviest pick an equally heavy set. |
| `b.weightKg < a.weightKg` → `<=` | `history.ts:90` | **Equivalent.** Same, for lightest. |
| `it.order === order ? it : {…}` → `false ? …` | `session/index.ts:276` | **Equivalent.** An allocation guard; forcing the copy is deep-equal, and no caller compares element identity. |
| `set.setNumber === index + 1 ? set : {…}` → `false ? …` | `session/index.ts:375` | **Equivalent.** Same allocation guard in `removeSet`. |
| `set.setNumber === index + 1` → `index - 1` | `session/index.ts:375` | **Equivalent.** Only selects which survivors are re-allocated; the else branch assigns the correct number either way. |

Killing any of these would mean asserting which of two indistinguishable objects
is returned — locking in an arbitrary implementation choice rather than a
behavior. None is accepted as a missing assertion.

## QA Procedure

Against the dev server on a 375×812 viewport with real IndexedDB.

1. Type `62.5` into weight and commit. → `62.5`. ✔
2. Step after typing. → `67.5`, continuing from the typed value. ✔
3. Type `abc`, then `-5`. → both revert to `67.5`. ✔
4. Type `62.25`. → preserved, not rounded to `62.3`. ✔
5. Set the rest bump to `120` and apply. → `2:44` → `4:43`. ✔
6. Log sets 1–4 of a 4-set exercise. → primary switches after the 4th. ✔
7. Press `Add another set`, log it. → `setNumber: 5`, collapses back. ✔
8. Log two sets on an unplanned exercise. → primary never switches. ✔
9. Edit set 2 to `70 kg × 5 @1`. → stored with `weightKg: 70`, still 5 sets. ✔
10. Delete set 2 of 5, checking the armed state first. → nothing deleted while
    armed; survivors renumbered `1,2,3,4`. ✔
11. Delete both sets of an exercise. → returns to `pending`. ✔
12. Inspect the dome strip's computed style. → wraps, does not scroll. ✔
13. Open History from gym mode, then `Back`. → figures render; back returns to
    the open session. ✔
14. Open `/exercises/box-squat`. → empty state. ✔
15. Open History from the routine detail. → six linked exercises. ✔

## Quality Metrics

- Changed-line coverage: **100%** on `domain/history.ts`,
  `domain/session/index.ts` and `repositories/completedSets.ts`.
- Changed-branch coverage: **100%** on all three.
- Mutation: `session/index.ts` **97.48%**, `history.ts` **91.07%** — both above
  the repository's 80 break threshold and the strict profile's 70 default.
- Surviving mutants: 8, all classified Equivalent above.
- Flaky/skipped tests affecting scope: none.

## Diff and Scope Review

New: `src/domain/history.ts`, `src/domain/history.test.ts`,
`src/db/repositories/completedSets.test.ts`, `src/features/session/SetEditor.tsx`,
`src/features/history/ExerciseHistoryScreen.tsx`,
`docs/changes/2026-08-20-gym-mode-refinements/`.

Modified: `src/domain/session/index.ts` + test, `src/domain/types.ts` (untouched
this change), `src/db/repositories/completedSets.ts`, `src/db/index.ts`,
`src/features/session/{SetLogger,RestTimer,ExerciseView,SessionScreen}.tsx`,
`src/features/ui/styles.ts`, `src/features/shell/AppShell.tsx`,
`src/features/routines/RoutineDetailScreen.tsx`, `src/App.tsx`,
`stryker.config.json`.

- **Unrelated changes:** none. Every edit traces to R-1…R-6.
- **Ownership:** `src/features/shell/AppShell.tsx` was not in the plan's write
  set. Adding a second sub-route required teaching the shell about it; the
  alternative was a third top-level route outside the shell, which would have
  cost the history screen its navigation. Recorded as a deviation.
- **Reuse over duplication:** the set editor does not carry its own number entry.
  `SetFields` was extracted from `SetLogger` and both use it, so stepping,
  parsing and the zero floor cannot drift between logging and correcting.
- **Frozen contracts:** `SCHEMA_V1` identical; `theme.css`, `package.json` and
  `pnpm-lock.yaml` untouched. `logSet`, `startWorkout`, `restRemaining`,
  `reorderExerciseSessions`, `suggestLoad` and `saveLoggedSet` unchanged.
- **Architecture:** `domain/history.ts` imports nothing from `db/` or
  `features/`; the screen computes nothing itself. `features → db → domain` holds.
- **§11.9 fidelity:** no figure on the history screen is stored. All six are
  recomputed from `listExerciseHistory` on each read, so a correction made on the
  training screen is reflected with nothing to keep in step.

## Limitations or Deviations

1. **`src/features/shell/AppShell.tsx` edited outside the planned write set** —
   the shell had exactly one hardcoded sub-route and now has two. The history
   screen's back control retraces history (`navigate(-1)`) rather than naming a
   destination, because it is reached from two places and sending a lifter to
   Routines from an open session would be the wrong answer to "back".
2. **Neither change is committed.** Both this change and the gym mode change sit
   uncommitted on `change/gym-mode`, so the diff range for either is defined by
   its predecessor's verification rather than by a commit. Recommended before
   any further work.
3. **Still not visually inspected.** As with the previous change, the Browser
   pane was unavailable, so every interaction was driven through
   JavaScript-dispatched events into real React handlers with assertions read
   back from real IndexedDB. Behavior is verified; the appearance of the editor,
   the wrapped dome strip, the amber timer's new amount field and the history
   screen have **not** been checked against DESIGN.md by eye.
4. **AC-6 and AC-15 are verified statically**, not by execution — both are
   properties of what the code cannot do (persist a bump; reach another
   session's sets) rather than behaviors that can be exercised.

Limitations 3 and 4 are non-behavior-breaking and recorded for acceptance.
Nothing prevents merge.
