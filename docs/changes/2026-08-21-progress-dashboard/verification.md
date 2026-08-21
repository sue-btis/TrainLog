# Progress Dashboard — Verification

Verdict: **Pass with accepted limitations**
Base: `fa3e726`
Head/working tree: `fa3e726`, dirty — the change is uncommitted
Reliability: strict

One defect was found and corrected during this pass (V-1, below). Three
acceptance criteria that `execution.md` recorded as gaps were closed here, on a
separate origin, rather than accepted on the implementation's word.

## Independent Baseline

| Field | Value |
|---|---|
| Repository root | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Declared implementation base | `fa3e726` |
| Actual `HEAD` | `fa3e72618b9d01560de50450162af5695ef46b81` — matches |
| Diff range inspected | `fa3e726` → working tree, plus the two untracked directories |
| Unrelated changes in range | **None.** Every modified path is in the spec's write set; the only untracked directories are this change's own |
| Governing artifacts | `spec.md` (Ready for implementation), `execution.md` (Completed). No `plan.md` — the spec declined one |

## Defect Found and Corrected

**V-1 — wrong PRD cross-reference, introduced by this change.** The §10 rewrite
listed the two screens now under `More` as:

```text
Session       el historial de sesiones (§11.8)
```

§11.8 is **Previous Performance** — the panel shown before a set during a
workout (`docs/PRD.md:861`). It is not the session history list, which has no
dedicated §11.x at all: the change that built it cites §38's `History | Sessions`
row as its authority (`2026-08-21-session-history/spec.md:19`). AC-12a requires
§10 to state the truth, and a citation pointing at the wrong feature fails that.

Corrected to `Session history   cada sesión realizada (§38, «History | Sessions»)`,
which also aligns the label with the screen's actual name. Every other reference
introduced by this change was then checked and is correct: §11.2 Routine
Management (`:573`), §11.10 Exercise History (`:956`), §11.11 (`:996`), §11.12
(`:1031`), §11.7 Set Logging (`:820`), and in code DESIGN.md §Layout (`:442`,
containing the overflow rule at `:468`), §Colors (`:331`), §Navigation (`:926`)
and §Charts (`:933`).

## Requirement Evidence

