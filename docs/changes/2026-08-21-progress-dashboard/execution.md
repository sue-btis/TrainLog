# Progress Dashboard — Execution

## Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Branch | `change/progress-dashboard`, cut from `master` |
| Planned base | `fa3e726` |
| Current start commit | `fa3e726` — identical |
| Working tree before edits | Clean; only `docs/changes/2026-08-21-progress-dashboard/` untracked (this change's own spec) |
| Pre-existing relevant changes | None. `git status --porcelain` over the whole declared write set returned empty |

## Preflight Verdict

**Safe.**

Planned base and current commit agree, no unrelated work overlaps the write
set, and all four validation commands were confirmed runnable before editing
(`pnpm` 11.5.0, Node 24.14.0, `node_modules` present).

## Execution Topology

Sequential, single owner, shared tree. No subagents, no worktrees. The spec
declared no plan and none was needed.

## Executed Work

| Task | R IDs | Status | Files Changed | Checks | Evidence |
|---|---|---|---|---|---|
| 1. `exerciseSeries` | R-1, R-2, R-3 | Completed | `src/domain/history.ts`, `src/domain/history.test.ts` | `pnpm test`, `stryker` | Red first: 9 tests failed with `exerciseSeries is not a function`; green after implementation. Reuses the existing `setsOf` and `better` |
| 2. `listPerformedExercises` | R-4 | Completed | `src/db/repositories/history.ts`, `…/history.test.ts` | `pnpm test` | Red first: 2 tests failed; green after. One `orderBy('exerciseId').uniqueKeys()` walk on the declared index |
| 3. Read wiring | R-4, R-5 | Completed | `src/db/index.ts`, `src/features/data/queries.ts` | `pnpm typecheck` | `usePerformedExercises` over the barrel export |
| 4. **De-index `AppShell`** | R-9, R-10 | Completed | `src/features/shell/AppShell.tsx` | `pnpm typecheck`, browser | Done **before** the membership change, per the spec's risk control 2. Correct in both states: `/routines` was still a section at this point, so the new branch stayed inert |
| 5. `SECTIONS` membership | R-9 | Completed | `src/features/shell/sections.ts` | `pnpm typecheck`, browser | Progress in, Routines out. Header comment rewritten — it documented the contract this change dissolves |
| 6. Routines under More | R-9 | Completed | `src/features/more/MoreScreen.tsx` | browser | Built on the `/sessions` row pattern already in the file |
| 7. Recharts | R-6 | Completed | `package.json`, `pnpm-lock.yaml` | `pnpm build` | `recharts@3.10.1`, React 19 compatible |
| 8. Screen + chart | R-5, R-6, R-7, R-8 | Completed | `src/features/progress/{ProgressScreen,ExerciseChart}.tsx` (new) | browser, `pnpm lint` | Skinned against DESIGN.md §Charts; verified by computed style, not by eye |
| 9. Route | R-5 | Completed | `src/App.tsx` | browser | `/progress` inside the shell |
| 10. Docs | R-12 | Completed | `docs/PRD.md` | read-back | §10, §11.11, §31 Screen 4, §38 |

## Requirement Status

| Requirement | Implementation | Acceptance Evidence | Status |
|---|---|---|---|
| R-1 | `exerciseSeries` in `domain/history.ts` | AC-1a–f each carry a test; 9 tests, all green. Mutation: every mutant generated in the new function was killed | Completed |
| R-2 | Filter is `setsOf(entry).length > 0`, no status narrowing (DEC-8) | AC-2 test green. Also observed live: the only Session in the dev database is `in_progress` and its sets are charted | Completed |
| R-3 | Every figure reads `weightKg` | AC-3 test green (100 lb ranks below 50 kg) | Completed |
| R-4 | `listPerformedExercises` on `exerciseSessions.exerciseId` | AC-4a, AC-4b tests green. AC-4c: `git diff --name-only` contains neither `db/schema.ts` nor `db/migrations.ts` | Completed |
| R-5 | `ProgressScreen` | AC-5a: selector switched to Overhead Press, options alphabetical. AC-5b: pointer sequence on the Volume trigger moved the selection and the chart label became *"Front Squat volume: one session, 30 kg."* AC-5c: Progress reports best `2.5 kg × 6`; `/exercises/front-squat` reports `2.5 × 6`. AC-5d: `Select` and `Tabs` are the app's existing Radix controls, keyboard-operable, with `aria-label="Metric"` and a `<label>` on the selector | Completed |
| R-6 | `ExerciseChart` | AC-6a by computed style: grid `stroke=var(--color-rule)` → `rgba(126,158,160,0.24)` dashed `3 5`, horizontal only; dot `r=6` (latest) filled `var(--color-card)`, stroked `var(--color-actual)` → `rgb(15,155,103)` at 2.5; 0 axis lines, 0 tick lines; ticks Martian Mono 10px `rgb(78,88,110)`; 0 gradient elements. AC-6b, AC-6c greps clean | Completed — one gap, below |
| R-7 | `role="img"` + worded label, `overflow-x: auto` | AC-7a: label read *"Front Squat top set: one session, 2.5 kg."* — names exercise, metric and reading. AC-7b at 375 px: `documentElement.scrollWidth === clientWidth === 375`; the chart's own container reports `overflow-x: auto` | Completed |
| R-8 | Three states in `ProgressScreen` | AC-8b observed directly: Overhead Press has an ExerciseSession and no sets, and renders *"No sets for Overhead Press"* with no chart in the DOM. AC-8c: `undefined` renders "Reading history…", distinct from empty | Completed — AC-8a not reproducible, below |
| R-9 | `AppShell`, `sections.ts`, `MoreScreen` | AC-9a: `/progress` and `/more` mark their tabs active. AC-9b: More carries a Routines row → `/routines`. AC-9c: `/routines` titled "Routines", back `aria-label="Back to More"` → `/more`. AC-9d: routine detail titled "Routine", back "Back to Routines" → `/routines`. AC-9e: from `/exercises/front-squat` reached via the routine detail, back is a retracing button and `history.back()` landed on that routine detail. AC-9f: `/routines` and `/sessions` mark no tab active | Completed |
| R-10 | Positional read removed | AC-10: `grep -rn "SECTIONS\[" src/` returns nothing | Completed |
| R-11 | No network API introduced | AC-11b: grep for `fetch(`/`XMLHttpRequest`/`WebSocket`/`sendBeacon` over the new and changed files returns nothing; console clean | Partial — AC-11a deferred, below |
| R-12 | `docs/PRD.md` | AC-12a: §10 now states four tabs and a "Bajo `More`" section naming Routines and History. AC-12b: §11.11 keeps four MVP metrics and records why they are one chart. AC-12c: §31 Screen 4 lists selector, best set, metric switch, chart. AC-12d: four Progress rows in the §38 table; the closing line now names only §11.12 | Completed |

## Checks

| Command | Result | Evidence |
|---|---|---|
| `pnpm typecheck` | Pass | Both projects clean |
| `pnpm lint` | Pass | No output |
| `pnpm test` | Pass | 26 files, **373 tests** (was 362 at `fa3e726`) |
| `pnpm build` | Pass | 985 ms; 23 precache entries, 1410.20 KiB |
| `pnpm exec stryker run --mutate src/domain/history.ts` | Pass | **93.15%** (68 killed, 5 survived), above `break: 80` and above the 91.07% recorded for the file at `2026-08-20-gym-mode-refinements` |

**Mutation survivors: all five pre-existing.** They sit at `history.ts:48`, `:49`,
`:82`, `:91`, `:92` — inside `better` and `summarizeExercise`. The new code
begins at line 113. Every mutant generated inside `exerciseSeries` was killed;
the file gained 17 mutants and killed 17.

**A-1 evidence — what Recharts cost.** The assumption was that it fits the
precache budget. Measured, by attributing the bundle's sourcemap segments back
to their source packages:

| | |
|---|---|
| Recharts stack, minified | **~289 kB** — 26.5% of the mapped bundle |
| of which `recharts` | 192.6 kB |
| the d3 family (`scale`, `shape`, `time-format`, `color`, `format`, `time`, `array`, `interpolate`, `path`, `internmap`) | ~59.6 kB |
| `@reduxjs/toolkit` + `immer` — Recharts 3.x uses Redux internally | ~19.9 kB |
| `decimal.js-light`, `eventemitter3`, `use-sync-external-store` | ~16.9 kB |
| Whole bundle after | 1,122.38 kB raw / **340.45 kB gzip** |
| Precache | 23 entries, 1410.20 KiB — the same 23 entries recorded at the three previous changes, so nothing new entered the manifest |
| Largest single precache entry | 1.12 MB, under Workbox's 2 MiB default |

**A-1 holds and no stop condition fired**, but the number is worth the change
owner's attention: a quarter of the bundle now serves one screen, and ~20 kB of
it is a state library the app does not otherwise use. Flagged, not decided.

## Deviations

1. **`listPerformedExercises` lives in `src/db/repositories/history.ts`, not
   `exercises.ts`.** The spec's change surface named `exercises.ts`. On reading
   both files, `exercises.ts` is explicitly about resolving an id to an Exercise
   with the catalog-first rule (`exercises.ts:1-8`) and owns the `exercises`
   table; the new read touches `exerciseSessions` and returns ids, which is
   `history.ts`'s subject and index (`history.ts:11-17`). Same requirement, same
   acceptance criteria, same layer — a placement correction, not a scope change.
   Its test moved to `history.test.ts` with it, where the `seedRoutine` and
   `performSession` helpers already existed and were reused rather than
   duplicated.

2. **Two comments reworded after the acceptance greps.** AC-6b and AC-10 are
   specified as greps returning nothing, and two of my own doc comments named
   the banned patterns in prose (`SECTIONS[2]`, a hex literal), tripping both.
   The prose was reworded so the checks are unambiguous for verification. No
   behaviour involved.

3. **`Metric` and `METRICS` are exported from `ExerciseChart.tsx`**, which the
   spec did not name. The metric switch renders in `ProgressScreen` while the
   readings belong to the chart, and one table read by both is preferable to two
   lists kept in step by hand — the same argument `sections.ts` makes.

## Ownership / Contract Conflicts

None. Every edited path was in the spec's expected write set except as recorded
under Deviations, and nothing on the "do not touch" list was modified:
`db/schema.ts`, `db/migrations.ts`, `domain/backup/`, `domain/progression/`,
`domain/session/`, `domain/units.ts`, `features/history/ExerciseHistoryScreen.tsx`,
`features/session/`, `styles/theme.css`, `stryker.config.json`, `pwa/config.ts`,
`shell/BottomNav.tsx` and `shell/TopBar.tsx` are all absent from the diff.
`pnpm-lock.yaml` changed under the single reserved writer, task 7.

## Gaps for Verification

Three acceptance criteria were **not** demonstrated here. None is a known
failure; each needs something this session could not provide.

1. **AC-11a — cold offline load of `/progress`.** Verified only that no network
   API is introduced (AC-11b). The service worker does not run under the dev
   server, so this needs `pnpm preview` with the network cut.
2. **AC-8a — the no-training-at-all empty state.** The dev database already
   holds a Session, and seeding or clearing it would write to the change
   owner's stored training. The code path is the `performed.length === 0`
   branch; its sibling (AC-8b) was observed directly.
3. **The 3.5 px series stroke, on a line with more than one point.** All four
   exercises in the dev database have a single Session, so Recharts renders dots
   without a curve and no `recharts-line-curve` element exists to inspect.
   `strokeWidth={3.5}` is set and typechecked, but was not observed rendered.

Also of note: **no screenshot could be taken.** The Browser pane is not
displayed in this session, so the page never composites frames. The visual
requirements were verified through the accessibility tree and
`getComputedStyle` instead, which for R-6 is the stricter instrument — it reads
the resolved token value rather than a colour a human judges by eye.

## Blockers

None.

## Independent Verification Readiness

**Ready.** Status: **Completed** for R-1 through R-10 and R-12; **R-11 partial**
— AC-11b met, AC-11a deferred to verification with the production preview.
