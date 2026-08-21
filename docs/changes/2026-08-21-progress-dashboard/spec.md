# Progress Dashboard — Spec

Status: Ready for implementation
Size: medium
Reliability: strict
Base: `master` at `fa3e726`, clean working tree.

## Goal

A lifter can pick an exercise and see what has happened to it over time: the load
they worked at, the reps they did, and the volume they moved, session by session,
with their best set named above it.

Done when: **Progress** is the third tab of the bottom navigation, it opens on a
chart of one exercise's history, the metric can be switched between load, reps
and volume, and **Routines** is still reachable — from **More**, the way History
already is. All of it works with the network off.

This closes §11.11, the first of the two items §38 lists as outside MVP 0.1.

## Evidence and Current Behavior

Verified by inspection at `fa3e726`:

- **The navigation the design system specifies is already the one this change
  wants.** DESIGN.md:926-930: *"Four items — Today, Calendar, Progress, More …
  Never more than four."* [`docs/PRD.md:436`](../../PRD.md) draws the same four.
  The shipped `SECTIONS` is `Today, Calendar, Routines, More`
  ([`sections.ts:17-22`](../../../src/features/shell/sections.ts)). The app, not the
  documents, is the one that drifted.
- **`SECTIONS` is addressed by index, and breaking it fails silently.**
  `const ROUTINES = SECTIONS[2]; const MORE = SECTIONS[3];`
  ([`AppShell.tsx:23-24`](../../../src/features/shell/AppShell.tsx)), documented as a
  constraint in [`sections.ts:11-12`](../../../src/features/shell/sections.ts) — *"Appended,
  never prepended."* Removing `Routines` from the array shifts `More` into slot
  2. Both entries are the same shape, so TypeScript accepts it and the back
  control simply points at the wrong screen. **This is the change's one silent
  failure mode.**
- **A satellite route that names More as its way back already exists.**
  `/sessions` renders under `AppShell` with an explicit title, icon and
  `back: { to: MORE.to }`
  ([`AppShell.tsx:32-52`](../../../src/features/shell/AppShell.tsx)), reached from a link on
  More ([`MoreScreen.tsx:132`](../../../src/features/more/MoreScreen.tsx)). `/routines`
  joins it on exactly that pattern.
- **No tab is active while on a satellite route.** `BottomNav` marks a tab from
  `NavLink` on an exact `to` ([`BottomNav.tsx:25-33`](../../../src/features/shell/BottomNav.tsx)),
  and `/sessions` lights nothing today. `/routines` will behave the same.
- **The chart skin is already specified, and it names Recharts.**
  DESIGN.md:933-944 fixes the grid (`strokeDasharray="3 5"`, `{colors.rule}`,
  horizontal only, no axis or tick lines), the axis type (Label in
  `{colors.ink-3}`), the Actual series (`{colors.actual}`, 3.5 px solid, dots
  `r=4.5` white-filled with a 2.5 px stroke, latest point `r=6`), and forbids
  area gradients, series shadows and a second Y axis. It also requires
  `role="img"` with an `aria-label` stating the trend in words, inside an
  `overflow-x: auto` container (restated at DESIGN.md:468).
