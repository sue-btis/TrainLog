# Set Strip, Free Reordering and the Phantom Dome — Spec

Status: Ready for implementation
Size: medium
Reliability: strict
Base: `change/gym-mode`, after `2026-08-20-gym-mode-refinements`

## Goal

Five things a lifter reported after training with the refinements.

The set strip stops drawing a set that is not happening. Adding an extra set
becomes a dashed `+` circle at the end of that strip rather than a button below
it. Reordering stops meaning "one place up, one place down" and becomes a list
where any exercise goes to any position, as many as you like in one pass. And
the rest timer's add-time controls sit on the right, where the rest of that
surface's controls already are.

## Evidence and Current Behavior

- `src/features/session/ExerciseView.tsx:DomeStrip` —
  `const count = Math.max(plannedSets, setNumber)` with
  `setNumber = sets.length + 1`, and `live = number === setNumber`.
  **This is the defect.** With every planned set logged, `setNumber` is already
  one past the last one, so `count` grows by one and the extra index renders a
  `live` dome — breathing, 96px, the largest object on screen — for a set nobody
  is entering. It is not specific to four sets: two planned and two logged gives
  `max(2, 3) = 3`. The strip has no way to know whether the logger is open, and
  that is the root cause rather than the arithmetic.
- `src/features/session/ExerciseView.tsx` — the `done && !addingExtra` branch
  renders `Next exercise` plus an `Add another set` ghost button. `done` reads
  `sets.length >= planned.plannedSets`, which is already the exercise's own
  count, not a literal.
- `src/domain/session/index.ts:reorderExerciseSessions(list, id, 'up' | 'down')`
  — moves one place and renumbers. Unit-tested; mutation score 97.48%.
- `src/features/session/SessionScreen.tsx:SessionMenu` — `Move earlier` and
  `Move later`, each disabled at the corresponding end, each writing through
  `saveExerciseSessions`.
- `src/db/repositories/exerciseSessions.ts:saveExerciseSessions` — bulk write of
  a whole reordered list, already transactional-by-single-call.
- `src/features/session/ExercisePicker.tsx` — the established pattern for a view
  that takes over the gym-mode frame and returns.
- `src/features/ui/styles.ts:dome(state, size)` — states
  `planned | live | logged | suggested | missed | locked`. **No dashed state
  exists**; DESIGN.md's dome list does not include one.
- `src/db/schema.ts` — v1, frozen. Nothing here needs a schema change.

## Scope

Included:

- **F-1** Free reordering: any exercise to any position, several in one pass.
- **F-2** The add-set affordance becomes a dashed `+` dome at the end of the set
  strip; the `Add another set` button goes.
- **F-3** The rest timer's `+` control, amount field and `seconds` label align
  right.
- **F-4** The strip renders a `live` dome only while a set is actually being
  entered — fixing the phantom dome for every planned-set count.

Excluded:

- Drag-and-drop reordering. Touch drag needs custom pointer handling or a
  dependency; a position control gives the same reach with neither.
- Reordering from anywhere but the open session. Deviation belongs to the
  Session (§11.5); the Routine stays immutable.
- Any Dexie schema change, new dependency, or new design token beyond the dashed
  dome state.
- Persisting which set is being entered. It dies with the screen, as it should.

## Decisions and Assumptions

- **DEC-1** — `reorderExerciseSessions` is **replaced** by a move-to-position
  function rather than joined by one. Two reorder primitives where one suffices
  is the duplication the repo's own rules forbid, and up/down is the special
  case of moving to `index ± 1`.
- **DEC-2** — The reorder panel writes each move as it is made, like every other
  write in gym mode (NFR-03). There is no Save button and nothing to lose by
  leaving.
- **DEC-3** — The dashed `+` dome appears only when no set is being entered.
  While the logger is open, the way to add a set is to log the one on screen.
- **A-1** — A `dashed` dome state is added to `dome()`'s existing state map,
  built from existing tokens. DESIGN.md lists six dome states and does not
  include an "add" affordance; this is a seventh of the same family, not a new
  component. Stop if it cannot be expressed in existing tokens.