| Requirement / AC | Evidence | Result |
|---|---|---|
| R-1 / AC-1a–f | `domain/history.test.ts`, 9 tests. Re-run independently: pass. Order (AC-1a), sums (AC-1b), skip-empty (AC-1c), two ExerciseSessions collapsing (AC-1d), tie-break (AC-1e), empty input (AC-1f). AC-1d is faithful to production: `assemble()` groups by `sessionId`, so a planned and an unplanned instance of one exercise land in one entry | Pass |
| R-2 / AC-2 | Test asserts three points from `completed` + `partial` + `in_progress`. Corroborated live: the dev database's only Session is `in_progress` and its sets charted | Pass |
| R-3 / AC-3 | Test: 100 lb ranks below 50 kg; volume asserted against `toKg`. Every field reads `weightKg` in the diff | Pass |
| R-4 / AC-4a–b | `db/repositories/history.test.ts`, 2 tests, re-run: pass. Distinct ids across two Routines, empty on empty database | Pass |
| R-4 / AC-4c | `git diff fa3e726 -- src/db/schema.ts src/db/migrations.ts` is empty. No `stores()`, `version(n)` or index string in the diff | Pass |
| R-5 / AC-5a | Selector switched between exercises; options alphabetical (`Bench Press`, `Front Squat`) per DEC-9 | Pass |
| R-5 / AC-5b | Radix trigger driven with a full pointer sequence: selection moved and the chart label became *"Front Squat volume: one session, 30 kg."* A bare `.click()` does **not** move it — that is the probe being inadequate, not a defect; Radix listens on pointer events | Pass |
| R-5 / AC-5c | Progress reports best `2.5 kg × 6`; `/exercises/front-squat` reports `2.5 × 6`. Same `summarizeExercise` call, so they cannot drift | Pass |
| R-5 / AC-5d | `Select` and `Tabs` are the app's existing Radix controls. `<label for>` on the selector, `aria-label="Metric"` on the tablist, `role="tab"`/`aria-selected` published correctly | Pass |
| R-6 / AC-6a | Computed style on a **20-point** series: curve `stroke="var(--color-actual)"` → `rgb(15,155,103)`, **`stroke-width="3.5"`**, `fill="none"`; dots 19 × `r=4.5` with the last at **`r=6`**; grid `var(--color-rule)` → `rgba(126,158,160,0.24)`, `stroke-dasharray="3 5"`, horizontal only; 0 axis lines, 0 tick lines; ticks Martian Mono 10 px `rgb(78,88,110)`; 0 gradient elements; axis text rendered (`Thu, Jan 8 …`, `0 kg … 80 kg`) | Pass |
| R-6 / AC-6b | `grep -nE '#[0-9a-fA-F]{3,8}\b\|bg-\[#\|stroke="#\|fill="#' src/features/progress/*.tsx` → no matches | Pass |
| R-6 / AC-6c | No `src/components/ui/chart.tsx`; `grep -rn "chart-[1-5]" src/` → no matches | Pass |
| R-7 / AC-7a | `aria-label="Bench Press top set across 20 sessions, from 60 to 79 kg — rising."` — names subject, metric, span and direction | Pass |
| R-7 / AC-7b | At a real 375 × 812 viewport with a 20-point series: chart container `scrollWidth 1120` vs `clientWidth 311` and `overflow-x: auto` → scrolls internally; `documentElement.scrollWidth === clientWidth === 375` → **body does not scroll horizontally** | Pass |
| R-8 / AC-8a | **Closed here.** Fresh origin, empty IndexedDB: *"Nothing to plot yet"* with one sentence and a `Go to today` secondary action — DESIGN.md `:949` shape | Pass |
| R-8 / AC-8b | Overhead Press has an ExerciseSession and zero sets: renders *"No sets for Overhead Press"*, and no `[role="img"]` exists in the DOM — no empty axis | Pass |
| R-8 / AC-8c | `undefined` renders "Reading history…", structurally distinct from the empty branch, matching `ExerciseHistoryScreen.tsx:41` | Pass |
| R-9 / AC-9a | Four tabs; `/progress` and `/more` mark themselves active | Pass |
| R-9 / AC-9b | More carries a Routines row → `/routines` | Pass |
| R-9 / AC-9c | `/routines`: title "Routines", back `aria-label="Back to More"` → `/more` | Pass |
| R-9 / AC-9d | `/routines/:id`: title "Routine", back "Back to Routines" → `/routines` | Pass |
| R-9 / AC-9e | From `/exercises/front-squat` reached via a routine detail, back is a retracing button and `history.back()` landed on that routine detail. **This is the regression the de-indexing risked** | Pass |
| R-9 / AC-9f | `/routines` and `/sessions` mark no tab active, matching the pre-existing satellite behaviour | Pass |
| R-10 / AC-10 | `grep -rn "SECTIONS\[" src/` → no matches | Pass |
| R-11 / AC-11a | **Closed here.** Preview server **stopped** (`curl` → connection refused), then a cold load of `/progress?cold=41221` — a URL never previously visited — rendered the full screen from the service worker's precache | Pass |
| R-11 / AC-11b | Network record for that load shows only same-origin shell assets (document, JS, CSS, `registerSW.js`, two woff2), all precache-served. No remote origin, no API call. Grep for `fetch(`/`XMLHttpRequest`/`WebSocket`/`sendBeacon` over new and changed files → no matches | Pass |
| R-12 / AC-12a | §10 states four tabs and a "Bajo `More`" block. **Failed on first inspection (V-1); corrected and re-checked** | Pass after correction |
| R-12 / AC-12b | §11.11 keeps four MVP metrics, records why they are one chart, and leaves the five deferred items untouched. §38 agrees | Pass |
| R-12 / AC-12c | §31 Screen 4 now reads selector / best set / metric switch / chart, and states that the PR timeline stays deferred | Pass |
| R-12 / AC-12d | Four Progress rows added to the §38 table; the closing line now names only §11.12 | Pass |

## Automated Checks

