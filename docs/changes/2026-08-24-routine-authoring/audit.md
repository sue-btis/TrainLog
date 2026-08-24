# Routine Authoring Audit

Status: Ready for specification — the decisions below were taken 2026-08-24
Size: large
Reliability: strict

## Baseline

| Field | Value |
|---|---|
| Repository root | `C:\Users\Josue Escobar\Documents\projects\mine\TrainLog` |
| Branch | `master` |
| Commit SHA | `49efc786e2955b36dbd277e4d3ffcababb21d66d` |
| Working tree | Dirty — two untracked paths, both unrelated to source |
| Relevant pre-existing changes | None in `src/`. `docs/PRD-DMS.md` (761 lines, untracked) is a Document Management System PRD for a different product — see **Do Not Touch**. `docs/changes/2026-08-24-routine-authoring/` is this change's own folder. |
| Audit date | 2026-08-24 |

Baseline health, executed during this audit, not inferred:

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass (both tsc projects) |
| `pnpm test` | Pass — 29 files, 456 tests |
| `pnpm lint` | Pass — no output |

Every `path:line` in this document was re-anchored against `49efc78`. The
parallel traces read `d5759ee` (pre-merge); load-bearing citations were
re-verified by direct read before entering this file.

## Desired Outcome and Constraints

- **Outcome:** a lifter can create a user Exercise, author a Routine without a
  YAML file, and add a Workout to a Routine already accepted.
- **Included (approved at shaping):**
  - DEC-A — create user Exercises, and add exercises into a Workout.
  - DEC-B — additive edits in place on an accepted Routine. Nothing stored is
    rewritten or deleted; the invariant is amended to "no destructive edits",
    not revoked.
  - DEC-C — from-scratch authoring reuses the import wizard, seeded with a
    blank `RoutineFile`.
- **Excluded:** editing or deleting existing Workouts / PlannedExercises;
  renaming or deleting user Exercises; Routine versioning.
- **Structural constraints:** offline at runtime; `features → db → domain`,
  mechanically enforced by ESLint (`eslint.config.js:12-53`, severity `error`);
  catalog Exercises never enter the `exercises` table (DEC-007).

## Current Behavior Trace

There is exactly one authoring path today, and it runs end to end from a file.

1. `src/features/import/FileStep.tsx` — the only entry. A file is read and
   handed to `parseRoutineFile` (`src/domain/routine-file/schema.ts`).
2. `src/features/import/ImportWizard.tsx:85` — `validateRoutineFile(file)`.
   This is the **only non-test call site in the repository**; every other match
   is a doc comment, a re-export, or a test.
3. `src/features/import/ExercisesStep.tsx` — step 1. Edits route through the
   five functions in `src/domain/routine-file/edit.ts`: `editExercise:35`,
   `deleteExercise:54`, `moveExercise:67`, `toggleSuggestedDay:94`,
   `setWeeks:108`. There is no add operation of any kind.
4. `src/features/import/ImportWizard.tsx:138` — `accept()` re-checks
   `issues.length > 0`, then `routineFileToDomain` → `generatePlacements`
   (`anchorDate: formatLocalDate(new Date())`, line 156) → `importRoutine`.
5. `src/db/repositories/import.ts:38-58` — one transaction over five tables,
   opening with `db.routines.add`, which is why it cannot be reused for a
   Routine that already exists.

**Observable result today:** a Routine can only come from a file, an exercise
can only be added to a Session (never to a plan), and a user Exercise can only
be minted as a side effect of an import.

## Relevant Surface

