# Exercise Catalog — Spec

Status: Ready for implementation
Size: medium
Reliability: strict
Base: `master` at `8b5074c`. Working tree carries one uncommitted edit to
`docs/PRD.md` (the V1.0 listing of this item); it overlaps this change's write
set and must be preserved, not reverted — see Stop Conditions.

## Goal

A lifter can browse every exercise the app knows, from **More → Exercises**:
the movements grouped by the body part they train, narrowed by a name search
and by equipment, and tapping one opens that exercise's history.

Done when: `/exercises` exists as a screen reachable from **More**, lists the
bundled catalog together with the exercises a lifter's routine files created,
groups them by `category`, filters by `equipment`, searches by name, and routes
a tap to the existing `/exercises/:exerciseId`. All of it works with the
network off.

This closes §11.12's screen — the last item §38 named as outside MVP 0.1, now
carried in V1.0 (§39).

## Evidence and Current Behavior

Verified by inspection at `8b5074c`:

- **The data exists and is not to be touched.**
  [`CATALOG`](../../../src/domain/catalog/index.ts) is 96 entries built from
  `CATALOG_ROWS`, statically imported, never inserted into the `exercises`
  table (DEC-007). Its rows carry **12 categories** (`back` 17, `quadriceps` 13,
  `shoulders` 12, `chest` 11, `hamstrings` 10, `biceps` 7, `core` 6,
  `full-body` 6, `triceps` 5, `glutes` 4, `forearms` 3, `calves` 2) and
  **7 equipment values** (`barbell` 34, `dumbbell` 19, `machine` 14,
  `bodyweight` 14, `cable` 11, `kettlebell` 3, `band` 1). Slugs are permanent
  (REQ-023).
- **The merge and the name filter are already written once.**
  [`ExercisePicker.tsx:41-49`](../../../src/features/session/ExercisePicker.tsx)
  builds `[...(user ?? []), ...CATALOG]` and filters with
  `normalizeExerciseName(name).includes(needle)`, capped at `SHOWN = 40`. The
  two lists are disjoint by DEC-007, so they concatenate rather than merge.
- **The destination screen already exists and already handles the common case.**
  `/exercises/:exerciseId` is routed at
  [`App.tsx:45`](../../../src/App.tsx). `getExerciseNames` resolves catalog
  first and the table second
  ([`exercises.ts:33`](../../../src/db/repositories/exercises.ts)), so a
  never-performed catalog entry still shows its name, and
  `ExerciseHistoryScreen` renders **"No history yet"** for `summary.sessions === 0`
  ([`ExerciseHistoryScreen.tsx:68`](../../../src/features/history/ExerciseHistoryScreen.tsx)).
  **No detail screen is needed.**
- **`AppShell` will mis-render `/exercises` unless told about it.**
  [`AppShell.tsx:41`](../../../src/features/shell/AppShell.tsx) matches the
  exercise family with `pathname.startsWith('/exercises/')` — with the trailing
  slash. `/exercises` matches no branch, so today it would fall through to
  `section?.label ?? 'Routine'` and render titled **"Routine"** with **no back
  control**. This is the one real defect the change must not ship.
- **Its back control must be named, not retraced.** `/exercises/:id` uses
  `navigate(-1)` because it is reached from a routine detail and from gym mode
  (`AppShell.tsx:44-58`). The catalog list has exactly one way in — More — so it
  names it, exactly as `/sessions` and `/routines` do.
- **A grouped list has a precedent.**
  [`RoutineDetailScreen.tsx:83-107`](../../../src/features/routines/RoutineDetailScreen.tsx)
  renders one `Card` per group, a header of name + `LABEL`, and `ROW_LIST`/`ROW`
  rows inside. That is the shape to copy.
- **A one-of-N picker has a precedent.**
  [`ProgressScreen.tsx:79-95`](../../../src/features/progress/ProgressScreen.tsx)
  wears `WELL` + `LABEL` + shadcn `Select`. `src/components/ui/select.tsx` and
  `input.tsx` both exist.
- **Chips are not available for the filter.** DESIGN.md §Components: *"Chips —
  status only, never actions"*, and §Cards states the One Surface Rule (cards
  never nest; a group inside a surface is separated by a hairline, never by a
  second surface).
- **Navigation is closed at four.** DESIGN.md §Navigation: *"Never more than
  four"*; [`sections.ts`](../../../src/features/shell/sections.ts) carries the
  same rule in prose. §10 already assigns this screen to More.
