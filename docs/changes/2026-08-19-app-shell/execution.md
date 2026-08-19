# App Shell — Execution

Status: **Completed**

## Baseline

| Field | Value |
|---|---|
| Repository | `C:\Users\Josue Escobar\Documents\projects\mine\TrainLog` |
| Branch | `change/app-shell`, cut from `master` |
| Planned base | working tree on `change/technical-spine` (as the spec declared) |
| Actual start commit | `030e9c5` on `master` |
| Working tree before edits | clean, except this change's own `docs/changes/` folder |
| Pre-existing relevant changes | none |

## Preflight Verdict

**Safe**, with one recorded baseline discrepancy.

The spec declared its base as a working tree on `change/technical-spine`. Between
writing the spec and starting implementation the change owner merged that branch
(`371954a`) and committed the import wizard work as `030e9c5` on `master`. The
content is identical to what the spec was written against — verified by reading
`030e9c5 --stat` and re-running all four gates on `master` before editing, all
green. Recorded rather than silently accepted, because "the base moved" is
exactly what preflight exists to catch.

A branch was cut before any edit, per the repository's own convention of one
`change/*` branch per change.

## Order Executed

The spec's order, sequentially, one writer:

1. **Domain** — `dayState`, `estimateDuration` and its three frozen constants
   appended to `src/domain/scheduling/index.ts`, with 14 tests.
2. **Persistence** — `movePlacement`, `deletePlacement` in the placements
   repository (whose header comment deferring them was rewritten to describe
   what they now do); `listSessionsBetween`, `getLastPerformedWorkout` in the
   sessions repository; all four exported from `src/db/index.ts`. 9 tests.
3. **Shell** — `src/features/shell/AppShell.tsx` (layout route + glass bottom
   navigation over the colour bloom) and the routes in `src/App.tsx`.
4. **Routines** — list with activate / archive / delete-with-refusal, and the
   read-only detail screen.
5. **Calendar** — month grid, `DayCell`, legend, and the inline day sheet with
   move and delete.
6. **Today** — resolution, Workout selector, exercise list, estimate, last
   session, open-session notice, empty state.

## Deviations from the Write Set

- **`src/features/harness/queries.ts` was moved** to
  `src/features/data/queries.ts`, with the old path left as a re-export so the
  harness panels are untouched. The spec fences `src/features/harness/**` to
  "beyond what routing requires"; the shell needed the same six hooks, and one
  shared module is the alternative to duplicating them. Behaviour-preserving,
  and the same promotion the wizard change performed on `styles.ts`.
- **`src/features/ui/format.ts` is new** and holds the date and programming
  formatters the three screens share. `ScheduleStep.tsx` in the import wizard
  still has its own private `longDate`; the wizard is fenced, so it was left
  alone. Folding it in is a one-line follow-up, noted in verification.

## Defects Found and Fixed During Implementation

| Defect | Fix |
|---|---|
| Moving a Placement left the day sheet open on the day it had just left, showing an empty day. | The move now follows the Placement, switching the selected day and the rendered month with it. |
| `useRoutine` returned `undefined` both while loading and when the Routine did not exist, so the detail screen flashed "No such routine" during a normal read. | The hook distinguishes them: `undefined` while in flight, `null` for absent. |
| Copy: "the Routine leaves your way". | "the Routine gets out of your way". |

## Checks

All run on the final tree:

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass |
| `pnpm test` | Pass — 18 files, **205 tests** (182 before, +23) |
| `pnpm build` | Pass |
| `detect.mjs` over `src/features` | `[]` |
| `vitest --coverage` on `src/domain/scheduling` | 100% lines, 100% branch on both new functions |

Browser QA is recorded in `verification.md`.

## Stop Conditions

None triggered. Dexie stayed at schema version 1; every query the three screens
make is served by an index version 1 already declares.