| Path / Area | Role | Evidence | Confidence |
|---|---|---|---|
| `src/domain/routine-file/edit.ts` | The missing add seam. Five pure edit ops, no add. | `edit.ts:35,54,67,94,108` | High |
| `src/domain/routine-file/schema.ts` | Zod contract for the editable draft. | `schema.ts:54-83` | High |
| `src/domain/routine-file/validate.ts` | All six semantic rules, typed on `RoutineFile`. | `validate.ts:13-19,39` | High |
| `src/domain/routine-file/to-domain.ts` | §26 resolution + the only Exercise mint site. | `to-domain.ts:61-83` | High |
| `src/domain/routine-file/index.ts` | Barrel; asserts the invariant and enumerates the five verbs. | `index.ts:13-16,36-44` | High |
| `src/domain/catalog/index.ts` | `normalizeExerciseName`, the §26 matcher. | `catalog/index.ts:35-37` | High |
| `src/domain/scheduling/index.ts` | `generatePlacements`, `isMissed`, `nextWorkoutInRotation`. | `scheduling/index.ts:53,64,107` | High |
| `src/db/repositories/workouts.ts` | Read-only today; DEC-B needs a writer. | `workouts.ts:1` | High |
| `src/db/repositories/plannedExercises.ts` | Read-only today; DEC-A needs a writer. | `plannedExercises.ts:1` | High |
| `src/db/repositories/exercises.ts` | Three readers, no create. | `src/db/index.ts:47-52` | High |
| `src/db/repositories/placements.ts` | `list`/`list`/`move`/`delete`. **No create.** | `placements.ts:23,32,37,48` | High |
| `src/db/repositories/import.ts` | The only production writer of Routine/Workout/PlannedExercise/Exercise/Placement. | `import.ts:38-58` | High |
| `src/db/repositories/backup.ts` | A **second** writer of `exercises` and `placements`, via a generic loop. | `backup.ts:145-155` | High |
| `src/features/import/*` | The wizard; DEC-C's host and DEC-A's step-1 host. | `ImportWizard.tsx`, `ExercisesStep.tsx`, `ActionBar.tsx`, `fields.tsx`, `state.ts` | High |
| `src/features/routines/RoutineDetailScreen.tsx` | Natural home for DEC-B's affordance. | `RoutineDetailScreen.tsx:2,6` | High |
| `src/features/exercises/ExerciseCatalogScreen.tsx` | Natural home for DEC-A's create. | header comment, lines 17-21 | High |
| `src/features/today/TodayScreen.tsx` | `suggestWorkout`; two stale copy blocks. | `TodayScreen.tsx:161-163,226,375-378` | High |
| `src/features/session/ExercisePicker.tsx` | Candidate picker. **Not reusable as-is** — see R-5. | `ExercisePicker.tsx:30-34` | High |
| Docs | 6 doc sites + 12 src sites assert the invariant. | See R-8 | High |

## Actual Problem / Change Location

The three requested features are one structural gap wearing three faces.

**The gap:** the repository has exactly one authoring pipeline, and its editable
unit is the in-memory `RoutineFile`. Every capability the change needs —
validation, §26 exercise resolution, ordering, atomic write — is reachable only
through that type. `edit.ts` offers no add operation, so the pipeline can narrow
a routine but never widen one.

DEC-C fits this pipeline (seed a blank `RoutineFile`, reuse everything).
DEC-A fits it too, on the wizard side.

**DEC-B does not.** An `addWorkout` against a stored Routine operates on domain
rows, not on a `RoutineFile`, and there is no reverse mapping — it was grepped
for and does not exist. That single fact determines the shape of the change:

- `validateRoutineFile` is `(file: RoutineFile) => readonly SemanticIssue[]`
  (`validate.ts:39`). It cannot be called on stored rows.
- `resolveFileExercise` takes a `RoutineFileExercise` (`to-domain.ts:59`). The
  §26 guard cannot be called on stored rows either.
- `importRoutine`'s transaction begins `db.routines.add` (`import.ts:52`), so it
  throws on an existing Routine.

DEC-B therefore requires a genuinely new persistence seam, and the spec must say
what validates it. That is DEC-Q1, and it is the most consequential decision
open.

## Contracts and Boundaries

| Contract / Boundary | Current Shape | Consumers | Change Risk |
|---|---|---|---|
| `RoutineFileExercise` (Zod) | Requires `name`, `sets`, `reps`, `progression`. No `.min()`, `.int()`, `.positive()` anywhere in the file. | wizard, to-domain | Medium |
| `exercise_id` resolution | Resolved **against the bundled catalog only** (`to-domain.ts:61-65`); a miss falls through to name matching. | to-domain | **High** |
| §26 name guard | `resolveFileExercise:66-73` — catalog by name, then `knownExercises`, then mint. Covers 100% of user-Exercise creation today. | to-domain | **High** |
| `SemanticIssueCode` | Closed union of 6, exhaustively switched in `issues.ts:82-90`. | wizard | Medium |
| `WizardState` | `editing` phase requires `fileName: string` (non-null) and `defaultUnit`. | wizard | Medium |
| `edit.ts` five verbs | Enumerated in prose at `index.ts:13-16` and in the barrel at `index.ts:36-44`. | wizard | Medium |
| `Placement` | `{id, routineId, workoutId, date}` — **no `createdAt`**. | scheduling, calendar, today | **High** |
| `Routine` | `{id, name, weeks, status, createdAt}` — no provenance field. | routines list, today | Medium |
| `SCHEMA_V1` / `SCHEMA_VERSION = 2` | Nine tables. `exercises: 'id'` — primary key only, no name index. | db | Low |
| `BACKUP_VERSION = 1` | `RESTORED_TABLES` includes `exercises` and `placements`. | backup | Low |
| ESLint layering | `domain/**` may not import react/dexie/`@/db`/`@/features`. Severity `error`. | build | Low |