- **Gates.** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
  Stryker mutates `src/domain/**` only
  ([`stryker.config.json`](../../../stryker.config.json)) and covers no file this
  change adds unless the pure logic lands in `domain/` — see R-10.

## Scope

Included:

- a browsable `Exercises` screen at `/exercises`, grouped, searchable,
  filterable;
- its entry point under **More**;
- `AppShell` wiring for the new route family;
- the pure grouping/filtering function and its unit tests;
- PRD §10, §38 and §39 updated to record the screen as built.

Excluded:

- **creating, editing, renaming or deleting an exercise.** The picker refuses
  this for a stated reason — owning §26's name-matching splits history silently
  — and a browse screen does not change that. `exercise management` stays in
  §39.
- **an exercise detail view.** The tap target is the existing
  `/exercises/:exerciseId`.
- **restructuring `AppShell`'s branch chain into a lookup table.** See
  Decisions.
- **any write to the `exercises` table**, any change to `CATALOG_ROWS`, and any
  change to `ExercisePicker`.
- adding `Exercises` as a fifth tab.

## Decisions and Assumptions

- **Decision (user, approved):** the list shows the catalog **and** the
  lifter's own exercises, grouped by category, with an equipment filter.
- **Decision (user, approved):** the screen lives under **More**, never as a
  tab (§10, DESIGN.md §Navigation).
- **Decision:** the equipment filter is a `Select` wearing `WELL` + `LABEL`,
  not a chip row. Chips are status-only by DESIGN.md, and `ProgressScreen`
  already sets the precedent for choosing one of N.
- **Decision:** `AppShell` is **extended, not restructured.** The new family is
  the simplest one — fixed title, fixed icon, named back to More — so it joins
  the existing `sessions || routines` arm for `back` and `backLabel` and adds
  one arm each to `title` and `icon`. A lookup-table rewrite of shared
  navigation would force re-verification of five other route families for a
  browse screen's benefit. Recorded as deferred debt, not done here.
- **Decision:** no `SHOWN` cap. The picker's 40-row cap exists so a lifter
  mid-set can scan at arm's length; a browse screen's whole purpose is the full
  list, and 96 rows across 12 groups is an ordinary scroll.
- **Assumption:** `Exercise.category` and `Exercise.equipment` are
  `string | null` ([`types.ts:57`](../../../src/domain/types.ts)) — catalog rows
  always carry both, exercises created by routine files may carry neither.
  Stop if a non-null constraint is found on either.

## Requirements and Acceptance

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-1 | `/exercises` renders the catalog screen inside `AppShell`. | AC-1: navigating to `/exercises` shows the grouped list; the route does not shadow or break `/exercises/:exerciseId`. |
| R-2 | The list is every catalog entry plus every user-created Exercise, with no duplicates. | AC-2: with a routine file imported that created an exercise the catalog lacks, that exercise appears alongside the 96 catalog entries, once. |
| R-3 | Entries are grouped by `category`; groups are ordered and each names itself and its count. | AC-3: 12 category groups render for a clean install, each headed by its name and the number of exercises in it. |
| R-4 | Entries whose `category` is `null` fall into one trailing `uncategorized` group rather than being dropped. | AC-4: an Exercise with `category: null` is visible on the screen, in the last group. |
| R-5 | A search field narrows the list by normalized name, using `normalizeExerciseName`. | AC-5: typing `front  SQUAT ` (padded, mixed case, doubled space) matches `Front Squat`; groups left empty by the search are not rendered. |
| R-6 | An equipment filter narrows the list to one `equipment` value, with a default that narrows nothing. | AC-6: selecting `barbell` leaves the 34 barbell catalog entries plus any user exercise marked `barbell`; returning to the default restores the full list. An entry with `equipment: null` is shown under the default and hidden under any specific value. |
| R-7 | Search and equipment filter compose. | AC-7: `squat` + `barbell` shows only barbell squats; neither control resets the other. |
| R-8 | Tapping an entry navigates to `/exercises/:exerciseId`. | AC-8: tapping a never-performed catalog entry opens its history screen showing its **name** and "No history yet" — not the word "Exercise". |
| R-9 | An empty result renders an empty state, not a blank screen. | AC-9: a search matching nothing shows a `WELL` naming what was searched for. |
| R-10 | The grouping/filtering logic is a pure function in `domain/`, unit-tested, with no React and no Dexie import. | AC-10: `pnpm test` covers grouping, the null bucket, group ordering, search normalization, and filter composition. The dependency rule `features → db → domain` holds. |
| R-11 | **More** carries an `Exercises` entry in the established row shape. | AC-11: More shows a third navigation row, above `SettingsSection`, matching the `Routines` / `Session history` rows. |
| R-12 | `/exercises` renders titled **Exercises**, with a back control reading **Back to More**. | AC-12: the top bar says `Exercises`, not `Routine`, and the back control returns to `/more`. Regression: `/routines`, `/routines/:id`, `/exercises/:id`, `/sessions`, `/sessions/:id` keep the exact title, icon and back behavior they have at `8b5074c`. |
| R-13 | The bottom navigation still has exactly four items. | AC-13: `SECTIONS` is unchanged; the tab bar shows Today, Calendar, Progress, More. |
| R-14 | The screen makes no network request and writes nothing. | AC-14: with the network disabled the screen renders fully; the `exercises` table row count is unchanged after visiting it. |
| R-15 | PRD §10, §38 and §39 record the screen as built. | AC-15: §10 no longer says `Exercises` has no screen; §38 carries a row for it with evidence; the `exercise catalog screen (§11.12)` bullet leaves the V1.0 backlog in §39, since a shipped screen is not pending work. |

