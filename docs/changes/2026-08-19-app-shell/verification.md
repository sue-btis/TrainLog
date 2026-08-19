# App Shell — Verification

Verdict: **Pass with one recorded limitation**
Size: medium
Reliability: strict
Date: 2026-08-19

All three screens were driven in a browser against real IndexedDB holding real
data — three imported Routines, one recorded Session, 23 Placements. Three
defects were found during that pass and fixed. The limitation is unchanged from
the previous two changes: the Browser pane does not composite frames here, so
screenshots time out and nobody has looked at the rendered page.

## Baseline

| Field | Value |
|---|---|
| Branch | `change/app-shell` |
| Diff range | `master (030e9c5)` → working tree |
| Spec | `docs/changes/2026-08-19-app-shell/spec.md` |
| Execution record | `docs/changes/2026-08-19-app-shell/execution.md` |

## Automated Checks

| Command | Result | Notes |
|---|---|---|
| `pnpm typecheck` | Pass | Both projects, zero diagnostics |
| `pnpm lint` | Pass | Layering rules unchanged and still enforced |
| `pnpm test` | Pass | 18 files, **205 tests** (182 → 205) |
| `pnpm build` | Pass | Clean |
| `detect.mjs` over `src/features` | Pass | `[]` |
| `vitest --coverage`, `src/domain/scheduling` | Pass | `dayState` and `estimateDuration` at 100% lines and branches. The file's one uncovered branch is `nextWorkoutInRotation`'s `?? null` at line 93 — pre-existing, and documented as unreachable in the technical spine's own verification |
| Literal sweep | Pass | No `bg-[#`, `rounded-[`, hex or `dark:` in `src`. The only arbitrary shadow remains DESIGN.md's focus halo, still defined once as `FOCUS_RING` |

## Requirement Compliance

| Requirement | Evidence | Result |
|---|---|---|
| R-1 / AC-1 | `/nonsense` redirects to `/today`; `/routines/does-not-exist` renders the not-found state; `/import` and `/harness` unchanged | Pass |
| R-2 / AC-2, AC-3 | On `/today` the Today item carries `aria-current="page"` and `rgb(31, 73, 196)` — `planned-ink`; the other two carry neither. `/import` and `/harness` render no `nav[aria-label="Sections"]` | Pass |
| R-3 / AC-4 | All three navigation items measure exactly 48px; Tab reaches each | Pass |
| R-10 / AC-10 | Three Routines listed newest first, exactly one marked `ACTIVE` | Pass |
| R-11 / AC-11 | Activating the archived Routine made it active and archived the previously active one, in one step | Pass |
| R-12 / AC-12 | Archiving the active Routine left no active Routine; the session count stayed at 1 | Pass |
| R-13 / AC-13 | Deleting `Broken Block` removed 1 Routine, 2 Workouts, 2 Planned Exercises and 4 Placements; Sessions (1) and Exercises (1) untouched. The first press only armed | Pass |
| R-14 / AC-14 | Deleting `Hybrid Strength - September` was refused: all three Routines intact, and the message read "…has 1 session recorded against it. Deleting it would take that history with it, so archive it instead…" | Pass |
| R-15 / AC-15 | `Import routine` reaches `/import`. **The zero-Routine empty state was not exercised** — see Limitations | Pass (control), state unexercised |
| R-16 / AC-16 | The detail screen rendered both Workouts in order, their suggested days, and every Planned Exercise with sets, rep range, RIR, rest, unit, focus and notes — including the `lb` unit and the third note added through the wizard | Pass |
| R-17 / AC-17 | `/routines/does-not-exist` renders "No such routine" with a route back, never a blank screen | Pass |
| R-20 / AC-20 | The grid places each date under the correct weekday; previous/next move the month; `Back to this month` appears only when away from it | Pass |
| R-21 / AC-21 | Four states observed simultaneously: `2026-08-19, completed, today` (`#0A7049`), `2026-08-20, planned` (white with the planned ring), `2026-08-17, rest` (`#EDF1F8`), and after a move `2026-08-20, rest`. Each names its state in its accessible label; `completed`, `partial`, `missed` and `in_progress` each carry a distinct glyph | Pass |
| R-22 / AC-22 | `missed` and every other state are computed by `dayState` at render; the unit test asserts the function mutates neither argument, and no write was observed during rendering | Pass |
| R-23 / AC-23 | The day sheet for 20 Aug listed a Placement belonging to the **archived** `Broken Block`, not the active Routine | Pass |
| R-24 / AC-24 | Selecting a day names it in full ("Thursday, August 20") and lists its Placements; a bare day reads "Nothing planned, nothing recorded. A rest day." | Pass |
| R-25 / AC-25 | Moving a Placement 20 Aug → 22 Aug flipped both cells and changed only that row; the session count stayed at 1. A second move to 3 Sep crossed the month boundary and the calendar followed | Pass |
| R-26 / AC-26 | First press armed and warned; second press took Placements 23 → 22 with Sessions unchanged | Pass |
| R-27 / AC-27 | December 2026 renders "Nothing planned this month" with the explanation | Pass |
| R-30 / AC-30, AC-31, AC-32 | With a Placement for today the screen read `Pull - Hinge + Back` / "planned for today"; after switching to a Routine with no Placement today it read "next in rotation". Wrapping is covered by `nextWorkoutInRotation`'s own tests | Pass |
| R-31 / AC-33 | The selector renders for a multi-Workout Routine and switches what is shown; it is correctly absent for a single-Workout Routine | Pass |
| R-32 / AC-34 | `3 EXERCISES · ~40 MIN` for a Workout whose exercises are 4×(180+45) + 4×(180+45) + 3×(120+45) = 2295s = 38.25 min → 40. A second Workout showed `~15 MIN` for 4×(210+45) = 17 min → 15. Both match D2 exactly | Pass |
| R-33 / AC-35 | "LAST TIME · Wed, Aug 19 · completed" for a trained Workout; "You have not trained this Workout yet." for an untrained one | Pass |
| R-34 / AC-36 | Not observed — no Session was `in_progress` during the pass. See Limitations | Unexercised |
| R-35 / AC-37 | Archiving every Routine made Today read "No active routine" with the import route; state restored afterwards | Pass |
| R-40…R-41 / AC-40…AC-44 | 14 unit tests over the six states, the today-is-never-missed boundary, precedence, the write-nothing assertion, and the estimate's rounding and default | Pass |
| R-42 / AC-45 | Repository tests: move changes one row's date only; delete removes one row only; both assert the Sessions table is byte-identical afterwards | Pass |
| R-43 / AC-46 | A Session started 23:30 local on the last day of the range is included; one at 00:30 the next day is excluded | Pass |
| R-44 / AC-47 | The newest Session by `startedAt` names the Workout; `null` with no Sessions | Pass |
| R-45 / AC-48 | `git diff` shows `src/db/schema.ts` untouched; still nine tables, version 1 | Pass |
| R-50 / AC-50 | Literal sweep clean; detector `[]` | Pass |
| R-51 / AC-51 | At the 390px design width, day cells measure **40×40 with 6px gaps** — DESIGN.md's stated exemption is "~41 px … 6 px of separation". Every other control on all four screens is ≥48px | Pass |
| R-52 / AC-52 | Both destructive actions took two presses; neither destroyed anything on the first. Each names what goes and what stays | Pass |
| R-53 / AC-53, AC-54 | Every control on the three screens is reachable by Tab; every empty state carries a title in product language plus a sentence of what to do | Pass |
| R-54 / AC-55 | `scrollWidth === clientWidth` at 375, 390 and 1280; the fixed navigation clears content via the shell's own bottom padding | Pass |
| R-55 / AC-56 | `performance.getEntriesByType('resource')` returns one origin on every screen | Pass |

