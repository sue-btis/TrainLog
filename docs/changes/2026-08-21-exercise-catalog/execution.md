# Exercise Catalog — Execution

## Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Branch | `change/exercise-catalog`, cut from `master` |
| Planned base | `8b5074c` |
| Current start commit | `8b5074c` — identical |
| Working tree before edits | `M docs/PRD.md`, `?? docs/changes/2026-08-21-exercise-catalog/` |
| Pre-existing relevant changes | The `docs/PRD.md` edit is prior user work inside this change's write set (the V1.0 listing of this item). Preserved and built on, never reverted. |

## Preflight Verdict

**Safe.**

Base matches the spec exactly, the only overlapping change is expected and
owned by this change, and no lockfile, generated file or project file was dirty.

## Execution Topology

Quick direct — single sequential writer in the shared tree. No subagents, no
worktrees; the spec declared no plan and no parallelism.

## Executed Work

| Task | REQ IDs | Status | Files Changed | Checks | Evidence |
|---|---|---|---|---|---|
| Pure grouping/filtering + tests | R-3, R-4, R-5, R-6, R-7, R-10 | Completed | `src/domain/catalog/index.ts`, `src/domain/catalog/index.test.ts` | `pnpm vitest run src/domain/catalog/index.test.ts` | Red first: `TypeError: groupExercises is not a function`, **7 failed / 15 passed**. Green after: **22 passed**. |
| Catalog screen | R-1, R-2, R-8, R-9 | Completed | `src/features/exercises/ExerciseCatalogScreen.tsx` (new) | typecheck, lint | Browser QA below |
| Route | R-1 | Completed | `src/App.tsx` | build | `/exercises` and `/exercises/:exerciseId` both resolve |
| Shell wiring | R-12, R-13 | Completed | `src/features/shell/AppShell.tsx` | Browser QA | Six route families checked |
| More entry point | R-11 | Completed | `src/features/more/MoreScreen.tsx` | Browser QA | Third row present |
| PRD | R-15 | Completed with deviation | `docs/PRD.md` §10, §38, §39 | — | See Deviations |

## Integration Gates

| Gate | Owner | Diff Inspected? | Checks | Result |
|---|---|---:|---|---|
| Final | this session | Yes | `pnpm typecheck && pnpm lint && pnpm test && pnpm build` | All four green. `git status` matches the spec's write set exactly — no lockfile, config or generated file touched. |

`pnpm test`: **26 files, 380 tests, all passing.** `pnpm build`: succeeded; the
`>500 kB chunk` notice is Vite's standing warning for this bundle, not a new
error.

## Requirement Status

Verified in a real browser at 375 × 812 against the dev server on `:5233`, on an
install that already carried an imported routine.

| Req | Implementation | Acceptance Evidence | Status |
|---|---|---|---|
| R-1 | Route added beside the existing `:exerciseId` route | `/exercises` renders the list; `/exercises/box-squat` still renders history. Neither shadows the other. | Completed |
| R-2 | `[...(user ?? []), ...CATALOG]` | **97 rows** = 96 catalog + the 1 user-created Exercise, each once | Completed |
| R-3 | `groupExercises` | 12 category groups, alphabetical, each headed `back / 17 EXERCISES` … | Completed |
| R-4 | `category ?? UNCATEGORIZED`, sorted last | The install holds **"Sandbag Bear Hug Carry"** with `category: null`; it renders in a trailing `uncategorized` group of 1 rather than vanishing | Completed |
| R-5 | `normalizeExerciseName` on both sides | Typing `"  front   SQUAT "` → 1 group, 1 row, `/exercises/front-squat`; the other 11 groups are not rendered | Completed |
| R-6 | `Select` + equality on `equipment` | Selecting `barbell` → **34 rows, zero non-barbell**; `uncategorized` (equipment `null`) correctly disappears; returning to *Any equipment* restores 97 | Completed |
| R-7 | Both filters in one pass | `squat` + `barbell` → back-squat, box-squat, front-squat, overhead-squat, pause-squat. Trigger still reads `barbell`, field still reads `squat` | Completed |
| R-8 | `Link` per row | Clicking Box Squat → `/exercises/box-squat`, header **"Box Squat"**, *"not performed yet" / "No history yet"* — the name resolved from the catalog, not the fallback word "Exercise" | Completed |
| R-9 | Empty-state `WELL` | `cable moon walk` → 0 rows and the empty state naming the query | Completed |
| R-10 | `groupExercises` in `src/domain/catalog/index.ts`; no React, no Dexie | 7 focused tests; `features → db → domain` intact | Completed |
| R-11 | Third `Link` in More | More lists `/routines`, `/sessions`, `/exercises` in that order, above Settings | Completed |
| R-12 | New `catalog` branch in `AppShell` | `/exercises` → title **"Exercises"**, back **"Back to More"**. Regression across all five existing families: `/routines` → "Routines" / Back to More; `/routines/:id` → "Routine" / link back to Routines; `/sessions` → "History" / Back to More; `/sessions/:id` → "Session" / retracing Back; `/exercises/:id` → "Exercise" / retracing Back, which now lands on the catalog | Completed |
| R-13 | `sections.ts` untouched | 4 tabs on every screen visited | Completed |
| R-14 | No fetch, no write | Every network request is a Vite dev module load on `localhost`; no external host. `exercises` object store still holds **1 row** after the full QA pass | Completed |
| R-15 | §10, §38, §39 | See Deviations | Completed with deviation |

## Deviations

- **R-15 / AC-15, one clause.** The spec asked for a **row in the §38 table**.
  §38's table is explicitly scoped `MVP 0.1`, and this screen is explicitly *not*
  MVP 0.1 — §38's own closing line is what tracked it as out of scope. Adding a
  V1.0 item as a row would contradict the table's heading. Instead that closing
  line now records the screen as built, names its files, and states that nothing
  remains pending from MVP 0.1. §10 and §39 were updated as specified. The
  requirement's intent — the PRD records the screen as built — is met; its
  literal placement is not. Flagged for the change owner.

## Ownership / Contract Conflicts

None. `git status` lists exactly the spec's declared write set. No lockfile,
`stryker.config.json`, `sections.ts`, `data.ts`, `ExercisePicker.tsx`, `db/**` or
`features/history/**` change.

## Blockers

None. No stop condition triggered: `category` and `equipment` were nullable as
assumed, `AppShell` extended in four small edits without restructuring, the
pre-existing PRD edit was preserved, and no regression route changed behaviour.

## Independent Verification Readiness

**Ready.**

Two limitations for the verifier to weigh:

1. **No screenshot.** The Browser pane was not displayed in this session, so
   `computer` screenshots and real mouse input were unavailable. QA was done
   through the DOM: `read_page`, `form_input`, and dispatched events. Visual
   fidelity against DESIGN.md — spacing, the One Surface Rule, type scale — is
   therefore **asserted from the code's use of the shared tokens, not observed.**
2. **The equipment `Select` was driven by keyboard events**, because Radix
   ignores synthetic pointer events. Opening and choosing worked, so the control
   is keyboard-operable; pointer operation is inherited from Radix and unverified
   here.