## Tests and Validation

| Test / Command | Covers | Gap | Prerequisite |
|---|---|---|---|
| `pnpm test` (vitest run) | 456 tests, 29 files. Passing at baseline. | — | none |
| `pnpm typecheck` | Both tsc projects; `include: ["src"]` so tests are typechecked too. | — | none |
| `pnpm lint` | ESLint, layering rules at `error`. | No `--max-warnings`, so warnings pass. | none |
| `routine-file/validate.test.ts` | 5 of 6 semantic codes. | **No case for an empty routine or an empty Workout.** No case for one Workout listing a day twice. | none |
| `routine-file/edit.test.ts` | The five existing edit verbs. | No add coverage (nothing to cover yet). | none |
| `catalog/index.test.ts:27-30,40-43` | Catalog id + name uniqueness **at build time**. | Asserts nothing about the user table. | none |
| `exercises.test.ts` | Repository reads. | No create path exists to test. | fake-indexeddb |
| `import.test.ts` | `importRoutine` transaction. | No add-to-existing-routine path. | fake-indexeddb |
| `scheduling/index.test.ts:78-91` | AC-042 — `generatePlacements` never emits a past date. | No coverage of adding a Workout mid-routine. | none |
| **React component tests** | **None possible.** `environment: 'node'`, no jsdom/happy-dom, no `@testing-library`. | Every DEC-A/B/C screen is unverifiable by automated test. | AGENTS.MD: "UI is verified by running it." |
| Stryker | Configured (`break: 80`), but **no npm script runs it**, and its `mutate` list excludes `src/domain/routine-file/**` and `src/domain/catalog/**` — precisely this change's domain. | Not a gate. | on demand |
| CI | No `.github/workflows` gate found. | Nothing enforces the above automatically. | — |

## Candidate Ownership

The shared contract must be frozen before any workstream starts. It is small:
the add operations on `edit.ts`, and the answer to DEC-Q1.

| Workstream | May Read | Candidate Write Set | Coupling / Conflict Risk |
|---|---|---|---|
| **Gate 0 — shared contract** | all | `src/domain/routine-file/edit.ts`, `index.ts`, `validate.ts` | Blocks all three. Must land alone. |
| **WS-1 — user Exercises (DEC-A create)** | catalog, exercises repo | `src/db/repositories/exercises.ts`, `src/features/exercises/ExerciseCatalogScreen.tsx`, `src/features/data/queries.ts` | Medium — must route through the §26 matcher or the guard's coverage drops below 100%. |
| **WS-2 — from scratch (DEC-C)** | routine-file, import repo | `src/features/import/{state.ts,ImportWizard.tsx,FileStep.tsx,ExercisesStep.tsx,ActionBar.tsx}` | High conflict with WS-3 on `ExercisesStep.tsx` — both add affordances to step 1. |
| **WS-3 — add exercise to Workout (DEC-A add)** | routine-file, catalog | `src/features/import/ExercisesStep.tsx`, a new picker component | High conflict with WS-2. **Sequence, do not parallelize.** |
| **WS-4 — add Workout to stored Routine (DEC-B)** | all repos | `src/db/repositories/workouts.ts`, `plannedExercises.ts`, `placements.ts`, `src/features/routines/RoutineDetailScreen.tsx` | Medium. Disjoint from WS-2/WS-3 in files, coupled through DEC-Q1. |
| **WS-5 — docs + copy** | all | `AGENTS.MD`, `CONTEXT.md`, `docs/PRD.md`, 12 src header comments, 5 copy blocks | Touches every other workstream's files. **Must land last.** |

WS-2 and WS-3 both rewrite `ExercisesStep.tsx`. Their write sets are not
provably disjoint, so parallel implementation is not safe here. Default to
sequential.

## Integration and Generated-File Hotspots

