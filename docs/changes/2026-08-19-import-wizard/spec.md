# Import Wizard UI — Spec

Status: Ready for implementation
Size: medium
Reliability: strict
Base: `8df1bd6` (`change/technical-spine`, clean working tree)

## Goal

A lifter can import a routine file through the two-step wizard of §11.1: choose a
`.yaml`/`.yml` file, be told plainly when the file cannot be read, otherwise edit the
exercises and the schedule inside the wizard, and accept — at which point the Routine,
its Workouts, its Planned Exercises and its Placements are written in one transaction
and nothing was stored before that moment.

Done when a routine file can be selected, corrected and accepted entirely through the
UI, a semantically invalid field visibly blocks `Accept` until it is fixed, and the
accepted Routine is the only `active` one.

## Evidence and Current Behavior

The pipeline this UI drives already exists and is tested
(`docs/changes/2026-08-18-technical-spine/`). Nothing below is rebuilt.

- `src/domain/routine-file/schema.ts:parseRoutineFile` — pure, returns
  `{ok: true, file}` or `{ok: false, errors: StructuralError[]}`, each error carrying a
  `FieldPath`; `formatPath` renders one for a human. `RoutineFile` is a plain mutable
  `z.infer` type, so an immutable edit is a structural copy.
- `src/domain/routine-file/validate.ts:validateRoutineFile` — returns `SemanticIssue[]`,
  each with a `code`, a human `message`, and `paths: FieldPath[]` (plural: a shared
  suggested day addresses every claiming Workout). Empty array means clean.
- `src/domain/routine-file/to-domain.ts:routineFileToDomain` — file → `RoutineDraft`,
  ids generated, `order` taken from list position, `unit` falling back to the caller's
  default. Maps a semantically invalid file too, which is what lets the wizard show it.
- `src/domain/scheduling/index.ts:generatePlacements` — requires an explicit
  `anchorDate`; week 1 is the Monday of the anchor's week and pre-anchor dates are
  omitted (DEC-008 of the spine spec).
- `src/db/repositories/import.ts:importRoutine` — one `rw` transaction over five
  tables. **`routineFileToDomain` sets `status: 'active'` and `importRoutine` never
  demotes**, so a second accepted import leaves two active Routines, breaking REQ-076 of
  the spine spec. `src/db/repositories/routines.ts:activateRoutine` already holds the
  demotion logic.
- `src/App.tsx` — the single-route harness. `ImportPanel` drives the same flow without
  editing, without steps and without structural/semantic presentation; `SessionPanel`
  is the only browser driver for flow 2 and stays.
- `src/styles/theme.css` — every DESIGN.md token plus the `type-*` utilities.
  `src/features/harness/styles.ts` holds the shared class strings.
  `react-router@8.3.0` is already a dependency and is currently unused.

## Scope

Included:

- A pure, tested edit module over `RoutineFile` in `src/domain/routine-file/edit.ts`.
- The wizard UI under `src/features/import/`: file selection, structural failure,
  Step 1 (Exercises), Step 2 (Days + Weeks), Accept and its result.
- Shared UI primitives promoted out of `src/features/harness/styles.ts` so the wizard
  and the harness stop duplicating class strings.
- `react-router` app shell: `/import` (default) and `/harness`.
- Closing the two-active-Routines gap at the acceptance write.

Excluded:

- Adding an exercise inside the wizard — §11.1 excludes it from MVP.
- Routine management (§11.2), calendar (§11.3), Today (§11.4), execution (§11.5),
  bottom navigation and the other §10 areas.
- shadcn/ui and its CLI; any new runtime dependency.
- Editing a Routine after accept — routines are immutable (AGENTS.MD).
- Persisting an in-progress wizard draft.
- PWA manifest and service worker.

## Decisions and Assumptions

- **D1** — `react-router` with `/import` as the index route and `/harness` retaining
  `SessionPanel`. The harness `ImportPanel` is deleted; the wizard supersedes it. No
  bottom navigation and no §10 shell in this change. Authority: change owner, 2026-08-19.
- **D2** — No shadcn CLI. Native `<input>`, `<select>`, `<textarea>` and `<button>`.
  Nothing in the wizard needs a focus trap or a portal; the first component that does
  brings shadcn in. Authority: change owner, 2026-08-19.
- **D3** — `anchorDate` is read from the clock exactly once, inside the Accept handler.
  No date control: §12 deliberately removes `start_date`, and §11.1 step 2 lists only
  days and weeks. Authority: change owner, 2026-08-19.
- **D4** — Accepting an import makes the new Routine `active` and archives the
  previously active one, inside the same transaction as the write. Authority: change
  owner, 2026-08-19.
- Assumption: editing operates on the parsed `RoutineFile`, which is re-validated after
  every edit; domain mapping happens only at Accept. Stop if `RoutineFile` proves not to
  be safely copyable, or if an edit cannot be expressed on the file surface.
- Assumption: reordering is up/down buttons, not drag-and-drop — keyboard-operable, no
  dependency. Stop if a §11.1 requirement demands direct manipulation.