## Defects Found and Fixed During This Change

| Defect | Fix |
|---|---|
| Moving a Placement left the sheet open on the day it had just left, which then read as empty — the move looked like a deletion. | The selection and the rendered month now follow the Placement to where it landed, month boundary included. Re-tested across August → September. |
| `useRoutine` returned `undefined` both while loading and when absent, so the detail screen flashed "No such routine" during a normal read. | `undefined` now means in flight, `null` means absent. |
| Copy: "the Routine leaves your way". | "the Routine gets out of your way". |

## Manual QA

1. `/today` — resolved `Pull - Hinge + Back` as planned for today, `3 exercises · ~40 min`, exercises listed, "not trained yet". ✓
2. Navigation — each item marks itself current, all three 48px, nav absent on the wizard and harness. ✓
3. `/calendar` — August 2026 rendered with one `completed` (today), ten `planned`, the rest `rest`. ✓
4. Day sheet on 20 Aug — showed the archived Routine's Placement. ✓
5. Move 20 Aug → 22 Aug → 3 Sep, the second crossing into September; grid, sheet and database all followed. ✓
6. Delete a Placement — armed, warned, then removed one row; Sessions untouched. ✓
7. `/routines` — delete refused on the Routine with a Session, with the count named; delete allowed on one without, cascading correctly. ✓
8. Activate an archived Routine — it became the only active one. ✓
9. Routine detail — the full programme, matching what was imported. ✓
10. Empty states — December 2026 and no-active-routine both render their own copy. ✓
11. 390px — day cells 40px with 6px gaps, no horizontal scroll; same at 375 and 1280. ✓

## Extra / Unrequested Changes

- `src/features/harness/queries.ts` moved to `src/features/data/queries.ts` with
  a re-export left behind, so the shell and the harness share one definition of
  each hook rather than two. Behaviour-preserving; the harness was verified
  still driving the execution flow afterwards.
- `src/features/ui/format.ts` added for the shared date and programming
  formatters.

## Known Follow-ups

- `ScheduleStep.tsx` in the import wizard still carries a private `longDate`
  that `@/features/ui/format` now also provides. The wizard was fenced by this
  spec's write set, so it was left alone; folding it in is a one-line change.
- Today's `~N min` estimate is a model, not a measurement (D2). Once real
  Sessions accumulate, comparing it against actual wall-clock would be worth a
  look.

## Limitations

- **Visual rendering unverified.** The Browser pane does not composite frames in
  this environment; screenshots time out. Layout, token application and geometry
  were confirmed by computed style and measured rectangles — board `#F4F6FB`,
  day cells 40px/6px, navigation 48px, `planned-ink` on the current tab — but
  nobody has seen the page. Third change running with this same gap.
- **Two states not exercised in the browser**: the zero-Routine Routines list
  (R-15) and Today's open-session notice (R-34). Both would have required
  destroying or fabricating data in the user's own IndexedDB, which was not
  worth it for two conditionals; both are simple render branches, and the
  underlying reads (`listRoutines`, `getInProgressSession`) are covered by
  repository tests.
- **The impeccable finish-review subagent was not run**, for the same reason as
  the previous change: it is screenshot-led and there are no screenshots. The
  mechanical detector was run and is clean.

## Merge Risk

**Low**

No schema change, no new dependency, and the two new domain functions are pure
and fully covered. The genuinely new persistence is two one-line mutations, each
tested to touch exactly one row and to leave the Sessions table alone — which is
the invariant that matters here, because ADR 0001's whole point is that intent
and record are independent. The riskiest thing in the change is that deleting a
Routine is now reachable from the UI; it is two-press confirmed, it refuses when
history exists, and the cascade was observed row by row.