- **Recharts is approved but not installed.** [`docs/PRD.md:346`](../../PRD.md) (§8)
  names it; it is absent from `package.json`. The package manager is `pnpm`
  (`pnpm-lock.yaml`, `stryker.config.json`'s `packageManager`).
- **shadcn's chart component is refused, not merely absent.** DESIGN.md:714-716:
  *"`chart-1…5` and the `sidebar-*` family are deleted rather than bound: charts
  take their strokes from §Charts."* `src/styles/theme.css` has no `chart-*`
  token and `src/components/ui/` has no `chart.tsx`.
- **Every colour §Charts needs exists as a token.**
  `--color-actual`, `--color-planned`, `--color-progress`, `--color-progress-wash`,
  `--color-rule`, `--color-ink-3` ([`theme.css:64-75`](../../../src/styles/theme.css)).
- **The per-session aggregation §11.11 needs does not exist.**
  `summarizeExercise` returns scalars — `sessions`, `workingWeight`, `bestSet`,
  `heaviest`, `lightest`, `lastPerformed`
  ([`history.ts:17-33,70`](../../../src/domain/history.ts)). There is no per-session
  series and no volume anywhere in the tree.
- **Two helpers in that file are directly reusable.** `setsOf` flattens a
  `SessionHistory` to its sets and `better` picks the heavier set with reps as
  the tiebreak ([`history.ts:35,45`](../../../src/domain/history.ts)) — the same rule the
  series' top set needs.
- **`summarizeExercise` counts every Session that holds sets, of any status.**
  `performed = history.filter(entry => setsOf(entry).length > 0)`
  ([`history.ts:71`](../../../src/domain/history.ts)); only `workingWeight` narrows to
  `completed`. `ExerciseHistoryScreen` lists every status for the same reason
  (§11.8, [`ExerciseHistoryScreen.tsx:14-16`](../../../src/features/history/ExerciseHistoryScreen.tsx)).
- **`src/domain/history.ts` is under the mutation gate.**
  `stryker.config.json` mutates it by name, with `break: 80`. The last recorded
  score for the file is 91.07%
  ([`gym-mode-refinements/verification.md:55`](../2026-08-20-gym-mode-refinements/verification.md)).
  **New domain code here is born under that gate.**
- **The read side is one query short.** `listExerciseHistory(exerciseId)` returns
  the full `SessionHistory[]` for an exercise, newest first, off the
  `exerciseSessions.exerciseId` index
  ([`repositories/history.ts:70`](../../../src/db/repositories/history.ts)), exposed as
  `useExerciseHistory` ([`queries.ts:92`](../../../src/features/data/queries.ts)). Nothing
  answers *which* exercises have been performed: `listUserExercises` returns
  Exercise rows created by imports, performed or not
  ([`exercises.ts:16`](../../../src/db/repositories/exercises.ts)), and `listAllSessions`
  returns bare `Session[]` with no exercises or sets
  ([`sessions.ts:115`](../../../src/db/repositories/sessions.ts)).
- **`useExerciseNames(ids)` already resolves a list of ids to names**
  ([`queries.ts:60`](../../../src/features/data/queries.ts)).
- **The control vocabulary exists.** `Select` and `Tabs` are re-skinned
  ([`select.tsx`](../../../src/components/ui/select.tsx), [`tabs.tsx`](../../../src/components/ui/tabs.tsx)),
  with `TAB_TRIGGER` and `tab()` at [`styles.ts:150-159`](../../../src/features/ui/styles.ts).
  `WELL`, `LABEL`, `RULED`, `ICON_STROKE` are there too, and `SetPill` renders a
  set ([`SetPill.tsx`](../../../src/features/ui/SetPill.tsx)).
- **The service worker precaches all JS.**
  `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']`
  ([`pwa/config.ts:54`](../../../src/pwa/config.ts)), with no
  `maximumFileSizeToCacheInBytes` override. A new dependency lands in the
  precache manifest.
- **`/progress` resolves offline once routed.** `navigateFallback: 'index.html'`
  ([`pwa/config.ts:61`](../../../src/pwa/config.ts)) already serves deep paths cold.
- **The UI has no tests, by policy.** All 26 test files are under `src/domain`,
  `src/db` and `src/features/ui/format.ts`. AGENTS.MD: *"UI is verified by
  running it."*
- **`SessionStatus` is `'in_progress' | 'completed' | 'partial'`**, and `Session`
  carries `startedAt: Timestamp` ([`types.ts:161,170-177`](../../../src/domain/types.ts));
  `CompletedSet` carries `weight`, `unit`, `weightKg`, `reps`
  ([`types.ts:242-252`](../../../src/domain/types.ts)).
- Working tree clean at `fa3e726`. **No overlap with unrelated work.**

## Scope

Included:

- `exerciseSeries`, a pure per-session aggregation in `src/domain/history.ts`:
  top-set load, total reps and volume, all in kilograms.
- `listPerformedExercises`, one read over the existing `exerciseSessions.exerciseId`
  index, and a hook over it.
- A `/progress` screen: an exercise selector, a metric switch, one chart, and the
  best-set figure.
- Recharts as a dependency, skinned per DESIGN.md §Charts.
- `Progress` into `SECTIONS`; `Routines` out of it and onto More as a satellite
  route, with `AppShell` no longer addressing `SECTIONS` by index.
- `docs/PRD.md`: §10, §11.11, §31 Screen 4, and the §38 table.

Excluded:

- **A second chart series.** Planned and Derived are specified by DESIGN.md but
  §11.11 asks what happened; only the Actual series ships (DEC-7).
- **PR timeline, estimated 1RM, weekly volume, muscle volume, adherence** —
  §11.11 puts all five under *Posteriormente*.
- **Any change to §11.10.** `ExerciseHistoryScreen` keeps its four figures and
  its session list; Progress does not absorb it and does not duplicate its list.
- **A cross-exercise or whole-routine roll-up.** Per exercise only (DEC-6).
- **An `Exercises` area (§11.12 as a screen)** — the last item outside MVP 0.1,
  and not this change.
- **Any schema, index, `SCHEMA_VERSION`, Dexie version or `BACKUP_VERSION`
  change.** This change reads; it writes nothing.
- **shadcn's `chart.tsx` and the `chart-1…5` tokens** (DESIGN.md:714-716).
- **A fifth nav tab** (DESIGN.md:930).
- **Making a tab appear active on `/routines`** — satellite routes light no tab
  today and that behaviour is preserved deliberately.

## Decisions and Assumptions

| ID | Decision | Authority |
|---|---|---|
| DEC-1 | **`Progress` enters the bottom navigation; `Routines` leaves it and becomes a satellite route under More.** The nav becomes Today, Calendar, Progress, More. | User, this session; DESIGN.md:926-930 (*"Never more than four"*, and it names these four); `docs/PRD.md:436` |
| DEC-2 | **`AppShell` stops addressing `SECTIONS` by index.** The Routines identity it needs is stated where it is used, not read out of a positional slot. | `AppShell.tsx:23-24` against `sections.ts:11-12` — the coupling is documented precisely because it is fragile, and this change is the one that breaks it |
| DEC-3 | **Recharts, used directly and skinned by hand.** Not shadcn's `chart.tsx`, not a `chart-*` token. | `docs/PRD.md:346` (§8); DESIGN.md:933-944 specifies the skin; DESIGN.md:714-716 deletes the shadcn chart tokens rather than binding them |
| DEC-4 | **One chart with a metric switch — Load, Reps, Volume — not three stacked charts.** | DESIGN.md:943 forbids a second Y axis and the three metrics have three units (kg, reps, kg·reps), so they cannot share an axis; NFR-04's 360-430 px makes three stacked charts a scroll; `Tabs` and `TAB_TRIGGER` already exist |
| DEC-5 | **§11.11's "mejores sets" is the best-set figure, from the existing `summarizeExercise().bestSet`, not a fourth chart.** | §11.11 lists it beside three quantities that vary per session while a best set does not; §11.11 defers the *PR timeline* to *Posteriormente* |
| DEC-6 | **The dashboard is per exercise, selector-driven.** | §31 Screen 4 (*exercise selector / history / charts*); §11.11's four MVP metrics are all per-exercise quantities, and its global roll-ups are deferred |
| DEC-7 | **The chart carries the Actual series only** — green, 3.5 px solid, dots per DESIGN.md. | §11.11 asks for what happened; Planned and Derived have skins waiting in DESIGN.md for when a change needs them |
| DEC-8 | **The series counts every Session holding sets, of any status — the same rule `summarizeExercise` already uses.** An open session's sets appear as today's point. | `history.ts:71`; §11.8 and `ExerciseHistoryScreen.tsx:14-16`. A second, narrower rule would make the figure above the chart disagree with the chart below it |
| DEC-9 | **The selector lists exercises that appear in `exerciseSessions`, sorted by name, opening on the first.** | The index exists; sorting by most-recent would need session data the selector does not otherwise read |

Assumptions:

- **A-1: Recharts fits the precache budget.** No `maximumFileSizeToCacheInBytes`
  is set, so Workbox's 2 MiB default applies per file, and the chart is imported
  by one route. **Stop if** `pnpm build` reports a precache entry over the limit
  or the built bundle grows past what a phone should fetch once — the fallback
  is a hand-drawn SVG line chart, which is a DESIGN.md §Charts question and a
  §8 question, not an implementation improvisation.
- **A-2: no repository beyond `listPerformedExercises` is needed.**
  `listExerciseHistory` already returns everything `exerciseSeries` consumes.
  **Stop if** the screen needs a read that touches a table without an index for
  it.
- **A-3: `exerciseSeries` needs no new index.** It is computed in `domain/` over
  rows already fetched by `exerciseId`. **Stop if** any part of it wants a
  `.where()` the schema does not support.
- **A-4: removing `Routines` from `SECTIONS` breaks nothing but `AppShell`.**
  A grep for `SECTIONS` outside `sections.ts` returns only `AppShell.tsx` and
  `BottomNav.tsx`; `BottomNav` maps the array and `TopBar` receives values as
  props. **Stop if** a third positional reader appears.
- **A-5: no `CONTEXT.md` term settles here.** Exercise, Session and Completed Set
  already carry the vocabulary; the series is a derivation of them, not a new
  concept. **Stop if** implementation finds itself naming a new domain noun —
  AGENTS.MD requires it in `CONTEXT.md` in the same change.

## Requirements and Acceptance

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-1 | `exerciseSeries(history)` returns one point per Session that holds sets for the exercise, **oldest first**, each carrying the session's local date and `startedAt`, the top set's `weightKg`, the total reps, and the volume as `Σ(weightKg × reps)`. It assumes nothing about input order. | AC-1a: given history newest-first (what `listExerciseHistory` returns), the result is oldest-first. AC-1b: a Session with sets of 100 kg × 5 and 100 kg × 3 yields load 100, reps 8, volume 800. AC-1c: a Session holding no sets for the exercise produces no point. AC-1d: two `ExerciseSession`s for the same exercise in one Session collapse into one point summing both. AC-1e: the top set is the heaviest by `weightKg`, ties broken by reps — 100 × 3 and 100 × 6 in one session give a top set of 6 reps. AC-1f: empty history returns an empty array. |
| R-2 | Sessions of every status that hold sets are counted, including `in_progress` and `partial`. | AC-2: a history with one `completed`, one `partial` and one `in_progress` Session, each holding sets, yields three points. |
| R-3 | Every figure the series carries is in kilograms, derived from `weightKg`. | AC-3: a history mixing a 100 lb set and a 50 kg set orders and totals them by kilogram — the pound set is the lighter one. |
| R-4 | `listPerformedExercises()` returns the distinct `exerciseId`s that appear in `exerciseSessions`, off the existing index, with no schema change. | AC-4a: after two Sessions covering three distinct exercises, it returns exactly those three ids, without repeats. AC-4b: on an empty database it returns an empty array. AC-4c: `git diff` touches no `stores()` call, no `version(n)` call and no index string. |
| R-5 | `/progress` renders an exercise selector, a metric switch over Load / Reps / Volume, one chart of the selected metric, and the best set for the selected exercise. | AC-5a: selecting an exercise redraws the chart against that exercise's history. AC-5b: switching the metric redraws the same sessions against the new quantity. AC-5c: the best-set figure matches what `/exercises/:id` shows for the same exercise. AC-5d: selector and switch are operable by keyboard and carry accessible names. |
| R-6 | The chart matches DESIGN.md §Charts: horizontal dashed grid in `rule`, Label-type axis text in `ink-3`, no axis or tick lines, an Actual series in `actual` at 3.5 px solid with `r=4.5` white-filled dots at a 2.5 px stroke and `r=6` on the latest point, no area gradient, no series shadow, no second Y axis. | AC-6a: an inspection of the rendered chart shows each of those values, taken from tokens rather than literals. AC-6b: grep for arbitrary colour values (`bg-[#`, `#` in a `stroke`/`fill` attribute) in the new files returns nothing — the Token-Only Rule (DESIGN.md:812). AC-6c: no `chart-1…5` token and no `src/components/ui/chart.tsx` is introduced. |
| R-7 | The chart carries `role="img"` and an `aria-label` stating the trend in words, and lives in an `overflow-x: auto` container. The page body never scrolls horizontally at 360 px. | AC-7a: the label names the exercise, the metric and the direction, not just "chart". AC-7b: at a 360 px viewport the body has no horizontal scrollbar and the chart scrolls inside its own container. |
| R-8 | With no performed exercise at all, and with a selected exercise that has no points, the screen renders the Empty state of DESIGN.md:949-950 — icon, a title in product language, one sentence, a secondary action — never a blank chart frame or a zero-length axis. | AC-8a: a fresh install shows the empty state and offers a way to start training. AC-8b: an exercise with an `exerciseSession` but no logged sets shows the empty state rather than an axis with nothing on it. AC-8c: a read still in flight is visibly distinct from an empty result, as `ExerciseHistoryScreen.tsx:41-49` distinguishes them. |
| R-9 | The bottom navigation shows Today, Calendar, Progress, More. `Routines` is reachable from More, its screen keeps its title and icon, its back control returns to More, and `/routines/:routineId` still returns to `/routines` labelled "Back to Routines". | AC-9a: every one of the four tabs routes to its screen and marks itself active. AC-9b: More carries a Routines row that opens `/routines`. AC-9c: from `/routines` the back control reads "Back to More" and goes there. AC-9d: from a routine's detail the back control reads "Back to Routines" and goes to `/routines`. AC-9e: `/exercises/:id` and `/sessions/:id` still retrace with `navigate(-1)` — reaching an exercise from a routine detail and going back lands on the routine detail. AC-9f: on `/routines` and `/sessions` no tab is marked active. |
| R-10 | No module addresses `SECTIONS` by numeric index. | AC-10: grep for `SECTIONS[` under `src/` returns nothing. |
| R-11 | No runtime network request is introduced and the whole screen works offline, including a cold load of `/progress`. | AC-11a: with the service worker active and the network cut, `/progress` loads cold, the selector fills and the chart draws. AC-11b: the network panel records no request. |
| R-12 | `docs/PRD.md` states the truth after this change. | AC-12a: §10 describes the four shipped tabs and says where Routines lives; it no longer implies a nav this app does not have. AC-12b: §11.11's `MVP:` list and §38 agree — the four metrics ship, the five under *Posteriormente* do not. AC-12c: §31 Screen 4 matches what ships (DEC-5: best set, not a PR timeline). AC-12d: the §38 table gains a Progress row with its evidence, and the closing line leaves only Exercise Catalog as a screen. |

## Contracts and Risk Controls

**Changed contracts.** `src/domain/history.ts` gains `ExercisePoint` and
`exerciseSeries` — additive; `summarizeExercise` and `ExerciseSummary` are
untouched. `src/db/repositories/exercises.ts` gains `listPerformedExercises`,
re-exported from `src/db/index.ts`; `queries.ts` gains a hook over it. `SECTIONS`
changes membership, and its positional contract is dissolved rather than
maintained. `package.json` gains `recharts`.

**Preserved contracts.** `SCHEMA_V1`, `SCHEMA_VERSION`, `BACKUP_VERSION`,
`RESTORED_TABLES`, every type in `src/domain/types.ts`, `summarizeExercise`'s
return shape, `/exercises/:id`, `/sessions`, `/sessions/:id` and `/routines/:id`
as routes, and the whole of gym mode. `dexie` stays imported only inside
`src/db`; `domain/` gains no import from either layer above it.

**Risk controls:**

1. **The positional `SECTIONS` read is the one silent failure.** Nothing in the
   type system distinguishes `SECTIONS[2]` from `SECTIONS[3]`, so a reordered
   array yields a back button that quietly goes to More from a routine detail.
   R-10 forbids the pattern outright rather than asking the implementer to keep
   it correct, and AC-9c/AC-9d test both directions.
2. **Order of work.** Dissolve the index coupling (DEC-2) *before* changing the
   array's membership. Doing it the other way leaves a window in which the app
   compiles, runs, and navigates wrongly — the exact state a manual QA pass is
   most likely to skim past.
3. **A new dependency enters the precache.** The app's whole claim is that it
   works with the network off, which means everything is fetched once, up front
   (A-1, `pwa/config.ts:54`).
4. **Mutation gate on `domain/history.ts`.** The file is in the Stryker mutate
   list with a break threshold of 80. Arithmetic in `exerciseSeries` — a sum, a
   product, a comparison — is exactly what mutation testing exists to catch, and
   coverage alone will not.
5. **Two screens must not drift.** The best-set figure on Progress and the one on
   `/exercises/:id` come from the same `summarizeExercise` call so they cannot
   disagree (AC-5c); DEC-8 keeps the chart's session rule identical to it.

## Quality Obligations

- **Tests** (`src/domain/history.test.ts`): AC-1a–f, AC-2, AC-3. These carry the
  product's arithmetic and they are the ones under the mutation gate.
- **Tests** (`src/db/repositories/exercises.test.ts`, against `fake-indexeddb`):
  AC-4a, AC-4b.
- **Mutation:** `pnpm exec stryker run --mutate src/domain/history.ts` must stay
  at or above the repo's `break: 80`, and should not fall below the 91.07%
  recorded for the file at `2026-08-20-gym-mode-refinements`. Survivors are
  classified in `verification.md`, not waved through.
- **QA (manual, in the browser)** — AGENTS.MD verifies UI by running it. Walk all
  four tabs; open Routines from More and come back; open a routine detail and go
  back; open an exercise from a routine detail and go back (AC-9e). On Progress:
  switch exercise, switch metric, confirm the best set matches `/exercises/:id`.
  Check both empty states (AC-8a, AC-8b). Check at a 360 px viewport (AC-7b).
  Repeat the walk with the network off after a cold load (AC-11a).
- **Static/build:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` —
  all four must pass. `pnpm build` output is also the evidence for A-1.

## Change Surface

Expected edits:

| Path | Change |
|---|---|
| `src/domain/history.ts` | `ExercisePoint`, `exerciseSeries`; reuse `setsOf` and `better` (R-1, R-2, R-3) |
| `src/domain/history.test.ts` | AC-1a–f, AC-2, AC-3 |
| `src/db/repositories/exercises.ts` | `listPerformedExercises` (R-4) |
| `src/db/repositories/exercises.test.ts` | AC-4a, AC-4b |
| `src/db/index.ts` | Re-export it |
| `src/features/data/queries.ts` | A hook over `listPerformedExercises` |
| `src/features/progress/ProgressScreen.tsx` (new) | Selector, metric switch, figure, empty states (R-5, R-8) |
| `src/features/progress/ExerciseChart.tsx` (new) | The Recharts line, skinned per §Charts (R-6, R-7) |
| `src/App.tsx` | The `/progress` route |
| `src/features/shell/sections.ts` | Progress in, Routines out; rewrite the header comment, which documents the index contract this change dissolves |
| `src/features/shell/AppShell.tsx` | De-index (DEC-2); `/routines` as a satellite; amend the header comment's route-family count |
| `src/features/more/MoreScreen.tsx` | The Routines row, on the `/sessions` pattern at line 132 |
| `package.json`, `pnpm-lock.yaml` | `recharts` |
| `docs/PRD.md` | §10, §11.11, §31 Screen 4, §38 (R-12) |

Do not touch:

- `src/db/schema.ts`, `src/db/migrations.ts` — R-4 adds a read, not a table.
- `src/domain/backup/`, `src/db/repositories/backup.ts` — nothing new is stored,
  so nothing new is exported.
- `src/domain/progression/`, `src/domain/session/`, `src/domain/units.ts` — no
  derivation changes.
- `src/features/history/ExerciseHistoryScreen.tsx` — §11.10 is unchanged, and
  Progress must not grow a copy of its session list.
- `src/features/session/` — gym mode is out of scope.
- `src/styles/theme.css` — every token §Charts names already exists.
- `stryker.config.json` — `src/domain/history.ts` is already in the mutate list.
- `src/pwa/config.ts` — `globPatterns` and `navigateFallback` already cover a new
  chunk and a cold `/progress`.
- `src/features/shell/BottomNav.tsx`, `TopBar.tsx` — they read `SECTIONS` and
  props; neither needs an edit for a membership change (A-4).

## Planning Decision

**Plan required: No.**

Reason: one linear sequence with a single owner — domain function, repository
read, hook, screen, chart, navigation, docs — with no contract to freeze before
parallel work, no migration, and no rollout. The one ordering constraint that
matters is stated as a risk control above (dissolve the index coupling before
changing the array's membership), which is a rule, not a dependency graph.

## Stop Conditions

Implementation must stop rather than invent behavior if:

- a fifth nav tab, or a tab beyond Today / Calendar / Progress / More, seems
  necessary (DEC-1, DESIGN.md:930);
- the chart cannot be drawn within DESIGN.md §Charts — in particular if a metric
  appears to need a second Y axis (DEC-4) or a series beyond Actual (DEC-7);
- Recharts pushes a precache entry over Workbox's limit, or the built bundle
  grows past what one offline fetch should carry (A-1);
- the chart appears to need `src/components/ui/chart.tsx` or a `chart-*` token
  (DEC-3, DESIGN.md:714-716);
- any requirement would need a schema change, an index, a Dexie version, or a
  `BACKUP_VERSION` bump — this change reads and writes nothing;
- the series needs a session rule different from `summarizeExercise`'s (DEC-8),
  which would make the figure above the chart disagree with the chart;
- Progress appears to need its own copy of §11.10's session list, or §11.10
  appears to need editing;
- a new domain noun is named, which `CONTEXT.md` must then carry in this same
  change (A-5);
- a third positional reader of `SECTIONS` is found (A-4);
- unrelated working-tree changes overlap the write set above.