## Contracts and Risk Controls

Changed:

- **New route** `/exercises` (UI contract only, no API).
- **New More entry point.** Additive.
- **New exported pure function** from `domain/catalog`.

Preserved:

- `CATALOG`, `CATALOG_ROWS`, every slug (REQ-023 — permanent).
- DEC-007: the catalog is never written to the `exercises` table.
- `AppShell` behavior for all five existing route families (AC-12).
- `SECTIONS` and the four-tab rule.
- `ExercisePicker` — untouched, including its `SHOWN` cap.
- Offline: no runtime network request (AGENTS.md invariant, NFR-01).

Risk control: `AppShell` is shared by every routed screen, which is what makes
this `strict`. AC-12's regression clause is the control, and it is the one
acceptance criterion that must be exercised by hand across all six families.

## Quality Obligations

- **Tests:** unit tests in `src/domain/catalog/` for R-10 — grouping, group
  order, the `null` bucket, name normalization in search, filter composition,
  and that a specific equipment value excludes `null`.
- **QA (manual, per AGENTS.md "UI is verified by running it"):** on a 390px
  viewport — More → Exercises; search; filter; combined; tap a never-performed
  entry; back; then the five regression routes of AC-12.
- **Static/build:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`,
  all four green.
- **Mutation:** Stryker's `mutate` list is not extended by this change. If the
  pure function lands in `src/domain/catalog/index.ts` it is outside the
  configured globs; leave the config alone rather than widening a gate
  mid-change.

## Change Surface

Expected edits:

- `src/domain/catalog/index.ts` — the pure grouping/filter function (new export).
- `src/domain/catalog/index.test.ts` — its tests.
- `src/features/exercises/ExerciseCatalogScreen.tsx` — **new**.
- `src/App.tsx` — one route.
- `src/features/more/MoreScreen.tsx` — one `Link`.
- `src/features/shell/AppShell.tsx` — the new route family, minimally.
- `docs/PRD.md` — §10, §38 and §39.
- `docs/changes/2026-08-21-exercise-catalog/verification.md` — **new**, at the end.

Do not touch:

- `src/domain/catalog/data.ts`, `src/features/session/ExercisePicker.tsx`,
  `src/features/shell/sections.ts`, `src/db/**`, `stryker.config.json`,
  `src/features/history/**`.

## Planning Decision

Plan required: **No.**

Reason: one workstream, one owner, linear order (pure function + tests → screen
→ route → shell → More link → PRD). No migration, no schema, no rollout, no
parallelism, no ownership contention. A plan would restate this section.

## Stop Conditions

Stop and report rather than inventing behavior if:

- `Exercise.category` or `Exercise.equipment` turns out to be non-nullable
  (R-4, R-6 assume otherwise);
- extending `AppShell` minimally proves impossible without restructuring its
  branch chain — that is excluded scope and needs a decision, not a judgement
  call;
- the uncommitted `docs/PRD.md` edit in the working tree is absent, already
  committed, or conflicts — it is prior user work in this change's write set
  and must never be reverted;
- any of AC-12's five regression routes changes behavior;
- the work appears to require creating, renaming or deleting an Exercise;
- adding the entry point appears to require a fifth navigation tab.