| File / Area | Why Shared | Required Control |
|---|---|---|
| `src/features/import/ExercisesStep.tsx` | WS-2 and WS-3 both add affordances; its header comment is also a WS-5 target. | Single owner, sequential. |
| `src/domain/routine-file/index.ts` | Barrel exports + a prose assertion of the invariant + the five-verb enumeration. Three workstreams touch it. | Gate 0 owns it. |
| `src/features/data/queries.ts` | Every new screen adds a hook. | Append-only convention. |
| `docs/PRD.md` §38/§39 tables | Repo rule: update in the same commit as the change record. | WS-5. |
| `src/db/schema.ts` | Must **not** change. See ASM-1. | Frozen. |
| `package.json`, `pnpm-lock.yaml` | No new dependency is needed. | Frozen. |

## Supported Options

| Option | Evidence | Pros | Cons | Approval Status |
|---|---|---|---|---|
| **Q1-a** Port the six rules to a stored-rows validator | `validate.ts:39` types on `RoutineFile` | One rule set; closes the `suggested_day_shared` hole | A second validator over different types is exactly the duplication that drifts | Not approved |
| **Q1-b** Validate only what the add form can violate, in the form | `issues.ts:82-90` | Smallest diff; covers the fields a form actually collects | Leaves `suggested_day_shared` unenforced — the rule with a real user-visible failure | Not approved |
| **Q1-c** Leave the DEC-B path unvalidated, record the gap | — | Zero code; honest about scope | `sets: 0` and inverted rep ranges become storable and exportable | Not approved |
| **Q2-a** `addWorkout` generates no Placements | `placements.ts` has no create | Smallest transaction; no anchor question | The Workout is invisible on the calendar forever — it can only be moved or deleted, never created | Not approved |
| **Q2-b** Generate from today forward for remaining weeks | `scheduling/index.ts:64` guarantees no past date | Workout appears on the calendar and stops counting as unplanned | Needs a "remaining weeks" number that exists nowhere; anchor must be recovered from `routine.createdAt` (ASM-2) | Not approved |
| **Q2-c** Lifter places it manually | `movePlacement` exists, create does not | No fabricated dates | Adds a calendar verb §11.3 does not grant, plus new UI | Not approved |
| **Q3-a** Keep `imported {date}` unchanged | `RoutinesScreen.tsx:140` | Zero diff | The app states a falsehood in its own list | Not approved |
| **Q3-b** Change to `created {date}` for all Routines | `RoutinesScreen.tsx:140` | One-word edit, true for both origins, no schema change | Marginally less precise than a provenance field | Not approved |
| **Q3-c** Add a provenance field to `Routine` | `types.ts:71-77` | Exact | A new stored field means a backup-schema edit and the same migration class that forced `SCHEMA_VERSION 2` — breaks ASM-1 | Not approved |
| **Q4-a** Extend `ExercisePicker` with `onCreate` | R-5 | One search implementation, one §26 matcher | Changes the component gym mode depends on; its data source cannot see draft-created exercises | Not approved |
| **Q4-b** Build a wizard-local picker | R-5 | No risk to the live-session picker | Two searches to keep in agreement — the §26 drift its own header warns about | Not approved |
| **Q5-a** New `SemanticIssueCode` for an empty routine | `ActionBar.tsx:62` mechanism already wired | Reuses `blocked = issues.length > 0`; makes the UI a compile error until updated | Every existing issue points at a focusable field; a whole-routine issue has none | Not approved |
| **Q5-b** Arity gate at both Accept sites | `ActionBar.tsx:62`, `ImportWizard.tsx:138` | No new issue code, no jump-target problem | Two sites to keep in sync; the lifter gets a disabled button with no stated reason | Not approved |

## Decisions Taken

Approved by the owner on 2026-08-24, after this audit was presented. These are
now frozen inputs to the spec.