| Command | Result | Notes |
|---|---|---|
| `pnpm typecheck` | Pass | Both projects |
| `pnpm lint` | Pass | No output |
| `pnpm test` | Pass | 26 files, **373 tests**; 362 at `fa3e726`, so 11 net new |
| `pnpm build` | Pass | 988 ms; 23 precache entries, 1410.20 KiB |
| `pnpm exec stryker run --mutate src/domain/history.ts` | Pass | **93.15%**, re-run independently |
| `pnpm exec vitest run --coverage` (scoped) | Pass | See metrics |

## QA Procedure

Run on a **separate origin** (`localhost:4183`, production preview) so the
change owner's stored training at `:5173`/`:5233` was never written to. Fixtures
were seeded into that origin's own IndexedDB and deleted afterwards.

1. Fresh origin, empty database, open `/progress`.
   Expected: empty state, not a blank chart. **Actual:** *"Nothing to plot yet"* + `Go to today`.
2. Seed five weekly Front Squat sessions, 90 → 100 kg. Reload.
   Expected: a five-point rising series. **Actual:** curve with 5 points, `stroke-width 3.5`, last dot `r=6`, label *"…across 5 sessions, from 90 to 100 kg — rising."*, best pill `100 kg × 5`.
3. Switch metric to Volume, then Reps.
   Expected: same sessions, new quantity. **Actual:** selection moves, label re-reads per metric.
4. Seed 20 weekly sessions of a second exercise; select it at 375 px.
   Expected: chart scrolls inside itself, page does not. **Actual:** container `1120` vs `311` with `overflow-x: auto`; document `scrollWidth === clientWidth === 375`.
5. Stop the server; confirm the origin is dead; cold-load a never-visited `/progress?cold=…`.
   Expected: full render from precache. **Actual:** rendered; network shows only precached same-origin assets.
6. Navigation sweep: four tabs; More → Routines → back; routine detail → back; exercise from routine detail → back.
   Expected: labels and destinations per R-9. **Actual:** all as specified, including the retrace landing on the routine detail.
7. Delete the seeded database, unregister the worker, clear caches.
   Expected: origin pristine. **Actual:** `deletedDatabases: ["trainlog"]`, 0 registrations, 0 caches.

## Quality Metrics

- **Changed-line coverage: 100%.** Changed ranges are `domain/history.ts` lines 2, 15 and 99–159, and `db/repositories/history.ts` lines 78–95. The only uncovered lines in either file are `db/repositories/history.ts:39` and `:50`, both inside the pre-existing `assemble()` and outside every changed range.
- **Changed-branch coverage: 100%.** `domain/history.ts` measures 18/18 branches. `listPerformedExercises` has none.
- Whole-file figures for context: `domain/history.ts` 100%; `db/repositories/history.ts` 90.62% statements / 58.33% branches, both pre-existing values unchanged by this diff.
- **Mutation scope and score: `src/domain/history.ts`, 93.15%** (68 killed, 0 timeout, 5 survived, 0 errors). Above the repo's `break: 80`, above the strict profile's 70% default, and above the 91.07% recorded for this file at `2026-08-20-gym-mode-refinements`.
- **Surviving mutants: 5, all pre-existing and all classified.** They sit at `history.ts:48`, `:49`, `:82`, `:91`, `:92` — inside `better` and `summarizeExercise`. The new code begins at line 113, so **no mutant in `exerciseSeries` survived**: the file gained 17 mutants and killed all 17. Lines 91–92 are the `heaviest`/`lightest` strict-vs-loose comparison, equivalent under a tie; `:48`–`:49` are `better`'s tie-break, already asserted behaviourally by two tests that pin which set wins.
- Flaky or skipped tests affecting scope: none. Three consecutive full runs gave 373/373.

## Diff and Scope Review

**Files changed (13 modified, 2 new directories):** `docs/PRD.md`, `package.json`,
`pnpm-lock.yaml`, `src/App.tsx`, `src/db/index.ts`,
`src/db/repositories/history.{ts,test.ts}`, `src/domain/history.{ts,test.ts}`,
`src/features/data/queries.ts`, `src/features/more/MoreScreen.tsx`,
`src/features/shell/{AppShell.tsx,sections.ts}`, plus
`src/features/progress/` and `docs/changes/2026-08-21-progress-dashboard/`.

