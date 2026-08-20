# Set Strip, Free Reordering and the Phantom Dome — Verification

Verdict: **Pass with accepted limitations**
Base: `change/gym-mode`, after `2026-08-20-gym-mode-refinements`
Head/working tree: `change/gym-mode`, dirty (three changes uncommitted)
Reliability: strict

## The Defect, Confirmed and Fixed

`DomeStrip` computed `count = Math.max(plannedSets, sets.length + 1)` and drew a
`live` dome wherever `number === sets.length + 1`. With every planned set logged,
that index is one past the last set, so the strip rendered a breathing 96px dome
— the largest object on the screen — for a set nobody was performing.

**It was never specific to four sets.** Two planned and two logged gives
`max(2, 3) = 3`; three gives `max(3, 4) = 4`. Every count was affected, and the
smaller the count the more the phantom stood out.

The root cause was not the arithmetic: the strip had no way to know whether the
logger was open, so it inferred it from the set count, and the inference is wrong
exactly when the exercise is finished. `entering` is now derived once in
`ExerciseView` and read by both the strip and the controls below it, so they
cannot disagree.

Reproduced and fixed against a 3-set exercise as well as a 4-set one:

| State | Domes rendered |
|---|---|
| 0 of 3 logged | `Set 1 in progress`, `Set 2 planned`, `Set 3 planned` |
| 1 of 3 logged | `Edit set 1`, `Set 2 in progress`, `Set 3 planned` |
| 3 of 3 logged | `Edit set 1..3`, `Add set 4` — **no live dome** |
| 4 of 4 logged | `Edit set 1..4`, `Add set 5` — **no live dome** |

## Requirement Evidence

| Requirement / AC | Evidence | Result |
|---|---|---|
| R-1 / AC-1 | Browser: 4 of 4 logged → exactly 4 logged domes, no `live`. | Pass |
| R-1 / AC-2 | Browser: the same holds at 3 of 3. The count comes from `plannedSets`, never a literal. | Pass |
| R-1 / AC-3 | Browser: while the logger is open, exactly one `Set N, in progress`, numbered `sets.length + 1`. | Pass |
| R-1 / AC-4 | Browser: 1 of 3 logged → `Edit set 1`, `Set 2 in progress`, `Set 3 planned`. | Pass |
| R-2 / AC-5 | Browser: `Add set 5` / `Add set 4` dome sits after the last logged set and opens the logger. | Pass |
| R-2 / AC-6 | Browser: with the advance showing, the only buttons are `Next exercise` and `Finish session`. `Add another set` is gone. | Pass |
| R-2 / AC-7 | Browser: no `Add set` dome while a set is being entered — it becomes the `live` dome instead. | Pass |
| R-2 / AC-8 | Browser: a set logged through the `+` stored `setNumber: 4` on a 3-set exercise; the `+` returned as `Add set 5`. | Pass |
| R-3 / AC-9 | Browser: Romanian Deadlift moved position 1 → 4 in one tap; order became `weighted-pull, sandbag, sandbag, romanian`. | Pass |
| R-3 / AC-10 | Browser: a second move (Weighted Pull Up → position 3) applied without leaving the panel; the panel stayed open. | Pass |
| R-3 / AC-11 | Browser: `order` contiguous `0,1,2,3` after both moves; a serialized snapshot of every `plannedExercises` row identical before and after. | Pass |
| R-3 / AC-12 | Browser: each row's current position is `disabled` and `aria-current="true"` — there is nothing to press. Unit tests cover the identity return for a same-position move and for a clamped out-of-range one. | Pass |
| R-4 / AC-13 | Browser: timer shell 480px wide; the `+` control starts at x=279 and the amount field plus `seconds` label end 20px from the right edge — the shell's own padding. `justify-content: flex-end`. | Pass |

## Automated Checks

| Command | Result | Notes |
|---|---|---|
| `pnpm test` | Pass | 257/257 across 20 files. |
| `pnpm typecheck` | Pass | Both projects clean. |
| `pnpm lint` | Pass | Clean. |
| `pnpm build` | Pass | 736 ms. |
| `vitest --coverage` (`domain/session/index.ts`) | Pass | 100% statements, branches, functions, lines. |
| `stryker --mutate src/domain/session/index.ts` | Pass | 97.27% (107/110), 3 survivors classified. |
| `git diff --exit-code src/styles/theme.css package.json pnpm-lock.yaml` | Pass | No diff. No dependency added. |
| `SCHEMA_V1` byte-diff vs `HEAD` | Pass | Identical. |

## Defect Found During Verification

Mutation testing caught one on the new code, on a file already at 100% branch
coverage:

`Math.min(Math.max(toPosition, 0), ordered.length - 1)` → `ordered.length + 1`
survived. `Array.prototype.splice` clamps an out-of-range insertion index itself,
so the resulting order is identical either way — but the clamp runs **before**
the `to === from` check. With a loose clamp, tapping an out-of-range position for
an exercise already at that end stops being a no-op and becomes a write of every
row in the session. Now asserted by identity in both directions. 96.36 → 97.27.

## Surviving Mutant Classification

| Mutant | Location | Classification |
|---|---|---|
| `it.order === order ? it : {…}` → `false ? …` | `index.ts:283` | **Equivalent.** Allocation guard in `moveExerciseSession`; forcing the copy is deep-equal and no caller compares element identity. |
| `set.setNumber === index + 1 ? set : {…}` → `false ? …` | `index.ts:382` | **Equivalent.** The same guard in `removeSet`. |
| `set.setNumber === index + 1` → `index - 1` | `index.ts:382` | **Equivalent.** Selects only which survivors are re-allocated; the else branch assigns the right number regardless. |

All three are the same optimisation pattern, carried over from the previous
change and classified there on the same grounds.

## Design Change Made During Implementation

The reorder control was specified as a `<select>` of positions and shipped as a
row of position buttons instead.

The trigger was a verification failure — Radix's `Select` does not emit
`onValueChange` under synthetically dispatched pointer or keyboard events, so the
move could not be exercised in this harness. That is a harness limitation, not a
product defect, and it would have been wrong to change the product to satisfy the
test.

The product reason stands on its own: this screen is used with the phone on a
bench and one hand occupied (§20). A select opens a popup **over** the list the
lifter is reading, and reaching position 4 costs two gestures. A row of numbers
shows every destination at once and costs one tap, at 44px targets. The buttons
reuse `tab()`, which already carries the active/inactive pair, so no new style
was introduced.

The side effect is that the behaviour is now verifiable end to end, which is how
the clamp defect above came to be exercised at all.

## QA Procedure

Dev server, 375×812, real IndexedDB.

1. Open a 4-set exercise with all four logged. → 4 domes, no phantom. ✔
2. Repeat on a 3-set exercise, at 0, 1 and 3 sets logged. → 1 live at 0 and 1;
   none at 3. ✔
3. Press the dashed `+`. → logger opens, `+` becomes the live dome. ✔
4. Log through it. → `setNumber: 4`, `+` returns as `Add set 5`. ✔
5. Open the menu. → `Skip this exercise`, `Reorder exercises`, `Add an exercise`;
   no one-step moves. ✔
6. Move the first exercise to position 4. → applied in one tap. ✔
7. Move a second exercise without leaving. → applied; panel still open. ✔
8. Check `plannedExercises`. → byte-identical. ✔
9. Check each row's current position. → disabled, `aria-current`. ✔
10. Measure the timer's add-time row. → right-aligned against the shell padding. ✔

## Quality Metrics

- Changed-line coverage: **100%** on `src/domain/session/index.ts`.
- Changed-branch coverage: **100%**.
- Mutation: **97.27%**, above the repository's 80 break threshold.
- Surviving mutants: 3, all classified Equivalent.
- Flaky/skipped tests affecting scope: none.

## Diff and Scope Review

New: `src/features/session/ExerciseReorder.tsx`,
`docs/changes/2026-08-20-set-strip-and-reorder/`.

Modified: `src/domain/session/index.ts` + test,
`src/db/repositories/sessions.test.ts` (ported call),
`src/features/session/{ExerciseView,SessionScreen,RestTimer}.tsx`,
`src/features/ui/styles.ts`.

- **Unrelated changes:** none.
- **Replacement, not accretion:** `reorderExerciseSessions` was removed rather
  than left beside `moveExerciseSession`. Its tests were ported — up and down are
  now `toPosition = from ± 1` — so the one-step behaviour is still asserted.
- **Frozen contracts:** `SCHEMA_V1` identical; `theme.css`, `package.json`,
  `pnpm-lock.yaml` untouched. The `add` dome state was built from existing
  tokens (`border-rule`, `border-planned`, `text-ink-3`, `text-planned-ink`), so
  A-1 held and the Token-Only Rule is intact.
- **Only `ExerciseSession.order` is written** by a reorder, verified against an
  unchanged `plannedExercises` snapshot.

## Limitations or Deviations

1. **Radix `Select` is not drivable in this harness.** Established while
   verifying the original reorder control. It affects no shipped code — the
   position buttons replaced it — but it means any future Radix `Select` will
   need either the Browser pane displayed or a component test to verify.
2. **Still not visually inspected.** The Browser pane remains undisplayed, so
   every interaction was driven through JavaScript-dispatched events into real
   React handlers with assertions read back from real IndexedDB and from computed
   styles and bounding boxes. Behaviour and layout geometry are verified; the
   dashed `+` dome, the reorder panel and the right-aligned timer row have not
   been seen.
3. **Three changes now sit uncommitted** on `change/gym-mode`. Recommended before
   any further work.
