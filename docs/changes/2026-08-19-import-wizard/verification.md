# Import Wizard UI — Verification

Verdict: **Pass with one recorded limitation**
Size: medium
Reliability: strict
Date: 2026-08-19

The wizard was driven end to end in a browser against real IndexedDB: a
structurally invalid file, a file carrying all six semantic issues corrected
inside the wizard, an edit, a reorder, a delete, a day change, a weeks change,
`Accept`, and a second import that archived the first. Three defects were found
during that pass and fixed; all four gates are green afterwards.

The limitation is visual: the Browser pane in this environment does not
composite frames, so screenshots time out and nobody has looked at the rendered
page. Everything below was verified through the DOM, computed styles, network
entries and IndexedDB contents.

## Baseline

| Field | Value |
|---|---|
| Repository | `C:\Users\Josue Escobar\Documents\projects\mine\TrainLog` |
| Base | `8df1bd6` (`change/technical-spine`) |
| Diff range | `8df1bd6` → working tree |
| Spec | `docs/changes/2026-08-19-import-wizard/spec.md` |

## Automated Checks

| Command | Result | Notes |
|---|---|---|
| `pnpm typecheck` | Pass | Both projects, zero diagnostics |
| `pnpm lint` | Pass | Zero diagnostics, layering rules unchanged |
| `pnpm test` | Pass | 18 files, **182 tests** (179 before, +3 from the toggle fix) |
| `pnpm build` | Pass | Built clean |
| `detect.mjs` (impeccable design detector) | Pass | `[]` over `src/features/import`, `src/features/ui`, `theme.css` |
| Literal sweep | Pass | No `bg-[#`, `rounded-[`, hex or `dark:` anywhere in `src`. The only arbitrary shadow is DESIGN.md's own focus halo, defined once as `FOCUS_RING` |

## Requirement Compliance

| Requirement | Evidence | Result |
|---|---|---|
| R-1 | `/` redirects to `/import`; `/harness` renders the Session harness, lists the newly imported Routine as active and still derives `102.5 kg` from history. `ImportPanel.tsx` deleted | Pass |
| R-2 | Selecting a file leaves `routines` untouched; nothing is written before `Accept` | Pass |
| R-3 | `routine-structurally-invalid.yaml` → "Import failed", six errors listed by field path (`version`, `routine.name`, `routine.workouts[0].name`, …), no step reachable | Pass |
| R-4 | The example file renders both Workouts, all six exercises, each summarised as `4×4–6 · RIR 1–2 · 210s · kg` | Pass |
| R-5 | `unit` kg→lb and a third note line both reached the stored `PlannedExercise` verbatim | Pass |
| R-6 | Removing an exercise took the Workout from 2 to 1; the survivor stored with `order: 0` | Pass |
| R-7 | "Move Front Squat down" reordered the list; the open row followed the exercise and its "down" control became disabled at the end | Pass |
| R-8 | Four fields carried `aria-invalid="true"`, each `aria-describedby` resolving to a real error line naming problem and fix (`Min reps (12) is above max reps (8). Lower min reps, or raise max reps, so min is not above max.`) | Pass |
| R-9 | `Accept` disabled with issues outstanding; each correction cleared its own mark live, 6 → 5 → 1 → 0, and the button enabled at zero | Pass |
| R-10 | Unchecking a day and stepping weeks both changed the generated schedule; 4 weeks → 11 sessions, 3 → 8, 1 → 2 | Pass |
| R-11 | `Push and Pull both suggest monday.` marked on both Workouts, both Monday cells filled `#B32530`; unchecking one cleared it instantly | Pass |
| R-12 | An edit made on Step 1 survived Step 2 and back | Pass |
| R-13 | Stored Routine, 2 Workouts, 6 Planned Exercises, 1 created user Exercise (`Sandbag Bear Hug Carry`), 11 Placements. First Placement is today (`2026-08-19`); none earlier | Pass |
| R-14 | After three successive imports, `routines` holds exactly one `active` — the newest — and two `archived`, including a Routine imported by an earlier session | Pass |
| R-15 | Covered by repository test (`leaves the previous Routine active when the import fails`) and by the reducer keeping the draft on `acceptFailed`. **The UI half was not exercised in the browser** — inducing a mid-transaction IndexedDB failure from the page was not attempted | Pass (test), unexercised in QA |
| R-16 | Confirmation reports "2 workouts / 6 exercises / 11 sessions, placed 2026-08-19 → 2026-09-11", matching the database exactly | Pass |
| R-17 | Loading a second file left no value from the first on screen | Pass |
| R-18 | Literal sweep clean; detector returns `[]`; no dark variant | Pass |
| R-19 | Zero interactive controls under 48px at 375px width. Every field wired with `aria-invalid`/`aria-describedby`. Reorder and delete controls carry labels naming their exercise | Pass |
| R-20 | `scrollWidth === clientWidth` at 375px and at 1280px; the column caps at 512px and centres | Pass |
| R-21 | `performance.getEntriesByType('resource')` shows one origin, `http://localhost:5173`. No third party | Pass |