- Assumption: `notes` are edited as a `<textarea>`, one note per line, blank lines
  dropped. Stop if a note must carry structure.
- Assumption: DESIGN.md §6 prescribes `cva` for variant surfaces; this change uses
  plain variant maps combined through the existing `cn()` instead, because it needs two
  button variants and one size. Recorded as a deliberate deviation with a named upgrade
  path: adopt `class-variance-authority` when a third consumer appears. Stop if the
  change owner requires `cva` now.
- Assumption: RIR bounds are `MIN_RIR`/`MAX_RIR` (0–10) as `validate.ts` already
  exports; the UI states the range in the error, it does not redefine it.

## Requirements and Acceptance

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-1 | `/import` is the app's index route and renders the wizard at its file-selection state. `/harness` renders `SessionPanel`. `ImportPanel` no longer exists. | AC-1: loading `/` shows the wizard's file step; `/harness` still starts a Session and logs a set; a repo search for `ImportPanel` returns nothing. |
| R-2 | A `.yaml`/`.yml` file is chosen through a native file input and read as text. Nothing is written to IndexedDB at this point, or at any point before Accept. | AC-2: after selecting a file, the routines table count is unchanged. |
| R-3 | A structurally invalid file is refused: the wizard shows "Import failed", the reason for each `StructuralError` with its `formatPath` location, and a control to choose another file. No wizard step is reachable. | AC-3: a file with `version: 2`, malformed YAML, or a workout without a name shows the failure state and no Step 1. |
| R-4 | Step 1 lists every Workout in file order with each of its exercises and its full programming: sets, rep range, RIR range, rest seconds, unit, focus, notes and progression. | AC-4: the §12 example file renders its exercise with every declared value visible. |
| R-5 | Step 1 edits `sets`, `reps.min`, `reps.max`, `rir.min`, `rir.max`, `rest_seconds`, `notes` and `unit`. An edit updates the draft immediately. No control adds an exercise. | AC-5: editing `sets` to 5 and `unit` to `lb` is reflected in the accepted `PlannedExercise`. |
| R-6 | Step 1 deletes an exercise. Deleting the last exercise of a Workout is allowed and leaves the Workout with none. | AC-6: deleting an exercise removes it from the accepted Routine and the remaining `order` values stay contiguous from 0. |
| R-7 | Step 1 reorders an exercise within its Workout, up and down, by keyboard-operable controls. The first exercise cannot move up and the last cannot move down. | AC-7: moving the second exercise up makes it `order: 0` in the accepted Routine. |
| R-8 | Semantic issues are recomputed after every edit. Each issue marks every field its `paths` address, with `aria-invalid` and an error line below the field that names both the problem and the fix. | AC-8: a file with `min: 12, max: 8` marks that rep field; correcting `max` to 12 clears the mark without any other action. |
| R-9 | `Accept` is disabled while any semantic issue stands, and the wizard states how many issues remain and that they must be fixed. Correcting or deleting the offending exercise re-enables it. | AC-9: `Accept` is disabled with the inverted range present and enabled after the correction; AC-10: deleting the offending exercise also enables it. |
| R-10 | Step 2 shows each Workout's `suggested_days` as editable weekday controls, and the Routine's `weeks` as an editable number. Both edits feed placement generation. | AC-11: unchecking `friday` on a Workout removes every Friday Placement; AC-12: setting `weeks` from 4 to 2 reduces the generated Placements to those falling in the first two weeks, and no others. |
| R-11 | Two Workouts sharing a suggested day is surfaced on Step 2 against every claiming Workout and blocks `Accept` like any other semantic issue. | AC-13: a file whose two Workouts both suggest `monday` marks both and disables `Accept`; unchecking one clears it. |
| R-12 | The user moves between Step 1 and Step 2 freely, in both directions, without losing edits. `Accept` appears on Step 2 only. | AC-14: an edit made on Step 1 survives a trip to Step 2 and back. |
| R-13 | `Accept` resolves the default unit and the user's existing Exercises, maps the draft, generates Placements against today's date read once, and writes everything in one transaction. | AC-15: after Accept, the Routine, its Workouts, its Planned Exercises, any created user Exercises and its Placements are all present; AC-16: no Placement precedes today. |
| R-14 | Accepting an import leaves exactly one Routine with `status: 'active'` — the newly imported one. Any previously active Routine becomes `archived`, in the same transaction as the write. | AC-17: after two successive imports, `listRoutinesByStatus('active')` returns exactly the second Routine and the first reads `archived`. |
| R-15 | A failed Accept reports the failure in the UI, leaves the wizard's draft intact so the user can retry, and writes nothing. | AC-18: a forced write failure leaves the routines count at its prior value and the wizard still on Step 2 with its edits. |
| R-16 | After a successful Accept the wizard shows what was stored: the Routine name, its Workout count, its Placement count and the first and last Placement dates, plus a route to import another file. | AC-19: the confirmation reports counts matching the database. |
| R-17 | Choosing a different file at any point discards the current draft and restarts the wizard. | AC-20: after selecting a second file, no value from the first remains on screen. |
| R-18 | Every colour, radius, shadow and type value comes from a `theme.css` token or `type-*` utility. No literal and no arbitrary Tailwind value appears in the wizard, and no dark-mode variant is introduced. | AC-21: a repo-wide sweep for `bg-[#`, `rounded-[`, `shadow-[`, hex literals and `dark:` across `src/**/*.{ts,tsx,css}` returns nothing new. |
| R-19 | The wizard is fully operable by keyboard, every interactive control is at least 48 px tall, fields are recessed cavities with the planned focus halo, invalid fields carry `aria-invalid` and `aria-describedby` pointing at their error line, and reorder and delete controls carry labels naming the exercise they act on. | AC-22: Tab reaches every control in reading order and every action is reachable without a pointer; AC-23: no interactive control measures under 48 px at 390 px width. |
| R-20 | The wizard is authored mobile-first at 390 px and the page body never scrolls horizontally at any width. | AC-24: at 390 px and at 1280 px, `document.documentElement.scrollWidth <= clientWidth`. |
| R-21 | The app makes no runtime network request. | AC-25: `performance.getEntriesByType('resource')` after exercising the wizard shows same-origin entries only. |