| ID | Resolution | Consequence for the spec |
|---|---|---|
| **DEC-Q1** | **Q1-b — enforce in the add form.** | The DEC-B add form validates what it can collect: sets, rep range, RIR bounds, rest. `suggested_day_shared` is **knowingly left unenforced** on the stored-rows path. The spec must state that exclusion explicitly and must decide how an added Workout that collides on a suggested day is surfaced — because `suggestWorkout` will silently prefer the lower-`order` Workout (`TodayScreen.tsx:375-378`). |
| **DEC-Q2** | **Q2-b — generate from today forward.** | `addWorkout` generates Placements from today for the Routine's remaining weeks, anchored via ASM-2. Requires a new Placement writer; `placements.ts` has no create. No past-dated Placement can result (`scheduling/index.ts:64`). |
| **DEC-Q3** | **Q3-b — `created {date}` for all Routines** (defaulted). | One-word edit at `RoutinesScreen.tsx:140`. No schema change, no provenance field, ASM-1 preserved. |
| **DEC-Q4** | **Q4-b — build a wizard-local picker** (defaulted). | DEC-A's picker is **new code, not reuse**. `ExercisePicker` is left untouched, so gym mode carries no risk. The two searches must be kept in agreement on §26 — see R-3 and R-4. |
| **DEC-Q5** | **Fix now, as a separate quick change.** | The empty-routine defect leaves this change entirely. See `docs/changes/2026-08-24-empty-routine-accept/`. This change then inherits a wizard that already refuses a blank draft, which removes the blocker from DEC-C. |

## Material Decisions Needed

All resolved above. Retained for provenance.

| ID | Decision | Why It Matters | Supported Options | Blocking? |
|---|---|---|---|---|
| DEC-Q1 | What validates the DEC-B stored-rows path? | `validateRoutineFile` is typed on `RoutineFile` with one call site and there is no reverse mapping. Today a colliding `suggested_day` would make an added Workout **silently unreachable from Today** — `suggestWorkout` uses `.find` (lowest `order` wins, `TodayScreen.tsx:375-378`) and the tab strip renders only when `workouts.length > 1` (`:173`). | Q1-a / Q1-b / Q1-c | **Yes** |
| DEC-Q2 | Does `addWorkout` generate Placements, and anchored where? | Without them the Workout never appears on the calendar; the calendar grants only move and delete. | Q2-a / Q2-b / Q2-c | **Yes** |
| DEC-Q3 | What does a from-scratch Routine's provenance line say? | `RoutinesScreen.tsx:140` hard-codes `imported {shortDate(createdAt)}`. A from-scratch Routine would render "imported today" — a falsehood in the app's own list, with no field able to say otherwise. | Q3-a / Q3-b / Q3-c | No — Q3-b is a safe default |
| DEC-Q4 | Is DEC-A's wizard picker reuse or new code? | Both verifiers refuted "reusable as-is" (R-5). Pricing it as reuse under-scopes the change. | Q4-a / Q4-b / Q4-c | No — Q4-b is a safe default |
| DEC-Q5 | Blank DEC-C draft — block Accept while empty, or allow it? | **This is a live defect today, not only a DEC-C question.** See R-2. | Q5-a / Q5-b / Q5-c | **Yes** |

## Assumptions

| ID | Assumption | Validation | Stop If False |
|---|---|---|---|
| ASM-1 | No new table, no new index, no `SCHEMA_VERSION` bump, no `BACKUP_VERSION` bump. | Confirmed by two independent verifiers across five attack fronts. Every entity written already has a store; the wizard persists nothing mid-draft (zero `localStorage`/`sessionStorage` hits in `src/`). | Stop — a migration turns this into a different, higher-risk change. |
| ASM-2 | The Placement anchor for DEC-B is recoverable from stored data as `formatLocalDate(new Date(routine.createdAt))`. | `Routine.createdAt` is a stored `Timestamp` (`types.ts:76`), written at `ImportWizard.tsx:149` from the same clock read that seeds `anchorDate` at `:156`. Caveat: the two reads straddle midnight in principle. | If false, Q2-b needs a new stored field — which breaks ASM-1. |
| ASM-3 | A Workout with zero PlannedExercises is already fully supported end to end. | `createStartedWorkout` guards `if (started.exerciseSessions.length > 0)` (`sessions.ts:71-73`) and its doc says a Workout with no exercises "goes through here too"; `SessionScreen.tsx:353-358` renders a dedicated well. | If false, DEC-B cannot ship `addWorkout` before `addPlannedExercise`. |
| ASM-4 | No new runtime dependency. | Picker, forms, and inputs all exist in `src/components/ui/`. | Stop — a new dependency needs its own approval. |

## Contradictions and Risks