**Unrelated changes: none.**

**Do-not-touch compliance: full.** Verified empty diffs for `db/schema.ts`,
`db/migrations.ts`, `styles/theme.css`, `stryker.config.json`, `pwa/config.ts`,
`shell/BottomNav.tsx`, `shell/TopBar.tsx`,
`history/ExerciseHistoryScreen.tsx` and `domain/units.ts`.

**Lockfile review.** `package.json` gains exactly one line (`recharts ^3.10.1`).
`pnpm-lock.yaml` is **purely additive** — no removals, no version changes to
existing dependencies. It adds ~25 packages: `recharts`, ten `d3-*`,
`internmap`, `decimal.js-light`, `es-toolkit`, `eventemitter3`, `react-is`, and
a Redux stack (`@reduxjs/toolkit`, `redux`, `react-redux`, `redux-thunk`,
`immer`, `use-sync-external-store`).

**Deviations declared in `execution.md`, assessed.** All three are sound.
Placing `listPerformedExercises` in `repositories/history.ts` rather than
`exercises.ts` is better than the spec's own instruction: `exercises.ts` owns
the `exercises` table and the catalog-first resolution rule, while the new read
walks `exerciseSessions` and returns ids — `history.ts`'s subject and index. The
comment rewordings are prose-only. Exporting `Metric`/`METRICS` from the chart
keeps one table read by two components, which is the argument `sections.ts`
already makes.

## Limitations Accepted

1. **Recharts is 26.5% of the bundle.** Measured by sourcemap attribution:
   ~289 kB minified — `recharts` 192.6 kB, the d3 family ~59.6 kB, Redux Toolkit
   + Immer ~19.9 kB. The bundle is 1,122 kB raw / **340 kB gzip**; precache is
   23 entries / 1410 KiB, the same entry count as the three previous changes,
   and the largest single entry is well under Workbox's 2 MiB default. **A-1's
   stop condition did not fire and this is not a failure** — the spec approved
   Recharts on §8's authority and DESIGN.md §Charts specifies its skin. It is
   recorded because a quarter of an offline-first bundle now serves one screen,
   and ~20 kB of it is a state library the app does not otherwise use. Reversing
   it is a §8 and DESIGN.md decision, not an implementation one.
2. **No screenshot.** The Browser pane does not composite in this environment,
   so no image was captured. Visual requirements were verified through the
   accessibility tree and `getComputedStyle`, which reads resolved token values
   rather than a colour judged by eye. An early `bodyOverflows: true` reading was
   traced to an unlaid-out tab (`clientWidth === 0`) and disproved once a real
   375 × 812 viewport was established — recorded because it is the kind of
   artifact that could be mistaken for a defect on a later pass.
3. **Two sessions on the same local day share an X-axis label.** `ExercisePoint`
   carries both `date` and `startedAt` and orders by the latter, so the points
   are distinct and correctly ordered; only the category label repeats. Not in
   scope, no requirement covers it, and the code comments already name the case.

## Residual Observation

`AppShell` now holds `const ROUTINES = '/routines'` and `const MORE = '/more'`
as literals, where it previously derived them from `SECTIONS`. This trades an
implicit positional coupling for an explicit duplicated one: renaming the More
route in `sections.ts` would no longer update `AppShell` automatically. That is
a net improvement — the duplication is greppable and the positional read was
not, and R-10 required the positional read to go — and it matches how the file
already treats `/exercises/` and `/sessions`. Noted, not a defect.

## Verdict

**Pass with accepted limitations.**

Every requirement R-1 through R-12 has both implementation evidence and
validation evidence. All four repository gates pass, mutation clears every
threshold with no survivor in new code, and changed-line and changed-branch
coverage are both 100%. Ownership is clean and the lockfile is additive. The
three gaps `execution.md` left open were closed here by direct observation
rather than accepted on report, and the one defect found (V-1) was corrected and
re-verified. The limitations above are explicit, non-behavioural, and recorded
for the change owner.