## Contracts and Risk Controls

Changed:

- **`importRoutine(draft, placements)`** — gains the activation semantics of R-14. Its
  signature is unchanged; its transaction now also demotes the previously active
  Routine. Callers see one extra guarantee, never a weaker one.
- **New domain surface** `src/domain/routine-file/edit.ts`, exported from
  `src/domain/routine-file/index.ts`. Pure, no I/O, no clock.
- **UI contract** — the app's index route becomes the import wizard.

Preserved:

- Every AGENTS.MD invariant, in particular: no runtime network, routines immutable once
  accepted (editing happens in the wizard only), Placements and Sessions independent,
  weight carries its unit, ids generated.
- Dexie schema version 1 — no table, index or field changes.
- `src/domain/**` imports neither Dexie nor React; `src/db/**` imports no React. The
  ESLint layering rules stay as they are and must keep passing.
- The existing routine-file format v1 and every domain function listed under Evidence:
  none of them is modified.
- `SessionPanel`, `queries.ts` and the flow-2 harness behaviour.

## Quality Obligations

- Tests: unit tests for every `edit.ts` operation, including the boundaries — moving the
  first exercise up, moving the last down, deleting the only exercise of a Workout, and
  an edit leaving the input file untouched (immutability). A repository test against
  `fake-indexeddb` for R-14: two successive imports leave exactly one active Routine.
- QA (AGENTS.MD: UI is verified by running it): drive the dev server through, at
  minimum — a structurally broken file; a semantically broken file corrected inside the
  wizard; an edit, a delete and a reorder; a `suggested_days` and a `weeks` change; a
  successful Accept; and a second import demoting the first. Record what was observed.
- Static/build: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all clean.
- Coverage: `src/domain/routine-file/edit.ts` at 100% lines and branches — it is small,
  pure decision logic, and there is no reason for it to be lower.
- No mutation gate: `strict`, not `critical`.

## Change Surface

Expected edits:

- `src/domain/routine-file/edit.ts`, `edit.test.ts` — new.
- `src/domain/routine-file/index.ts` — export the edit surface.
- `src/features/import/**` — new: the wizard and its steps.
- `src/features/ui/**` (or equivalent shared module) — primitives promoted from
  `src/features/harness/styles.ts`.
- `src/features/harness/styles.ts`, `src/features/harness/SessionPanel.tsx` — adjusted
  to consume the promoted primitives.
- `src/features/harness/ImportPanel.tsx` — deleted.
- `src/App.tsx`, `src/main.tsx` — routing.
- `src/db/repositories/import.ts`, `import.test.ts` — R-14.

Do not touch:

- `src/db/schema.ts`, `src/db/database.ts` — schema version 1 is frozen.
- `src/domain/{types,ids,units,dates}.ts`, `catalog/**`, `scheduling/**`, `session/**`,
  `progression/**`, `routine-file/{schema,validate,to-domain}.ts`.
- `src/styles/theme.css` unless a genuinely missing token is required, in which case add
  it there rather than inlining a value.
- `docs/`, `DESIGN.md`, `PRODUCT.md`, `AGENTS.MD`, `CONTEXT.md` (append a term to
  CONTEXT.md only if one genuinely settles), `design/`, `.claude/launch.json`.
- `package.json` dependencies — no new runtime or dev dependency.

## Planning Decision

Plan required: **No**.
One writer, one obvious order (edit module → shared primitives → wizard state → Step 1 →
Step 2 → Accept → routing → the `importRoutine` fix), no migration, no parallel write
sets, no contract to freeze before work starts.

## Stop Conditions

Stop and report rather than invent behavior if:

- a §11.1 behavior cannot be expressed as an edit over `RoutineFile`;
- a semantic issue's `paths` cannot be resolved to a rendered field;
- satisfying a design obligation requires a value with no token, or a new dependency;
- R-14 cannot be made atomic without changing the Dexie schema;
- the working tree carries unrelated changes overlapping the write set above.