**R-1 — The PRD/ADR contradiction is settled, in ADR 0002's favour, on code.**
No history or progression read path reconstructs a past Session's planned
targets by joining into `plannedExercises`/`workouts`/`routines`. Two
independent verifiers confirmed it across four orthogonal search axes (raw Dexie
access, repository call sites, feature-hook call sites, `plannedExerciseId`
uses). `src/db/repositories/history.ts` imports no template module at all.
`suggestLoad` is called only from `ExerciseView.tsx:69` and
`PreviousPanel.tsx:42`, both passing an `ExerciseSession`.
**DEC-B is safe on history integrity.** `docs/PRD.md:2452` (§39 item 14) is
wrong where it claims immutability holds the snapshot up, and should be
corrected as part of WS-5.

**R-2 — A live latent defect, adjacent to DEC-C.** A `RoutineFile` with zero
Workouts parses clean, produces zero semantic issues, and is Accept-able today.
`importRoutine` then writes an empty Routine **and archives the lifter's real
active one** (`import.ts:47-51`). Verified by two verifiers, one of which
executed the actual repo modules through `jiti`. There are two Accept gates with
the same predicate — `ActionBar.tsx:62` and `ImportWizard.tsx:138` — so a fix
must cover both. DEC-C makes this reachable in one tap from an empty wizard.

**R-3 — `exercise_id` does not preserve user-Exercise identity.**
`resolveFileExercise` resolves `exercise_id` **only against the bundled
catalog** (`to-domain.ts:61-65`); a miss falls through to normalized-name
matching. A user-created Exercise's id — exactly what DEC-A mints and what a
picker would return — is silently ignored and re-matched by name. Any DEC-A
picker that routes identity through `exercise_id` will lose it. This is the
single most dangerous technical detail in the change.

**R-4 — The §26 guard already exists; DEC-A's job is to preserve it, not create
it.** Both verifiers refuted the trace's headline claim that no guard exists.
`resolveFileExercise:66-73` matches the normalized name against the catalog and
then against `knownExercises` before the only `newId<ExerciseId>()` call site in
`src/` (`to-domain.ts:78`). Because `importRoutine` is the only production
writer, that is a working duplicate-name guard on **100%** of user-Exercise
creation today. A DEC-A create form that does not route through the same matcher
drops coverage from 100% to partial. Three holes it inherits: the check is
TOCTOU (read at `ImportWizard.tsx:142-145`, outside the transaction);
`normalizeExerciseName` does no Unicode NFC/NFD folding
(`catalog/index.ts:35-37`); and it is reuse, never a rejection — a collision is
never surfaced to the lifter.

**R-5 — `ExercisePicker` is not reusable as-is.** Both verifiers refuted it. It
is genuinely decoupled from `SessionScreen` (three props, no `@/features/session`
or `@/db` imports), but: `onPick` returns an `ExerciseId` while the wizard needs
a `RoutineFileExercise` requiring name+sets+reps+progression; `useUserExercises`
reads the **persisted** table, so exercises the draft itself named are invisible
to it — the exact DEC-C case of adding a movement to Workout A then wanting it
in Workout B; it has no create prop and its header explicitly refuses creation;
and its full-body-swap frame conflicts with the wizard's fixed `ActionBar`.

**R-6 — `restoreBackup` is a second writer, and it has no guards.**
`backup.ts:145-155` clears and `bulkAdd`s every table in `RESTORED_TABLES`,
which includes both `exercises` and `placements`. `parseBackup` de-duplicates on
**id only** (`backup/schema.ts:388-410`), so two Exercises with identical names,
or one shadowing a catalog name, restore cleanly. Any statement of the form
"only `importRoutine` writes X" is wrong for both tables.

**R-7 — Back-dated Placements reading as missed is pre-existing, not a DEC-B
hazard.** `generatePlacements` cannot emit a date before its anchor
(`scheduling/index.ts:64`, pinned by AC-042 at `index.test.ts:78-91`), so
anchoring at today is safe. But `Placement` carries no `createdAt`
(`types.ts:148-153`) and `isMissed` has no grace concept, so *any* past-dated
Placement for a Workout with no Session reads as missed on all four surfaces
(`MonthGrid.tsx:117`, `DaySheet.tsx:100`, `CalendarScreen.tsx:86`,
`TodayScreen.tsx:103`). This is already shipped behaviour: `movePlacement` does
no date validation (`placements.ts:37-39`) and every calendar cell is pressable
by design (`DayCell.tsx:104-105`). **Do not over-engineer around it** — it is
context, not a new failure mode.