## Requirements and Acceptance

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-1 | The set strip shows one dome per logged set, the remaining planned sets, and a `live` dome **only** while a set is being entered. | AC-1: With all planned sets logged and the advance showing, the strip holds exactly as many domes as sets logged — no `live` dome. AC-2: True for 2, 3 and 4 planned sets alike. AC-3: While the logger is open, exactly one `live` dome is shown, numbered `sets.length + 1`. AC-4: An exercise with fewer sets logged than planned still shows the remaining ones as `planned`. |
| R-2 | An extra set is added from a dashed `+` circle at the end of the set strip. The separate button is gone. | AC-5: With the advance showing, a dashed `+` dome sits after the last logged set and opens the logger. AC-6: No `Add another set` button exists. AC-7: The `+` is absent while a set is being entered. AC-8: A set logged through it stores the next `setNumber`. |
| R-3 | An exercise can be moved to any position in the session, and several can be moved in one pass. | AC-9: An exercise can move from first to last in one action. AC-10: Two exercises can be repositioned without leaving the panel. AC-11: After any move, `order` is a contiguous 0-based sequence and `plannedExercises` is untouched. AC-12: Moving an exercise to its current position changes nothing. |
| R-4 | The rest timer's add-time controls are right-aligned. | AC-13: The `+` control, the amount field and the `seconds` label sit at the right edge of the timer shell. |

## Contracts and Risk Controls

Changed:

- `src/domain/session/index.ts` — `reorderExerciseSessions` replaced by
  `moveExerciseSession(list, id, toPosition)`. Pure; renumbers contiguously;
  returns the same list by identity when the move is a no-op.
- `src/features/ui/styles.ts` — a `dashed` dome state.
- `src/features/session/ExerciseView.tsx` — `DomeStrip` learns whether a set is
  being entered and renders the `+`.
- `src/features/session/SessionScreen.tsx` — the menu offers `Reorder exercises`
  instead of two one-step moves; a reorder panel takes over the frame.
- New `src/features/session/ExerciseReorder.tsx`.
- `src/features/session/RestTimer.tsx` — alignment only.

Preserved:

- The Dexie schema at v1; `saveExerciseSessions`; every other domain function.
- Only `ExerciseSession.order` is ever written by a reorder. Routines are
  immutable once accepted (AGENTS.MD).
- `features → db → domain`; the Token-Only Rule.

Risk controls:

- R-1 is a correctness fix to something a lifter reads mid-set. Its tests must
  cover the planned-set counts that differ (2, 3, 4), not just the one reported.
- R-3 replaces tested logic. The replacement carries the same guarantees —
  contiguity, no-op identity, template untouched — and its tests must say so.

## Quality Obligations

- Unit tests in `src/domain/session/index.test.ts` for `moveExerciseSession`:
  first→last, last→first, middle→either end, to its own position (identity),
  an id the list lacks (identity), a position out of range, and contiguity after
  each.
- The existing reorder tests are ported, not deleted: up/down are
  `toPosition = from ± 1`.
- QA: log every set of a 2-set, a 3-set and a 4-set exercise and count the
  domes; add a set from the `+`; move an exercise first→last and check the
  routine detail is unchanged; move two in one pass; read the timer's alignment.
- Static/build: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- Strict profile: changed-line ≥90%, changed-branch ≥80%, mutation on
  `src/domain/session/index.ts` at or above the repo's 80 break threshold, every
  survivor classified.

## Change Surface

Expected: `src/domain/session/index.ts` + test,
`src/features/session/{ExerciseView,SessionScreen,RestTimer}.tsx`,
`src/features/session/ExerciseReorder.tsx` (new), `src/features/ui/styles.ts`.

Do not touch: `src/db/schema.ts`, `src/styles/theme.css`, `package.json`,
`src/domain/progression/`, `src/features/routines/`, `src/features/today/`.

## Planning Decision

Plan required: **No**. One dependency (`moveExerciseSession` before the panel
that calls it); the other three are independent and touch one file each. A plan
would restate the requirement table.

## Stop Conditions

- The dashed dome cannot be built from existing tokens (A-1 false).
- Reordering would need to write outside `ExerciseSession.order`.
- Any requirement appears to need a schema change or a dependency.