## Defects Found and Fixed During Verification

| # | Defect | Fix |
|---|---|---|
| 1 | **Stale-closure edits on Step 2.** `onWeeks(weeks - 1)` and the day toggle both computed the next value from their own render, so two taps before React re-rendered lost one. Reproduced: three rapid decrements moved 4 → 3. | The two Step 2 edits became intent (`weeksBy`, `toggleDay`) resolved in the reducer against the current file, and `setSuggestedDays` was replaced by a pure `toggleSuggestedDay` in the domain. Re-tested: three rapid decrements now land on the `MIN_WEEKS` clamp. Three tests added. |
| 2 | **Hidden file input was a tab stop.** The `sr-only` input took focus before the visible button — an invisible stop with no focus indicator. | `tabIndex={-1}` and `aria-hidden`; the button is the control. |
| 3 | **Copy defect.** The live region read "1 problem still block this import." | Pluralised properly. |

## Manual QA

1. `routine-structurally-invalid.yaml` → refusal screen, errors by field path, no wizard step. ✓
2. `routine-with-semantic-errors.yaml` → loads with 6 problems; both offending rows auto-open and cannot be collapsed; the action bar lists all six with their step. ✓
3. Jump from the action bar to the shared-day issue → switched to Step 2, focused the Push Workout section, `Accept` disabled. ✓
4. Corrected max reps, sets, rest and RIR by typing → each mark cleared as typed, count fell 5 → 1. ✓
5. "Use manual progression" on the unrecognized type → last issue cleared, both rows collapsed, `Next` enabled. ✓
6. Moved an exercise down, then removed its neighbour with the two-press confirm (first press armed a red "Remove it" beside "Keep it", nothing deleted). ✓
7. `Accept` → confirmation; IndexedDB matched it field for field. ✓
8. Imported a second routine → the first became `archived`, the new one is the only `active`. ✓
9. `/harness` → still starts Sessions and derives progression from history that survived the re-import. ✓
10. All three files in `docs/examples/` loaded through the real file input. ✓

## Extra / Unrequested Changes

- `docs/examples/routine.yaml`, `routine-with-semantic-errors.yaml`,
  `routine-structurally-invalid.yaml` — added at the change owner's request
  during verification, each with a header explaining what it exercises.
- `src/styles/theme.css` gained `@utility bloom` and `@utility glass`, the two
  materials DESIGN.md specifies in prose and `theme.css` had never implemented.
  Permitted by the spec's change surface ("add it there rather than inlining a
  value"); no token value was changed.
- `src/db/repositories/routines.test.ts` — TST-020 now stages its two-active
  state directly, because R-14 makes two imports unable to produce it.

## Deviations from Spec

- **DESIGN.md §6 prescribes `cva`**; this change uses plain variant maps through
  the existing `cn()`. Recorded as an approved assumption in the spec, with the
  upgrade path named. No dependency added.
- **§11.1 does not list progression as editable**, but does call an unrecognized
  progression type a semantic issue corrected inside the wizard. Resolved with a
  single repair action — *Use manual progression* — rather than a progression
  editor.

## Observations Outside This Change

- **An inverted RIR range is not validated.** `rir: { min: 4, max: 3 }` passes
  every check and imports, because §11.1's semantic list names only "RIR fuera
  del rango permitido" (bounds), not an inverted range — unlike reps, which has
  an explicit `min_reps > max_reps` check. Domain behaviour, matching the PRD as
  written. Worth a PRD decision rather than a silent UI check.

## Limitations

- **Visual rendering unverified.** The Browser pane does not composite frames in
  this environment; screenshots time out. Token application was confirmed by
  computed style (board `#F4F6FB`, heading Archivo 32px `wdth 112`, clash cells
  `#B32530`, pressed days `#1F49C4`), but nobody has seen the page.
- **The impeccable finish-review subagent was not run.** It is a screenshot-led
  review and there are no screenshots to give it; the session also holds a
  standing instruction not to spawn agents unrequested. The mechanical detector
  was run instead and returns clean.
- **R-15's UI path was not exercised in the browser** (see the table).

## Merge Risk

**Low**

No schema change, no migration, no new dependency. The only change below the UI
is `importRoutine` gaining a demotion inside its existing transaction, covered
by two tests including the failure path. The domain edit module is pure and
fully tested. The one thing merging cannot tell you is what the wizard looks
like — the same gap the technical-spine change recorded, and it will close the
first time a human opens `/import`.