**R-8 — Eighteen sites assert the invariant, not nine.** Both verifiers refuted
the first enumeration. Confirmed doc sites: `AGENTS.MD:79-81`, `CONTEXT.md:12`,
`PRODUCT.md:83-85`, `docs/PRD.md:603`, `:1907`, `:2452`. Confirmed src sites, all
re-read at HEAD: `db/repositories/workouts.ts:1`, `plannedExercises.ts:1`,
`routines.ts:4-5`, `exerciseSessions.ts:39-41`, `routine-file/edit.ts:4-7`,
`domain/session/index.ts:258-260`, `domain/types.ts:66-69`,
`RoutineDetailScreen.tsx:2,6`, `RoutinesScreen.tsx:4-7`, plus three the first
sweep missed because it grepped for "immutab":

- `src/domain/routine-file/index.ts:13-16` — "§11.1 is where a Routine is
  corrected and **the only place it can be**", alongside a hard-coded
  enumeration of the five edit verbs (repeated in the barrel at `:36-44`).
- `src/features/import/ExercisesStep.tsx:11` — "§11.1 gives no way to add an
  exercise in the MVP, so none is offered." This is the header of the very
  screen DEC-A adds the affordance to.
- `src/domain/routine-file/edit.ts:49-52` — the stated **behavioural
  justification** for letting `deleteExercise` empty a Workout is that nothing
  can add one back. DEC-A deletes that premise, so this branch needs a decision,
  not a comment edit.

Also missed on the counter-side of the contradiction: `AGENTS.MD:59-62`
presupposes later template edits ("reading targets back out of a template would
let a later edit rewrite the past") three paragraphs above the line that forbids
them, and `docs/changes/2026-08-19-import-wizard/spec.md:64` records the
exclusion DEC-A flips.

**R-9 — Five copy blocks assert import-only provenance.**
`TodayScreen.tsx:161-163` ("Import a routine file that declares at least one
Workout" — the natural home for DEC-B's affordance), `TodayScreen.tsx:226`,
`CalendarScreen.tsx:157`, `RoutinesScreen.tsx:140`, `RoutineDetailScreen.tsx:55`.

**R-10 — No screen in this change can be covered by an automated test.** Vitest
runs `environment: 'node'` with no jsdom, happy-dom, or `@testing-library`
(`vitest.config.ts:10`). Per AGENTS.MD, "UI is verified by running it." Domain
functions must therefore carry the correctness weight — and Stryker's `mutate`
list does not cover `routine-file/**` or `catalog/**`.

**R-11 — A documentation contradiction found in passing, unrelated to the
decisions but worth recording.** `src/domain/types.ts:80-82` states
`suggestedDays` is "read once, during import … and never consulted afterwards",
while `RoutineDetailScreen.tsx:77,99-101` reads it on every render.

## Do Not Touch

- `docs/PRD-DMS.md` — untracked, unrelated to TrainLog, belongs to a different
  product. No workstream may read, move, edit, or stage it.
- `src/db/schema.ts` — `SCHEMA_V1`, `SCHEMA_VERSION`, `backfillPlannedUnit`.
  ASM-1 depends on this file not changing.
- `src/domain/backup/document.ts` — `BACKUP_VERSION`.
- `src/domain/catalog/data.ts` — catalog slugs are permanent (REQ-023); stored
  history references them.
- Destructive edit paths on stored Routines. DEC-B is additive only; nothing may
  gain a delete or an in-place rewrite of an existing Workout or
  PlannedExercise.
- The existing `deleteRoutine` refusal (`RoutineHasSessionsError`).

## Recommended Next Step

All five decisions are taken. Two things follow, in order:

1. **Land the DEC-Q5 quick change first** —
   `docs/changes/2026-08-24-empty-routine-accept/`. It is independent of this
   change. Note the honest severity: `archiveRoutine` keeps Sessions and history
   intact (§37) and re-activation is reachable from the Routines screen
   (`RoutinesScreen.tsx:170`), so this **displaces** the active Routine rather
   than destroying anything. Disruptive and recoverable, not data loss.
2. **Write `spec.md` for this change**, with the Decisions Taken table as frozen
   input, then `plan.md` with Gate 0 (the `edit.ts` add seam) landing before any
   workstream.

The spec must carry forward, in its own words: R-3 (`exercise_id` discards
user-Exercise identity), R-4 (the §26 guard is at 100% coverage today and must
stay there), and the DEC-Q1 exclusion of `suggested_day_shared` from the
stored-rows path.
