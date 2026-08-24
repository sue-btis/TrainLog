# Routine Authoring — Spec

Status: Ready for planning
Size: large
Reliability: strict
Audit baseline: `49efc78` **plus** the landed quick change
[`2026-08-24-empty-routine-accept`](../2026-08-24-empty-routine-accept/), which
added the semantic code `routine_has_no_workouts`. All `path:line` citations in
this file are anchored to that tree, not to `49efc78` alone.

An implementer needs this file plus their own plan section. They do not need
`audit.md`, and they do not need the conversation that produced either.

Requirement ids prefixed `REQ-0xx`/`AC-0xx` and PRD ids such as `DEC-007`,
`REQ-071` refer to **`docs/PRD.md`**, never to this document's tables. Where a
provenance cell cites one, it is a PRD id.

## 1. Goal

A lifter can build and grow a training programme inside the app instead of only
importing one:

- create an Exercise the bundled catalog does not carry;
- author a Routine from nothing, without a YAML file;
- add a Workout — and Planned Exercises — to a Routine already accepted.

The invariant **"Routines are immutable once accepted"** is amended to
**"Routines take no destructive edits"**. Additions are allowed; rewriting and
deleting stored planning rows are not, and remain impossible.

## 2. Scope

### Included

- A create-Exercise path on the Exercises screen, sharing one §26 name matcher
  with the import pipeline.
- Add-Workout, add-exercise, set-routine-name and set-workout-name verbs on the
  in-memory routine-file draft.
- A "Start from scratch" entry into the existing import wizard.
- A wizard-local exercise picker (new code).
- Add-Workout and add-Planned-Exercise writers against stored Routines, with
  Placements generated from today forward.
- Amendment of the invariant across every document and source comment that
  asserts it, and every copy block that asserts import-only provenance.

### Excluded

- Editing or deleting a **stored** Workout, Planned Exercise, or Routine field.
  No rename, no reorder, no target edit on anything accepted. *(The draft verbs
  REQ-012 and REQ-204 operate only on the in-memory draft, before Accept — see
  the boundary note below.)*
- Renaming or deleting a user Exercise.
- Routine versioning of any kind.
- Any schema, index, `SCHEMA_VERSION` or `BACKUP_VERSION` change (ASM-1).
- Closing the §26 Unicode-normalization gap (REQ-109 pins it open deliberately).
- Widening `exercise_id` to resolve user-Exercise ids (REQ-312).
- Modifying `src/features/session/ExercisePicker.tsx` (DEC-Q4).
- A new ADR (REQ-510 records why).

**The draft/stored boundary.** A `RoutineFile` held in the wizard is *not* a
Routine. It has been written nowhere, no Session can reference it, and every
verb in §3.1 acts on it alone. Once `importRoutine` writes it, the only
permitted change is an addition (§3.5). An implementer who finds themselves
editing a stored `Workout.name` or a stored `PlannedExercise` field has left
scope — see stop condition 9.

## 3. Required Behavior

Grouped by workstream; ids are stable. `→ REQ-9xx` marks a requirement amended
by a cross-cutting resolution in §3.7.

### 3.1 Gate 0 — the shared draft contract

Lands **alone and first**. Everything else depends on it.

Gate 0's landing must satisfy §12's four gates on its own. That is why it owns
the `issues.ts` entries in REQ-013: adding a `SemanticIssueCode` member breaks
`tsc` in the same commit, because `FIX` is a total `Record` and `problemOf` a
`default`-less switch.

| ID | Requirement | Provenance | AC |
|---|---|---|---|
| REQ-001 | A lifter can add a Workout to a draft. It is named at creation, appended after every existing Workout, and arrives with no suggested days and no exercises. Seam: `addWorkout(file, name): RoutineFile`. | Audit "Actual Problem"; `edit.ts:35,54,67,94,108`; DEC-C | AC-001, AC-007 |
| REQ-002 | An added Workout is clean on arrival: `validateRoutineFile` reports exactly what it reported before, plus nothing. An added Workout with zero exercises stays valid, and claims no suggested day so it cannot raise `suggested_day_shared`. Adding the first Workout to a zero-Workout draft clears `routine_has_no_workouts`. | `validate.ts` (DEC-Q5, shipped); ASM-3 | AC-002 |
| REQ-003 → REQ-900 | A lifter can add an exercise to a Workout in a draft. It is appended last. Seam: `addExercise(file, workoutIndex, exercise: RoutineFileExercise): RoutineFile`, appending the given row **verbatim** — the verb composes no defaults of its own. | Audit R-4; DEC-A; REQ-900 | AC-003, AC-007 |
| REQ-005 → REQ-900 | Adding an exercise never invents identity. The §26 guard keeps its coverage: the same new name added to two Workouts of one draft mints exactly one Exercise, shared by both Planned Exercises. What each offer kind writes is REQ-303's rule, not this verb's. | Audit R-3, R-4; `to-domain.ts:61-73` | AC-005 |
| REQ-006 | Position is the order the lifter will train in. Both add verbs **append, never insert**, so an added Workout takes the highest `Workout.order` and an added exercise the highest `PlannedExercise.order`; no existing row's order changes. `moveExercise` stays the only verb that reorders. | `to-domain.ts` — `order` from array index | AC-001, AC-006 |
| REQ-007 | The add verbs cannot crash or corrupt the draft the wizard is holding: each returns a new `RoutineFile`, leaves its input untouched, and returns the same file unchanged when an index names nothing — identical to the five verbs already there. | `edit.ts:9-13`, `:123-133` | AC-007 |
| REQ-008 | A lifter can change a draft's Routine name before accepting. Seam: `setRoutineName(file, name)`, mirroring `setWeeks`. | Audit "Relevant Surface"; DEC-C | AC-008 |
| REQ-009 | Removing the last exercise from a Workout stays allowed, and a lifter who does it can now put one back in the same draft. Behaviour unchanged; its stated reason changes (REQ-511). | Audit R-8; ASM-3 | AC-009 |
| REQ-010 | `@/domain/routine-file` re-exports the new verbs and the blank-seed factory; the barrel header enumerates them all instead of five; the claim that §11.1 is "the only place" a Routine can be corrected is amended **in exactly two files** — `src/domain/routine-file/index.ts:13-16` and `src/domain/routine-file/edit.ts:4-7`. The other **thirteen** source assertion sites belong to WS-5 (REQ-512). | Audit R-8 | AC-010 |
| REQ-011 → REQ-901 | An added row is judged by exactly the rules an imported row is judged by — no second validator. Breaking an added exercise with the existing verbs raises the existing issue at that row's own field path. | `validate.ts:40` | AC-011 |
| REQ-012 | A lifter can correct a Workout's name in a draft. Seam: `setWorkoutName(file, workoutIndex, name)`. **Draft only** — no stored Workout gains a rename. Rationale: from-scratch authoring is the first path that can create a Workout, so the first that can create a typo, and there is no delete-Workout verb, so the only other escape would be discarding the whole draft. | DEC-Q6 | AC-012 |
| REQ-013 → REQ-901 | The blank-routine-name rule ships in Gate 0, complete across all three of its files, so Gate 0 typechecks green alone: the union member in `validate.ts`, and its `FIX` entry and `problemOf` case in `src/features/import/issues.ts`. The member is named **`routine_name_blank`**. | REQ-901; `issues.ts:82`, `:104-126` | AC-013 |
| REQ-014 | A blank `RoutineFile` can be constructed from the domain: `blankRoutineFile(weeks: number): RoutineFile` returns `{ version: 1, routine: { name: '', weeks, workouts: [] } }`. `weeks` is a parameter, not a constant, so the feature layer keeps ownership of its own default and the domain reads no feature constant. | REQ-908; `schema.ts:75` (`version` literal) | AC-014 |

### 3.2 WS-1 — creating user Exercises

| ID | Requirement | Provenance | AC |
|---|---|---|---|
| REQ-100 | A lifter can create an Exercise from the Exercises screen by naming it. It appears in the list without a reload, under its category group, and its row opens that Exercise's history like any other. | PRD §39 item 7; DEC-A | AC-100 |
| REQ-101 | Creating can never mint an Exercise whose normalized name already belongs to a catalog entry or an existing user Exercise. On collision **nothing is written**, the lifter is told which Exercise already carries that name, and can open it in one step. | Audit R-4; PRD §26; DEC-Q7 | AC-101, AC-102 |
| REQ-102 → REQ-902 | Both creation paths decide "does this name already exist" with **one implementation**: `findExerciseByName(name, userExercises): Exercise \| undefined` in `@/domain/catalog`, consulting the catalog first and the lifter's Exercises second. `resolveFileExercise` is re-expressed on top of it and its observable resolution order does not change. | Audit R-4, R-5; `to-domain.ts:66-73`; `catalog/index.ts:35-37` | AC-103 |
| REQ-103 | An Exercise created on the screen is found by a later import that names it, in any casing or spacing, so the import reuses it and history stays in one piece. | PRD §26 | AC-104 |
| REQ-104 | Two overlapping creations of the same name produce one Exercise: the duplicate decision and the write happen inside one transaction. **Closes the TOCTOU hole on this path.** Deliberately not closed on the import path, which reads outside `importRoutine`'s transaction — a different contract, out of scope. | Audit R-4; `ImportWizard.tsx:142-145` | AC-105 |
| REQ-105 | A created Exercise carries a category and equipment drawn from the **vocabulary the bundled catalog itself uses**, or none. Neither field accepts free text; neither is required. An Exercise with no category is grouped under `uncategorized`, never dropped. The offer lists derive from `CATALOG` only, never from `user + CATALOG`, or an imported dirty category would propagate. The screen already derives its equipment filter this way (`ExerciseCatalogScreen.tsx:83-89`); the same derivation serves the form. *(Closed vocabulary is a drafter scope call — §13.)* | `types.ts:53-58`; `catalog/index.ts:98-100`; PRD §39 item 8 | AC-106 |
| REQ-106 | A blank or whitespace-only name is refused; nothing is created. An accepted name is stored trimmed, with the lifter's own casing. The refusal reaches the caller as a **named `Error` subclass thrown inside the transaction**, following `RoutineHasSessionsError` (`routines.ts:17-30`) — the repository's established refusal channel. | `to-domain.ts:79`; `routines.ts:17-30` | AC-107 |
| REQ-107 | Creating never writes a catalog Exercise into the `exercises` table. Typing a catalog movement's name resolves to that catalog entry with its permanent slug, and the table is unchanged. | PRD DEC-007, REQ-071 | AC-108 |
| REQ-108 | A created Exercise cannot be renamed or deleted. The screen offers no such control; the repository gains no verb that would rewrite or remove a row. | Audit "Excluded" | AC-109 |
| REQ-109 | Two names differing only in Unicode composition are treated as **two** Exercises. A known §26 gap this change does not close, pinned by a test so closing it later is deliberate. | Audit R-4 (no NFC/NFD folding) | AC-110 |
| REQ-110 | The Exercises screen stops telling the lifter that nothing is created there. Header contract and empty-state copy state what is now true. | `ExerciseCatalogScreen.tsx:17-21` | AC-111 |

### 3.3 WS-2 — authoring from scratch

| ID | Requirement | Provenance | AC |
|---|---|---|---|
| REQ-200 | Three surfaces offer "Start from scratch" beside their import affordance, and pressing it opens no file picker: `src/features/import/FileStep.tsx`, `src/features/today/TodayScreen.tsx:224-230` (the NoRoutine well), and `src/features/routines/RoutinesScreen.tsx` (the header). The in-wizard control on FileStep dispatches the blank seed directly rather than routing through the URL. `ImportWizard.tsx:346` ("Import another routine") is deliberately **not** a fourth surface. | DEC-C | AC-200 |
| REQ-201 | `/import?new=1` opens step 1 on a blank draft rather than the file step. The parameter is consumed exactly once, on mount, in the same effect as the file handover (`ImportWizard.tsx:105-110`); if a file was handed off, the file wins. `restart` from a from-scratch draft returns to the file step, not to a new blank draft. | `ImportWizard.tsx:105-110` | AC-201 |
| REQ-202 | The wizard stops recording where its draft came from. The `editing` phase carries no file name, and file-origin and from-scratch drafts reach step 1 through the same transition. | `state.ts` — `editing` requires `fileName: string` | AC-202 |
| REQ-203 → REQ-908 | A blank draft opens **blocked and says why**: it declares no Workouts and has no name, the action bar reports exactly those two problems, and Accept stays disabled until both are answered. The seed is `blankRoutineFile(4)`. `routine_has_no_workouts`'s message must read correctly for an unnamed draft — it names the routine only when there is a name. The `weeks: 4` default is a spec decision (§13). | DEC-Q5 (shipped); `state.ts:20-21` | AC-203 |
| REQ-204 | The routine name on step 1 becomes an editable field rather than a read-only line, **for every draft** — a name that arrived in a file can be corrected there too. This edits the draft only, never a stored Routine. | `ExercisesStep.tsx:79` | AC-204 |
| REQ-205 → REQ-901 | A Routine cannot be accepted with a blank or whitespace-only name. Flagged as `routine_name_blank`, addressed to the path `routine.name`, listed in the action bar, jumpable and focusable, blocking Accept. **This applies a new refusal to the existing import path** — a previously acceptable file now cannot be accepted unnamed (§13). | REQ-901 | AC-205 |
| REQ-206 | A lifter can add a Workout to the draft by naming it. It arrives with no suggested days and no exercises, is appended, and **becomes the Workout on screen** — necessary because the tab strip only renders above one Workout, so without it adding a Workout would change nothing visible. | `ExercisesStep.tsx:88-104` | AC-206 |
| REQ-207 | The add-a-Workout control refuses a blank name **in the form**, rather than admitting a nameless Workout and flagging it afterwards. Unlike the routine name (REQ-901), this control is a submit, so a refusal has somewhere to live. | DEC-C; REQ-901 by contrast | AC-207 |
| REQ-208 | When a draft has no Workouts, step 1 offers the fix that now exists. Neither the empty state (`ExercisesStep.tsx:107-113`) nor the action bar's recovery sentence (`issues.ts` — `FIX.routine_has_no_workouts`) instructs the lifter to edit a file and choose it again. Note that the `FIX` string does not render anywhere today (the issue carries no paths), so this is a correctness edit for when it does. | Audit R-9; `issues.ts` | AC-208 |
| REQ-209 | No copy on the wizard's own path claims the draft came from a file, and the file path still reads correctly under the same words. Covers step 2's opening line, the file step's well, the wizard titles, and the confirmation chip, heading and primary button. | Audit R-9 | AC-209 |
| REQ-210 | A from-scratch Routine is accepted, stored and made active by the same path an imported one is. If no Workout was given a suggested day it still accepts: no Placements are written, the confirmation says so, and Today falls back to next-in-rotation. | `import.ts:38-58`; `scheduling/index.ts` | AC-210 |
| REQ-211 → REQ-906 | The Routines list states when a Routine was **created**, not that it was imported — for every Routine, including ones imported before this change. | DEC-Q3; `RoutinesScreen.tsx:140` | AC-211 |
| REQ-212 → REQ-906 | The two screens that invite a lifter to get a Routine state both ways in, and neither asserts a routine must be a YAML file. | Audit R-9 | AC-212 |

### 3.4 WS-3 — adding an exercise inside the wizard

| ID | Requirement | Provenance | AC |
|---|---|---|---|
| REQ-300 | While reviewing a Workout in step 1, a lifter can add an exercise to it. It appears last in that Workout's list, the picker closes, and the new row opens for editing. | DEC-A | AC-300 |
| REQ-301 → REQ-911 | The picker offers three sources as one list — the bundled catalog, the lifter's persisted Exercises, and every exercise already written anywhere in the draft. The list is de-duplicated by **resolved identity**, not by normalized name: each draft row is resolved first (its `exercise_id` against the catalog, then its name through `findExerciseByName`), so a draft row that is really a catalog movement is offered once, as that catalog entry. Render order is catalog-resolution order — catalog, then persisted, then draft-only — matching `resolveFileExercise`. | Audit R-5; REQ-911 | AC-301 |
| REQ-302 | Within one authoring session, an exercise named in one Workout is offerable in every other Workout of the same draft, before anything is stored. Naming a movement in Push then picking it in Pull produces **one** Exercise at Accept, referenced by both Planned Exercises. | Audit R-5 (`useUserExercises` reads the persisted table) | AC-302 |
| REQ-303 → REQ-911 | Identity is written by **offer kind**, because `exercise_id` is a catalog channel only. A catalog offer writes `name` (the catalog's canonical spelling) **plus** `exercise_id`. A draft offer writes the source row's `name` **and copies its `exercise_id` when the source row carries one**. A persisted-user offer and a newly typed name write `name` alone, `exercise_id` absent. | Audit R-3; `to-domain.ts:61-65`; REQ-911 | AC-303 |
| REQ-304 | Identity survives `routineFileToDomain`. A catalog pick resolves to that catalog Exercise and creates nothing; a persisted pick resolves to that same stored row with no duplicate write; a draft-only name mints exactly once for the whole file; **a draft row carrying a slug under a non-catalog name resolves to that catalog entry, not to a second Exercise.** | `to-domain.ts:57-83`; REQ-911 | AC-304 |
| REQ-305 | A lifter can name a movement none of the three sources knows, without leaving the wizard. It writes a name into the draft and stores nothing; the Exercise is minted at Accept inside `importRoutine`'s transaction, exactly as an imported file's would be. | `to-domain.ts:75-83` | AC-305 |
| REQ-306 | A typed name matching an existing offer by normalized name **reuses that offer** and says so before the lifter commits. Note the deliberate asymmetry with REQ-101: DEC-Q7's *refusal* governs the create screen, where a duplicate is a mistake. Here a duplicate is the correct outcome — the lifter is naming a movement to program, and reuse is what keeps history in one piece — so the picker reuses and informs rather than refusing. | Audit R-4; DEC-Q7 (scoped) | AC-306 |
| REQ-307 → REQ-900 | An added exercise is never already broken: it introduces no semantic issue and never arrives wearing the red fix chip or blocking Accept. Its seeded shape is REQ-900's. | REQ-900 | AC-307 |
| REQ-308 | The picker is part of the step-1 column, not an overlay: it renders in flow where the add control was, keeps its list bounded and internally scrollable, and never covers or disables the fixed ActionBar. | Audit R-5; `ImportWizard.tsx:271-291` | AC-308 |
| REQ-309 | A Workout the lifter emptied offers the same way back in: the empty-Workout well carries the add control, and stops claiming an exercise can only be restored by choosing the file again. | `ExercisesStep.tsx:118-125` | AC-309 |
| REQ-310 | Two exercises with the same name in one Workout behave as two independent rows: expanding or arming removal on one does not affect the other. | `ExercisesStep.tsx` `openRef` | AC-310 |
| REQ-311 | Gym mode carries no risk: the live-session picker keeps its behaviour, its three props and its refusal to create, and the wizard does not reach into it. | DEC-Q4 | AC-311 |
| REQ-312 | `exercise_id` keeps resolving against the bundled catalog only. `resolveFileExercise` is **not** widened to accept user-Exercise ids and `to-domain.ts`'s resolution order does not change. Rationale: the name channel already delivers correct identity for every non-catalog case (REQ-304), and widening would add a second identity channel to the function the whole §26 guarantee rests on. **A slug/UUID collision argument is not part of this rationale and must not be cited** — catalog slugs are lowercase kebab-case words and `newId` is `crypto.randomUUID()`, so they cannot collide. | `catalog/data.ts`; `ids.ts` | AC-312 |

### 3.5 WS-4 — adding to a stored Routine

| ID | Requirement | Provenance | AC |
|---|---|---|---|
| REQ-400 | A lifter viewing the **active** Routine's detail screen can add a Workout to it — a name plus zero or more suggested days — and it appears in the Routine's list. Purely additive: no existing row is rewritten or removed. | DEC-B | AC-400 |
| REQ-401 | An added Workout takes the last rotation position: `order` one greater than the highest already in that Routine, computed **inside the transaction**, so `listWorkoutsByRoutine` returns it last and `nextWorkoutInRotation` reaches it after the others. | `workouts.ts:13`; `scheduling/index.ts:85` | AC-401 |
| REQ-402 | Adding a Workout also places it: one Placement per suggested day per week, **from today forward**, for the Routine's remaining weeks. Remaining weeks is `clamp(routine.weeks - wholeWeeksBetween(mondayOfWeek(anchor), mondayOfWeek(today)), 0, routine.weeks)`, where `anchor = formatLocalDate(new Date(routine.createdAt))`. **Weeks are Monday-aligned**, matching `generatePlacements`, which begins week 1 at `mondayOfWeek(anchorDate)` — a rolling 7-day rule would disagree by a whole week. Seam: `remainingWeeks(weeks, anchorDate, today): number`. | DEC-Q2; ASM-2; `scheduling/index.ts:58`; `dates.ts:67-71` | AC-402 |
| REQ-403 | When remaining weeks is zero, or no suggested day was selected, the Workout is **still added** with zero Placements, and the form says so plainly before saving — naming the reason and stating the Workout is still trainable from Today. | DEC-Q2; ASM-3 | AC-403 |
| REQ-404 → REQ-912 | Before saving, the form states the number of Placements the save will create and the first and last dates they span, computed by the **same pure function over the same inputs** the writer uses. It is not the same *call*: `generatePlacements` mints a `PlacementId` per Placement and needs a `Workout` row that does not exist until the write, which is why the repo's own preview (`ScheduleStep.tsx:218-228`) fabricates ids and calls it separately. If the in-transaction read yields a different count, the write proceeds and the confirmation reports **what was actually written**. | REQ-912; `scheduling/index.ts:36-42`, `:68`; `ScheduleStep.tsx:218-228` | AC-404, AC-419 |
| REQ-405 → REQ-907 | When a selected suggested day is already claimed by another Workout of the same Routine, the form warns beside that day — naming the claiming Workout and the **full** consequence of REQ-406 — but does not disable saving and does not remove the day. This is DEC-Q1's replacement for `suggested_day_shared`, which is knowingly unenforced here. | DEC-Q1; `TodayScreen.tsx:376` | AC-405, AC-407 |
| REQ-406 | A shared suggested day has **two** consequences, and the warning of REQ-405 must state both. First, the default suggestion on Today goes to the lower-`order` Workout, because `suggestWorkout` uses `workouts.find`; the added Workout stays reachable via the Workout strip, which renders whenever more than one Workout exists. Second — and this is the one that persists — on every colliding date the lifter trains only one of the two Workouts, so the other's Placement finds no Session matching its `workoutId` and derives as **missed**: on Today's "N planned days went untrained" banner, in the month tally, and on the calendar day itself. It repeats every remaining week until that Placement is moved or deleted, and the warning must name that recovery. This failure mode is genuinely new: the wizard path cannot produce it, because `suggested_day_shared` blocks Accept there. | `scheduling/index.ts:107-118` (`isMissed` keys on `workoutId`+date), `:185-187`, `:244`; `TodayScreen.tsx:103,123-137,176,376`; `validate.ts:125-147` | AC-406, AC-420 |
| REQ-407 | A lifter can add a Planned Exercise to a Workout of the active Routine, choosing an Exercise that already exists — catalog or their own — and entering its targets: `sets`, rep range, RIR range, `restSeconds` and `unit`. `focus` is `null` and `notes` is `[]` on an added row; neither is collected. This flow **creates no Exercise**. | DEC-B; `types.ts:123-138` | AC-408 |
| REQ-408 | An added Planned Exercise takes the last position in its Workout, computed inside the transaction. | `plannedExercises.ts:17` | AC-409 |
| REQ-409 → REQ-913 | Entered targets are checked by `validateRoutineFile` itself, applied to a synthetic single-Workout `RoutineFile` built by an exported pure function, so the wizard path and the DEC-B path share one implementation rather than two that must agree. The synthetic file carries a non-blank `routine.name` and one Workout with no `suggested_days`, so neither `routine_name_blank` nor `suggested_day_shared` can fire. Returned `paths` are mapped back onto the form's fields by their trailing segment. | DEC-Q1; REQ-913; `validate.ts:40` | AC-410 |
| REQ-410 | Progression is a closed choice over the two rules the engine implements — `manual`, and `double_progression` with a required `increment` — so `progression_unrecognized` is unreachable here without a validator: no free text can reach `ProgressionRule.type`. | `types.ts:96-116`; PRD §27 | AC-411 |
| REQ-411 | Each writer refuses what it can check without leaving its layer, throwing a named `Error` subclass inside its transaction so nothing is stored: an unknown `routineId` or `workoutId`; a Workout name blank after trimming; and **a Routine whose `status` is not `active`**, checked against the row read inside the transaction rather than trusted from the caller. It does not re-check semantic targets — DEC-Q1 places those in the form. | DEC-Q1; REQ-414; `routines.ts:17-30` | AC-412 |
| REQ-412 → REQ-912 | Each add is one Dexie transaction over exactly the tables it touches, so a failure leaves no partial state. Adding a Workout locks `routines`, `workouts` and `placements`, reading the Routine inside the transaction so `weeks`, `createdAt`, `status` and the highest `order` cannot go stale. Adding a Planned Exercise locks `workouts` and `plannedExercises`, reading the Workout inside the transaction for the same reason. | `import.ts:42-44` | AC-413 |
| REQ-413 | Neither add touches what already happened. Sessions, Exercise Sessions and their snapshotted targets are untouched, and a Session recorded before an add still renders exactly what it recorded. **This is the requirement that makes DEC-B safe**; audit R-1 establishes it holds today. | Audit R-1; ADR 0002 | AC-414a, AC-414b |
| REQ-414 | Both add affordances appear only on the **active** Routine. An archived Routine's detail screen stays read-only, because a Placement generated into an archived Routine would land on a calendar that reads across all Routines. Enforced in the writer by REQ-411, not only in the UI. *(Drafter scope call — §13.)* | `placements.ts:32-34` (no routine filter) | AC-415 |
| REQ-415 | Nothing on the detail screen gains a destructive or rewriting verb: no rename, no delete, no reorder, no target edit. The only new controls are the two adds. | Audit "Excluded" | AC-416 |
| REQ-416 | Adding a Workout is complete on its own and may ship before adding a Planned Exercise. A Workout with no Planned Exercises is selectable on Today, starts a Session, and shows the Session screen's empty-Workout well. | ASM-3; `sessions.ts:71-73` | AC-417 |
| REQ-417 | A backup taken after an add carries the added Workout, its Placements and any added Planned Exercise, and restoring it brings them all back — demonstrating ASM-1 holds. | ASM-1 | AC-418 |

### 3.6 WS-5 — documents, invariant, copy

Lands **last**, taking each file as its owning workstream left it.

| ID | Requirement | Provenance | AC |
|---|---|---|---|
| REQ-500 | The three binding rule documents state the amended invariant and none claims a Routine cannot be added to: `AGENTS.MD:79-81`, `CONTEXT.md:12`, `PRODUCT.md:83-85`. | Audit R-8 | AC-500 |
| REQ-501 | The PRD's two Spanish assertions of immutability state the amended rule: `docs/PRD.md:603-604`, `:1907-1908`. | Audit R-8 | AC-501 |
| REQ-502 | PRD §11.1 no longer states exercises cannot be added (`docs/PRD.md:519-520`). | Audit R-8 | AC-502 |
| REQ-503 | PRD §11.1 documents that the wizard can be entered without a file. | DEC-C | AC-503 |
| REQ-504 → REQ-901 | Every enumeration of the semantic checks lists all of them — now **eight**, with `routine_has_no_workouts` and `routine_name_blank`. Three sites: `docs/PRD.md:557-562`, `AGENTS.MD:90-94`, and `src/domain/routine-file/schema.ts:10-13`. The first two are already stale at HEAD because the landed DEC-Q5 change did not update them; this change clears that debt. | DEC-Q5; REQ-901 | AC-504, AC-505 |
| REQ-505 | The DEC-Q1 validation exclusion is written down as a standing rule in `AGENTS.MD`'s Validation section: the semantic tier runs on the wizard's draft; a Workout added to an accepted Routine is checked by its form, and `suggested_day_shared` is not enforced there. | DEC-Q1 | AC-506 |
| REQ-506 | Two places stop claiming a suggested day is read only during import — `CONTEXT.md:20-23` and the `Workout` doc comment at `src/domain/types.ts:78-82` — which audit R-11 shows is already false at HEAD. | Audit R-11 | AC-507 |
| REQ-507 | `CONTEXT.md` gains exactly one new entry — **Routine Draft**, the editable Routine held in the wizard before Accept — and deliberately no others. | AGENTS.MD ("add it in the same change") | AC-508 |
| REQ-508 | PRD §39 item 7 moves to 🟡, with item 8 left explicitly still blocked (this change delivers *crear* only). | PRD §39 | AC-509 |
| REQ-509 | PRD §39 item 14 moves to 🟡 **and its false claim is corrected**: immutability does not hold up ADR 0002's snapshot. Audit R-1 establishes from code that the snapshot is what makes templates safely editable, exactly as ADR 0002's own Consequences state. | Audit R-1 | AC-510 |
| REQ-510 | No new ADR is written, and `docs/adr/` still holds two files. Both existing ADRs record a choice between considered options that shaped the data model; this change shapes no data model and reverses no ADR — it corrects a document that misread one. The justification lives in this change folder. | `docs/adr/` | AC-511 |
| REQ-511 | **Behaviour, not a comment edit.** A lifter who deletes the last exercise from a Workout in the wizard still succeeds, leaving zero exercises. `deleteExercise` keeps its permissive branch — but its stated reason changes from "nothing can add one back" to "an empty Workout is a valid state that runs end to end". | Audit R-8 (`edit.ts:49-52`); ASM-3 | AC-512 |
| REQ-512 | No source comment survives asserting that an accepted Routine is immutable or that an add path cannot exist. **Thirteen** sites, WS-5-owned or verified-in-place; Gate 0 owns two more (REQ-010), for fifteen in total. The thirteen: `src/db/repositories/workouts.ts:1`, `plannedExercises.ts:1`, `routines.ts:4-5`, `exerciseSessions.ts:39-41`, `placements.ts:13-14`, `src/domain/routine-file/edit.ts:49-52`, `src/domain/session/index.ts:258-260`, `src/domain/types.ts:67-68`, `src/features/import/ExercisesStep.tsx:11`, `src/features/routines/RoutinesScreen.tsx:4-7`, `src/features/routines/RoutineDetailScreen.tsx:2` and `:6`, `src/features/session/ExerciseReorder.tsx:19-21`. The last three of these were missed by audit R-8. | Audit R-8 + three misses | AC-513 |
| REQ-513 → REQ-906 | No user-visible copy tells a lifter a Routine can only come from a file. Seven blocks, each with one owning workstream (§3.7). | Audit R-9 | AC-514 |
| REQ-514 → REQ-906 | The routines list states a true provenance for every Routine (DEC-Q3). WS-2 makes this edit; WS-5 verifies rather than re-editing. | DEC-Q3 | AC-211 |
| REQ-515 | `CONVERSION_PROMPT`'s Rules section states every rule the importer enforces at the end of this change, including that a routine must declare at least one Workout and that its name must not be blank. Its header claims "every rule stated here is one the importer enforces", and its test asserts only that the example validates, so a missing rule is otherwise invisible. | REQ-904; `ConversionPromptButton.tsx:22-26` | AC-516, AC-517 |
| REQ-516 | The documentation lands satisfying the repo's own rule — §38/§39 tables updated in the same commit as the change record — and rewrites no history. | `docs/PRD.md:2348`, `:2405` | AC-515 |

### 3.7 Cross-cutting resolutions

These resolve contradictions between independently drafted workstreams, or gaps
no workstream claimed. Where a requirement above is marked `→ REQ-9xx`, the
resolution **overrides** it.

| ID | Resolution | Provenance | AC |
|---|---|---|---|
| REQ-900 | There is exactly **one** add-exercise verb, taking a complete `RoutineFileExercise`. The seeded shape — `{ name, sets: 3, reps: { min: 8, max: 12 }, notes: [], progression: { type: 'manual' } }`, every optional field absent — is composed by **WS-3's `draftExercise(offer)`**, not by `edit.ts`, because only the picker knows whether the row carries a catalog slug. A name-only verb would silently drop the slug. `unit` is left absent on purpose: `to-domain.ts` maps an absent unit to the Settings default, so the seed inherits the lifter's preference without the domain reading Settings. Seeding *invalid* values to force completion was rejected: it blocks Accept for the whole draft the instant an exercise is added, possibly from a Workout tab the lifter is not looking at, and `validateRoutineFile`'s messages would state something false about a row the lifter never wrote. | Gate 0 vs WS-3 contradiction; `schema.ts:54-66`; `to-domain.ts` | AC-003, AC-004 |
| REQ-901 | The blank-routine-name code is **in scope for the whole change**, named **`routine_name_blank`**, and **Gate 0 owns all three of its files** (REQ-013) so Gate 0 typechecks green alone. WS-2's blank seed opens with no name and step 1's name is an inline field with no submit, so there is nowhere a form-level refusal could live. WS-5's enumerations count eight; WS-4's synthetic file (REQ-409) carries a non-blank name so the rule cannot fire spuriously. | WS-2 vs Gate 0 vs WS-5; `issues.ts:82,104-126` | AC-013, AC-205 |
| REQ-902 | There is **one** §26 matcher. WS-3's `offeredExercises` and `resolveTypedName` call `findExerciseByName` from `@/domain/catalog` rather than re-deriving the resolution order, and a test fails if they do not (TST-101, TST-300). **WS-1 lands before WS-3.** The offer the picker shows is, by construction, the Exercise `resolveFileExercise` will resolve to. | WS-1 REQ-102 vs WS-3's third decider | AC-103, AC-301 |
| REQ-903 | A draft abandoned other than by Discard **warns before it is lost**, by two mechanisms, because one is not enough: a `beforeunload` listener covers reload and tab close, and a pushed history sentinel answered by a `popstate` handler covers the browser/hardware back button. The second is required and must not be omitted: the app mounts `BrowserRouter` (`App.tsx:29,46`), so back from `/import` is a same-document traversal that never fires `beforeunload` — and on the one-handed phone this app targets, back is the likeliest exit. React Router's `useBlocker` is **not** available: it requires a data router. The `popstate` path reuses the existing Discard confirmation (`ActionBar.tsx` `confirmingCancel`, driven by `ImportWizard.tsx:224,276-286`). The in-app TopBar back is already guarded and needs nothing. No storage, no dependency, no schema — ASM-1 is load-bearing. | DEC-Q8; `App.tsx:29,46,60`; `ImportWizard.tsx:224` | AC-421 |
| REQ-904 | *(Folded into REQ-515, which WS-5 owns.)* | Gap | AC-516, AC-517 |
| REQ-905 | The stored-rows writers are **not** named `addWorkout`/`addExercise`: `workouts.ts` exports `addWorkoutToRoutine`, `plannedExercises.ts` exports `addPlannedExercise`. A repository writer and a draft verb should not share a name — `RoutineDetailScreen.tsx` imports `validateRoutineFile` from `@/domain/routine-file` (REQ-409) and the writer from `@/db` (REQ-412), and the domain barrel exports Gate 0's `addWorkout`. Signatures are in §6. | WS-4 vs Gate 0 REQ-010 | AC-400, AC-408 |
| REQ-906 | Every stale copy block has exactly one owner: `TodayScreen.tsx:161-163` → **WS-4** (only DEC-B makes a true alternative exist); `TodayScreen.tsx:224-226` → **WS-2**; `RoutinesScreen.tsx:140` → **WS-2**; `ExercisesStep.tsx:109-112` and `:121-124` → **WS-2/WS-3**; `CalendarScreen.tsx:157` and `RoutineDetailScreen.tsx:55` → **WS-5**. WS-5 verifies the others rather than re-editing them. | Mutual deferral and double-claiming | AC-514 |
| REQ-907 | The DEC-Q1 collision is computed by a **pure, tested** function, not by ad-hoc logic in the form: `claimantsOfDay(workouts: readonly Workout[], day: Weekday): readonly Workout[]`, returning the claiming Workouts in `order`, in `src/domain/scheduling/index.ts`. It is DEC-Q1's only enforcement and must not be the one rule in the change with no automated coverage. | WS-4's own test gap; §11 | AC-405, AC-407 |
| REQ-908 | The blank seed is a **domain** factory, `blankRoutineFile(weeks)` (REQ-014), so the tests that assert over it stay domain tests and no feature constant is read from `domain/`. `state.ts` calls it with its own `weeks` default, keeping `MIN_WEEKS`/`MAX_WEEKS` where they already live. | Gate 0 vs WS-2 ownership; ESLint layering | AC-014, AC-203 |
| REQ-909 | `createUserExercise`'s `{ exercise, created }` result shape is declared **locally** in `exercises.ts`. `ResolvedExercise` is not relocated, and the exercises repository does not import `@/domain/routine-file`. One duplicated two-field interface is cheaper than moving a type three modules depend on. *(Non-behavioural — a structural decision, recorded here so it is not re-litigated.)* | WS-1 open question | — |
| REQ-910 | The residual §26 ceiling is stated and pinned: a user Exercise whose normalized name equals a catalog entry's is **unreachable** by any name-carrying path — the picker will not offer it and `resolveFileExercise` resolves past it. Such a row can only arrive through `restoreBackup` (audit R-6); REQ-101 refuses to mint one; **this change does not close it**. | `to-domain.ts:57-73`; audit R-6 | AC-313 |
| REQ-911 | **Draft offers are identified by resolved identity, not by name.** An imported file may legitimately declare `exercise_id: "front-squat"` under `name: "Sentadilla Frontal"` — `CONVERSION_PROMPT` documents that shape and instructs assistants to keep source spellings. Identifying such a draft row by name alone would offer it as a distinct movement, drop its slug (REQ-303 as first drafted), and mint a second Exercise for a movement already in the file — splitting history inside a single Routine, the exact failure §11 calls the change's core risk. REQ-301 therefore resolves each draft row before de-duplicating, and REQ-303 copies a source row's `exercise_id` onto a draft offer. | `to-domain.ts:61-65,75-83`; `catalog/index.ts:35-37`; `ConversionPromptButton.tsx` | AC-301, AC-303, AC-304 |
| REQ-912 | **The writer generates the Placements, inside the transaction.** REQ-404's preview is a second call to the same function over the same inputs, following the existing `previewPlacements` precedent. "The same call" is impossible: `generatePlacements` mints a `PlacementId` per Placement and requires a `Workout` row carrying an `id` the write has not yet created. Where the in-transaction read yields a different count than the preview, **the write wins and the confirmation reports it** — matching how `AcceptedSummary` is already built from `placements.length`. | `scheduling/index.ts:36-42,68`; `ScheduleStep.tsx:218-228`; `ImportWizard.tsx:169-173` | AC-404, AC-419 |
| REQ-913 | The synthetic file REQ-409 validates is built by an exported pure function in `src/domain/routine-file/`, not assembled inside the React form — otherwise TST-409 would be a domain test importing from `@/features`, which ESLint blocks at `error`. Seam: `plannedExerciseDraftFile(targets, workoutName): RoutineFile`. | ESLint layering; §9's no-component-tests rule | AC-410 |

## 4. Frozen Decisions

| ID | Approved Decision | Authority | Affects |
|---|---|---|---|
| DEC-A | Create user Exercises **and** add exercises into a Workout. | Owner, shaping | WS-1, WS-3 |
| DEC-B | Additive edits in place on an accepted Routine; invariant amended, not revoked. | Owner, shaping | WS-4, WS-5 |
| DEC-C | From-scratch authoring reuses the import wizard. | Owner, shaping | WS-2 |
| DEC-Q1 | The DEC-B add form validates only what it collects. `suggested_day_shared` is knowingly unenforced there. | Owner, post-audit | REQ-405, REQ-409, REQ-505, REQ-907 |
| DEC-Q2 | Placements are generated from today forward for the remaining weeks, anchored via `routine.createdAt`. | Owner, post-audit | REQ-402, REQ-403 |
| DEC-Q3 | The provenance line becomes `created {date}` for all Routines. | Owner, post-audit | REQ-211, REQ-514 |
| DEC-Q4 | The wizard picker is new code; `ExercisePicker.tsx` is untouched. | Owner, post-audit | WS-3, REQ-311 |
| DEC-Q5 | The empty-routine defect was fixed as a separate change. **Shipped.** | Owner, post-audit | REQ-002, REQ-203, REQ-504 |
| DEC-Q6 | A Workout's name **can** be corrected in a draft. Stored Workouts gain no rename. | Owner, post-drafting | REQ-012 |
| DEC-Q7 | The create form **refuses** a colliding name and points at the existing Exercise. Scoped to the create screen; the picker reuses on purpose (REQ-306). | Owner, post-drafting | REQ-101, REQ-306 |
| DEC-Q8 | An abandoned draft warns before it is lost. Persisting the draft was rejected because it breaks ASM-1. | Owner, post-drafting | REQ-903 |

## 5. Expected Change Areas

| Area / File | Expected Change | Owner | Confidence |
|---|---|---|---|
| `src/domain/routine-file/edit.ts` | `addWorkout`, `addExercise`, `setRoutineName`, `setWorkoutName`; header amended. | Gate 0 (+WS-5 comment) | High |
| `src/domain/routine-file/validate.ts` | `routine_name_blank` and its check. Nothing else. | Gate 0 | High |
| `src/domain/routine-file/index.ts` | Barrel exports incl. the offer module; header prose amended. | Gate 0 | High |
| `src/domain/routine-file/blank.ts` *(or in `edit.ts`)* | `blankRoutineFile(weeks)`. | Gate 0 | High |
| `src/features/import/issues.ts` | `FIX` + `problemOf` for `routine_name_blank` (Gate 0); `FIX.routine_has_no_workouts` reworded (WS-2). | Gate 0, WS-2 | High |
| `src/domain/routine-file/offer.ts` (new) | `Offer`, `offeredExercises`, `resolveTypedName`, `draftExercise`. | WS-3 | High |
| `src/domain/routine-file/` — draft-file helper | `plannedExerciseDraftFile` (REQ-913). | WS-4 | High |
| `src/domain/catalog/index.ts` | `findExerciseByName`; category/equipment vocabularies for REQ-105. | WS-1 | High |
| `src/domain/routine-file/to-domain.ts` | `resolveFileExercise` re-expressed on `findExerciseByName`. Resolution order unchanged. | WS-1 | High |
| `src/domain/scheduling/index.ts` | `remainingWeeks` (REQ-402) **and** `claimantsOfDay` (REQ-907). | WS-4 | High |
| `src/db/repositories/exercises.ts` | `createUserExercise` + its refusal error. | WS-1 | High |
| `src/db/repositories/workouts.ts` | `addWorkoutToRoutine`; header amended. | WS-4 | High |
| `src/db/repositories/plannedExercises.ts` | `addPlannedExercise`; header amended. | WS-4 | High |
| `src/db/repositories/placements.ts` | Header amendment only. Placements are written by `addWorkoutToRoutine`'s transaction, not by an exported `addPlacement`: they are meaningless without the Workout, so one transaction in one module beats a second writer that could be called alone. | WS-4 | High |
| `src/db/repositories/routines.ts`, `exerciseSessions.ts` | Header comments (REQ-512). | WS-5 | High |
| `src/db/index.ts` | Append-only re-exports. **Shared — append only.** | all | High |
| `src/domain/types.ts` | `Routine` and `Workout` doc comments (REQ-506, REQ-512). No type change. | WS-5 | High |
| `src/domain/session/index.ts` | One comment (REQ-512). | WS-5 | High |
| `src/features/session/ExerciseReorder.tsx` | One comment (REQ-512). **Note:** a `src/features/session/` file is edited here; the freeze in this table covers `ExercisePicker.tsx` only, not the folder. | WS-5 | High |
| `src/features/import/state.ts` | `fileName` leaves `editing`; the seed default lives here. | WS-2 | High |
| `src/features/import/ImportWizard.tsx` | From-scratch entry; add handlers; both abandon guards. **Shared by WS-2 and WS-3.** | WS-2 → WS-3 | High |
| `src/features/import/ExercisesStep.tsx` | Editable routine and Workout names; add affordances; three copy blocks. **Shared by WS-2 and WS-3.** | WS-2 → WS-3 | High |
| `src/features/import/AddExercise.tsx` (new) | The wizard-local picker. Deliberately not named `ExercisePicker`. | WS-3 | High |
| `src/features/import/{FileStep,ScheduleStep,ActionBar}.tsx` | Entry point and copy. | WS-2 | High |
| `src/features/import/ConversionPromptButton.tsx` | Prompt rules brought current (REQ-515). | WS-5 | High |
| `src/features/exercises/ExerciseCatalogScreen.tsx` | Create affordance and form. | WS-1 | High |
| `src/features/routines/RoutineDetailScreen.tsx` | Two add affordances, active Routine only; header and copy. | WS-4 | High |
| `src/features/routines/RoutinesScreen.tsx` | Third entry point; `imported` → `created`; header. | WS-2 (+WS-5 verify) | High |
| `src/features/today/TodayScreen.tsx` | `:161-163` (WS-4) and `:224-226` (WS-2). No logic change. | WS-4, WS-2 | High |
| `src/features/calendar/CalendarScreen.tsx` | One copy block. | WS-5 | High |
| `AGENTS.MD`, `CONTEXT.md`, `PRODUCT.md`, `docs/PRD.md` | Invariant, §39 table, §11.1, new CONTEXT entry, semantic enumerations. | WS-5 | High |
| `src/features/data/queries.ts` | Probably untouched — writes do not route through `useLiveQuery` hooks. | — | Medium |

**Must not change:** `src/db/schema.ts`, `src/domain/backup/document.ts`,
`src/domain/catalog/data.ts`, `src/domain/routine-file/schema.ts` (stop
condition 6), `src/features/session/ExercisePicker.tsx`, `package.json`,
`pnpm-lock.yaml`.

## 6. Contracts

### Changed

```ts
// @/domain/routine-file — Gate 0
addWorkout(file: RoutineFile, name: string): RoutineFile
addExercise(file: RoutineFile, workoutIndex: number, exercise: RoutineFileExercise): RoutineFile
setRoutineName(file: RoutineFile, name: string): RoutineFile
setWorkoutName(file: RoutineFile, workoutIndex: number, name: string): RoutineFile
blankRoutineFile(weeks: number): RoutineFile

// @/domain/routine-file/offer — WS-3
type Offer =
  | { kind: 'catalog';   exercise: Exercise }              // writes name + exercise_id
  | { kind: 'user';      exercise: Exercise }              // writes name only
  | { kind: 'draft';     name: string; exerciseId?: string } // writes name + slug when present
  | { kind: 'new';       name: string }                    // writes name only
offeredExercises(file: RoutineFile, userExercises: readonly Exercise[]): readonly Offer[]
resolveTypedName(name: string, offers: readonly Offer[]): Offer
draftExercise(offer: Offer): RoutineFileExercise
plannedExerciseDraftFile(targets, workoutName: string): RoutineFile   // REQ-913

// @/domain/catalog — WS-1
findExerciseByName(name: string, userExercises: readonly Exercise[]): Exercise | undefined

// @/domain/scheduling — WS-4
remainingWeeks(weeks: number, anchorDate: LocalDate, today: LocalDate): number
claimantsOfDay(workouts: readonly Workout[], day: Weekday): readonly Workout[]

// @/db — WS-1, WS-4.  `today` is a parameter everywhere: every clock read in
// this codebase happens in the feature layer.
createUserExercise(input: { name: string; category: string | null; equipment: string | null })
  : Promise<{ exercise: Exercise; created: boolean }>
addWorkoutToRoutine(routineId: RoutineId, input: { name: string; suggestedDays: readonly Weekday[]; today: LocalDate })
  : Promise<{ workoutId: WorkoutId; placementCount: number }>
addPlannedExercise(workoutId: WorkoutId, input: Omit<PlannedExercise, 'id' | 'workoutId' | 'order'>)
  : Promise<PlannedExerciseId>
```

- `SemanticIssueCode` — one new member, `routine_name_blank` (REQ-901).
- `WizardState.editing` — loses `fileName` (REQ-202).
- `@/domain/routine-file` and `@/db` barrels — **append-only**.
  `@/domain/catalog` is the WS-1 → WS-3 handoff that stop condition 3 guards.
- `resolveFileExercise` — internals re-expressed; **observable resolution order
  unchanged**, with its existing tests as the regression gate.

### Preserved

- Every stored type: `Placement`, `Routine`, `Workout`, `PlannedExercise`,
  `Exercise`, `Session`, `ExerciseSession`, `CompletedSet`.
- `SCHEMA_V1`, `SCHEMA_VERSION = 2`, `BACKUP_VERSION = 1`.
- `exercise_id` resolves against the bundled catalog only (REQ-312).
- Catalog Exercises are never written to the `exercises` table (PRD DEC-007).
- History and progression never read a template row (audit R-1) — REQ-413.
- `ExercisePicker`'s three props and its refusal to create (REQ-311).

## 7. Security, Tenant, Permission, Compatibility

None beyond existing behavior. Single local user, no network at runtime, no
auth. A backup taken before this change restores unchanged; a backup taken after
restores with the added rows (REQ-417, TST-419). No new row shape and no new
table means `parseBackup`'s schema is unaffected.

## 8. Migration, Rollout, Recovery

**No migration.** ASM-1 is load-bearing. If any requirement is found to need a
table, an index, or a version bump, that is stop condition 8, not a requirement.

**Two rollout windows**, both closed by ordering rather than by extra work:

- Between WS-2 and WS-5, the Routines list would call an authored Routine
  "imported". REQ-906 gives WS-2 that one-word edit to close it.
- `routine_name_blank` (Gate 0) refuses an unnamed file the moment it lands, but
  the field to fix it arrives with WS-2 REQ-204. Either the change ships as one
  branch, or REQ-204 moves into Gate 0's landing.

## 9. Test Requirements

No React component can be tested: Vitest runs `environment: 'node'` with no
jsdom, happy-dom or `@testing-library`. Every test below is **domain** or
**repository**; repository tests use `fake-indexeddb`. UI is verified by running
the app (§10, §12).

| Test ID | Required Check | Covers | Layer |
|---|---|---|---|
| TST-001 | `addWorkout` appends as asked, with empty days and exercises, reusing existing Workout objects by reference. | REQ-001, REQ-006 | domain |
| TST-002 | `addWorkout` raises no issue, and adding the first Workout turns `['routine_has_no_workouts']` into `[]`. | REQ-002 | domain |
| TST-003 | `addExercise` appends the given row verbatim under the named Workout and leaves others untouched. | REQ-003 | domain |
| TST-006 | `order` mapping after adds; pre-existing orders unchanged. | REQ-006 | domain |
| TST-007 | Purity and totality of every new verb; an out-of-range index returns the same file reference. | REQ-007 | domain |
| TST-008 | `setRoutineName` replaces the name, keeps `workouts` referentially identical, does not mutate input. | REQ-008 | domain |
| TST-009 | An added exercise is judged by the existing rules: setting its sets to 0 yields one `sets_not_positive` at that row's path. | REQ-011 | domain |
| TST-010 | Delete-then-add round trip inside one Workout. | REQ-009, REQ-511 | domain |
| TST-012 | `setWorkoutName` replaces one Workout's name, leaves its exercises and days untouched, does not mutate input. | REQ-012 | domain |
| TST-013 | `routine_name_blank` fires for empty and whitespace-only, not for a real name, and carries the path `routine.name`. | REQ-013, REQ-205 | domain |
| TST-014 | `blankRoutineFile(4)` returns `version: 1`, empty name, `weeks: 4`, no Workouts, and `validateRoutineFile` over it returns **exactly** `routine_name_blank` and `routine_has_no_workouts`. | REQ-014, REQ-203 | domain |
| TST-015 | Naming the blank seed and adding one Workout leaves `validateRoutineFile` reporting nothing — from-scratch really does unblock Accept. | REQ-203, REQ-210 | domain |
| TST-100 | `findExerciseByName` resolves catalog first, user second, `undefined` on a miss — four cases including a normalized hit. | REQ-102 | domain |
| TST-101 | `resolveFileExercise`'s existing cases still pass with it re-expressed on `findExerciseByName`. **The regression gate for REQ-902.** | REQ-102 | domain |
| TST-102 | `createUserExercise` writes one row, `created === true`, name trimmed and cased as typed; a case/whitespace variant returns the incumbent. | REQ-100, REQ-106 | repository |
| TST-103 | `createUserExercise('front squat')` returns `created === false` with the catalog slug, and the table is unchanged. | REQ-107 | repository |
| TST-104 | Two overlapping `createUserExercise` calls produce exactly one row sharing one id. | REQ-104 | repository |
| TST-105 | An Exercise created on the screen is reused, not duplicated, by a later import naming it in different casing. | REQ-103 | repository |
| TST-106 | Blank and whitespace-only names throw the named error; nothing is written. | REQ-106 | repository |
| TST-107 | `category`/`equipment` round-trip, including `null` for either or both. | REQ-105 | repository |
| TST-108 | A precomposed accented name and its combining-mark spelling do **not** match. The accepted §26 gap, pinned deliberately. | REQ-109 | domain |
| TST-207 | `importRoutine(draft, [])` writes the Routine, Workouts and PlannedExercises, archives the previously active one, leaves `placements` empty. | REQ-210 | repository |
| TST-300 | `offeredExercises` de-duplicates by **resolved identity** and keeps catalog-first order — and fails if it does not route through `findExerciseByName`. | REQ-301, REQ-902 | domain |
| TST-301 | Names existing only in the draft surface as `draft` offers, from every Workout of the file. | REQ-302 | domain |
| TST-302 | `draftExercise` writes `exercise_id` for a catalog offer, **preserves it for a draft offer whose source row declares one**, and asserts its absence for `user` and `new` offers. | REQ-303, REQ-911 | domain |
| TST-303 | Composition: a persisted-user offer yields no `createdExercises` and the stored `exerciseId`. | REQ-304 | domain |
| TST-304 | Composition: the same draft-only offer in two Workouts mints exactly one Exercise. | REQ-302, REQ-304 | domain |
| TST-308 | **Composition, the REQ-911 case:** a two-Workout file where Workout A's row carries `exercise_id: 'front-squat'` under a non-catalog name, and Workout B picks that draft offer, yields **zero** `createdExercises` and one shared `exerciseId`. | REQ-911, REQ-304 | domain |
| TST-305 | `resolveTypedName` matches through `normalizeExerciseName` only. | REQ-306 | domain |
| TST-306 | For every offer kind, adding it leaves the issue list equal to the baseline. | REQ-307 | domain |
| TST-307 | Characterization of the R-3 trap: a UUID in `exercise_id` is ignored and re-matched by name. | REQ-312 | domain |
| TST-309 | A user Exercise whose normalized name equals a catalog entry's is not offered, and `resolveFileExercise` resolves past it to the catalog entry. **Pins REQ-910's stated ceiling.** | REQ-910 | domain |
| TST-400 | `remainingWeeks(8, '2026-09-07', '2026-09-30')` returns **5** — Monday-aligned: three whole weeks elapsed. | REQ-402 | domain |
| TST-401 | `remainingWeeks(4, '2026-09-07', '2026-10-20')` returns 0; no input returns a negative number. | REQ-402, REQ-403 | domain |
| TST-402 | `remainingWeeks` returns the full count inside the anchor's own week and before it — including the rolling-vs-Monday divergence case: anchor Wed `2026-08-05`, `weeks: 4`, today Mon `2026-08-10` returns **3**, not 4. | REQ-402 | domain |
| TST-403 | `remainingWeeks(0, …)` is 0, and a negative `weeks` is 0 — `routine.weeks` carries no bound. | REQ-402 | domain |
| TST-404 | Composition: `generatePlacements` with `remainingWeeks` over a stated anchor/today/weeks triple emits an exact **count**, an exact **first** date and an exact **last** date, none before today. | REQ-402, REQ-404 | domain |
| TST-405 | `generatePlacements` with `weeks: 0` returns none for any anchor. | REQ-403 | domain |
| TST-406 | `generatePlacements` for a Workout with no suggested days returns none, for any week count. | REQ-403, REQ-210 | domain |
| TST-407 | Two Workouts both listing monday emit two Placements on that Monday, one each. | REQ-406 | domain |
| TST-408 | `nextWorkoutInRotation` reaches a Workout appended at the highest `order`. | REQ-401 | domain |
| TST-409 | `validateRoutineFile` over `plannedExerciseDraftFile(...)` returns exactly the target issues — and never `routine_name_blank` or `suggested_day_shared`. | REQ-409, REQ-913 | domain |
| TST-420 | `claimantsOfDay` names the claiming Workouts for a taken day, in `order`, and returns empty for a free one. **DEC-Q1's only automated coverage.** | REQ-405, REQ-907 | domain |
| TST-421 | **The REQ-406 consequence:** two Workouts placed on one date, with one Session for one of them, yields exactly one `isMissed` Placement — so the warning copy has a test behind it. | REQ-406 | domain |
| TST-410 | `addWorkoutToRoutine` on a mid-routine Routine writes one Workout and the expected Placements, all dated today or later. | REQ-402 | repository |
| TST-411 | On an exhausted Routine it writes the Workout and zero Placements. | REQ-403 | repository |
| TST-412 | With one active and one archived Routine, the add leaves both Routine rows and both statuses untouched. | REQ-400 | repository |
| TST-413 | A blank-after-trim name, an unknown `routineId`, and a **non-active** Routine each throw and write nothing. | REQ-411, REQ-414 | repository |
| TST-414 | `order` is one past the highest; `listWorkoutsByRoutine` returns it last. | REQ-401 | repository |
| TST-415 | `addPlannedExercise` stores at the last `order`, returned last. | REQ-408 | repository |
| TST-416 | An unknown `workoutId` throws and writes nothing. | REQ-411 | repository |
| TST-417 | With a completed Session and its snapshots stored against a Workout, adding a Planned Exercise leaves every Session, ExerciseSession and CompletedSet **byte-identical**. **The DEC-B safety test.** | REQ-413 | repository |
| TST-418 | `createStartedWorkout` for an added Workout with no Planned Exercises writes one Session and zero ExerciseSessions. | REQ-416 | repository |
| TST-419 | Export → reset → restore round-trips the added Workout, its Placements and the added Planned Exercise. **Demonstrates ASM-1.** | REQ-417 | repository |
| TST-500 | `deleteExercise` on a Workout holding one exercise still empties it. | REQ-511 | domain |
| TST-501 | `validateRoutineFile` on a Workout with zero exercises returns no issues. | REQ-511 | domain |
| TST-515 | `CONVERSION_PROMPT`'s Rules section names the zero-Workout rule and the blank-name rule. Stop condition 7 presumes this test exists. | REQ-515 | domain |

## 10. Acceptance Criteria

Each AC id denotes the behavior its requirement states in §3, observed by the
method named here. Where a group's condition adds nothing to the requirement
text, the requirement text **is** the pass/fail condition and is written to be
read that way.

`running the app` is a first-class method, not a weaker one — it is the only one
available for a screen, and §12 requires what was observed to be recorded rather
than asserted from reading code.

| Acceptance | Observable Condition | Covers | Verified by |
|---|---|---|---|
| AC-001…AC-003, AC-005…AC-014 | The draft verbs, the blank seed and `routine_name_blank` behave as §3.1 states, over fixture files. | Gate 0 | test |
| AC-004 | `draftExercise`'s seeded shape, pinned whole. **Deferred to WS-3**, which owns the function; it is not satisfiable at Gate 0's landing. | REQ-900 | test (TST-302) |
| AC-100…AC-110 | Creation, refusal, resolution and round-trip behave as §3.2 states. | WS-1 | test |
| AC-111 | The Exercises screen's header and empty state no longer claim nothing is created there. | REQ-110 | running the app |
| AC-200…AC-202 | "Start from scratch" reaches step 1 with an empty draft from **all three** named surfaces and from `/import?new=1`; `restart` returns to the file step. | WS-2 | running the app |
| AC-203, AC-205 | A blank draft reports exactly two problems and Accept is disabled until both are answered. | REQ-203, REQ-205 | test + running the app |
| AC-204, AC-206…AC-209 | Names are editable, a Workout can be added and becomes visible, and no wizard copy claims a file. | WS-2 | running the app |
| AC-210 | A from-scratch Routine accepts, stores, activates, and Today falls back to next-in-rotation when nothing was placed. | REQ-210 | test + running the app |
| AC-211, AC-212 | The routines list says "created"; both entry surfaces state both ways in. | REQ-211, REQ-212 | running the app |
| AC-301…AC-306, AC-312, AC-313 | Offers, identity writing, identity survival and the stated ceiling behave as §3.4 and REQ-910/REQ-911 state. | WS-3 | test |
| AC-300, AC-307…AC-311 | An added exercise never blocks Accept; the picker never covers the ActionBar; gym mode is unchanged. | WS-3 | running the app |
| AC-400…AC-404, AC-419 | A Workout is added to the active Routine, appears last, and the preview matches what is written — or, where it cannot, the confirmation reports what was written. | WS-4 | test + running the app |
| AC-405…AC-407, AC-420 | A collision warns beside the day, naming the claiming Workout **and both consequences of REQ-406**, without disabling save. | REQ-405, REQ-406 | test + running the app |
| AC-408…AC-413 | A Planned Exercise is added with validated targets, at the last order, in one transaction, creating no Exercise, and every writer refusal stores nothing. | WS-4 | test + running the app |
| AC-414a | Adding a Planned Exercise leaves every stored Session, ExerciseSession and CompletedSet byte-identical. | REQ-413 | test (TST-417) |
| AC-414b | A Session recorded before an add renders the targets it recorded, not the added ones. | REQ-413 | running the app |
| AC-415…AC-418 | Archived Routines stay read-only; no destructive verb appears; an empty added Workout is trainable; a backup round-trips. | WS-4 | test + running the app |
| AC-421 | Leaving the wizard mid-draft by **reload** and by **browser/hardware back** each warn before the draft is lost; the in-app back still shows the existing Discard confirmation. All three observations recorded. | REQ-903 | running the app |
| AC-500…AC-515 | Every document, comment and copy block named in §3.6 states the amended rule, and no enumeration is stale. | WS-5 | static check |
| AC-516, AC-517 | `CONVERSION_PROMPT` names both new rules, and its existing test still passes. | REQ-515 | test + static check |

## 11. Traceability

Requirement → Acceptance → Test is carried inline: §3 gives each requirement its
AC ids, §9 gives each test its covered requirements, §10 groups the ACs. Four
requirements carry the change's core risk and are called out so no plan drops
them silently:

| Requirement | Why it is load-bearing | Test |
|---|---|---|
| REQ-413 | The only thing making DEC-B safe. If a history path ever reads a template row, the amendment is wrong. | TST-417 |
| REQ-102 / REQ-902 | One §26 matcher. Two would drift, and drift splits a lifter's history in two. | TST-101, TST-300 |
| REQ-303 / REQ-911 | A draft row carrying a slug under a foreign name would otherwise split one movement into two Exercises **inside a single Routine**. | TST-302, TST-308 |
| REQ-405 / REQ-406 / REQ-907 | DEC-Q1's entire replacement enforcement, and the change's only new recurring failure mode. | TST-420, TST-421 |

## 12. Quality Obligations

- **Gates, every workstream:** `pnpm typecheck`, `pnpm test`, `pnpm lint`,
  `pnpm build` — all four green before a workstream is called done. Gate 0
  included: REQ-013 exists so it can meet them alone.
- **Regression floor:** 458 tests at baseline. No workstream may reduce it or
  skip a test to land.
- **Contract check:** `SemanticIssueCode`'s consumers are found by the compiler,
  never by grep. If a change to it does not break `tsc`, the exhaustiveness has
  been weakened and that is a defect.
- **Mutation:** Stryker's `mutate` list **does** cover
  `src/domain/scheduling/index.ts`, where `remainingWeeks` and `claimantsOfDay`
  land — but no npm script runs Stryker, so it is not a gate for this change and
  must not be assumed to be one. It covers neither `routine-file/**` nor
  `catalog/**`. Extending it is out of scope.
- **Layering:** ESLint blocks `domain/**` from importing react, dexie, `@/db`
  and `@/features` at `error`. Note it restricts by path pattern, so a bare
  barrel import is a review obligation rather than a caught error.
- **UI verification:** by running the app. Every AC marked `running the app` is a
  real obligation and must be recorded in `execution.md` with **what was
  observed** — not asserted from reading code. AC-414b and AC-421 especially.

## 13. Explicit Assumptions

| Assumption | Provenance | Stop If False |
|---|---|---|
| ASM-1 — no new table, index, `SCHEMA_VERSION` or `BACKUP_VERSION`. | Audit; confirmed by two verifiers across five attack fronts. | **Stop.** A migration makes this a different, higher-risk change. |
| ASM-2 — the Placement anchor is recoverable as `formatLocalDate(new Date(routine.createdAt))`. | `ImportWizard.tsx:149` (`createdAt`) and `:154` (`anchorDate`) are the same clock read. Caveat: the two straddle midnight in principle. | DEC-Q2 needs a new stored field, breaking ASM-1. |
| ASM-3 — a Workout with zero PlannedExercises is already supported end to end. | `sessions.ts:71-73`; `SessionScreen.tsx:353-358`. | REQ-416 fails; WS-4 cannot ship in two parts. |
| ASM-4 — no new runtime dependency. | Every control exists in `src/components/ui/`. | Stop — a dependency needs its own approval. |

**Drafter decisions, not owner decisions.** Flagged so review can overturn them
cheaply; none blocks planning:

- REQ-414 — add affordances on the **active** Routine only.
- REQ-203 — the `weeks: 4` default for a blank draft.
- REQ-105 — category and equipment are a **closed** vocabulary, no free text.
- REQ-205 — a blank name now refuses a file that was previously acceptable.
  This is a new refusal on the **existing import path**, not only on the new one.

## 14. Implementation Stop Conditions

Stop and escalate rather than inventing behavior if:

1. **Gate 0 is about to land with a name-only `addExercise`.** WS-3 could not
   then express a catalog pick without a second verb, and Gate 0 lands alone and
   first (REQ-900).
2. **Gate 0 is about to land without the `issues.ts` entries.** It cannot
   typecheck green alone, and it would silently edit a file another workstream
   owns (REQ-013).
3. **WS-3 begins before WS-1's matcher extraction has landed.** It would build
   against the pre-extraction shape and ship three §26 deciders (REQ-902).
4. **WS-2 and WS-3 are scheduled in parallel.** They share `ExercisesStep.tsx`
   *and* `ImportWizard.tsx`.
5. **A repository writer is about to be named `addWorkout`.** It collides with
   the domain verb in `RoutineDetailScreen.tsx`, which imports both barrels by
   design (REQ-905).
6. **Anyone proposes `.min(1)` on `routine.name` or `workout.name` in
   `src/domain/routine-file/schema.ts`.** It rejects the blank seed structurally
   and makes DEC-C impossible. The rule belongs in the semantic tier.
7. **`ConversionPromptButton.test.ts` goes red.** The prompt's example no longer
   validates. Fix the prompt — never the test, and never by weakening a check.
8. **Any requirement turns out to need a schema, index or version change.**
   That breaks ASM-1.
9. **Any requirement would need a destructive verb on a stored row** — a rename,
   a delete, a reorder, or an edit of a stored target. That is excluded scope.
   The draft verbs of §3.1 are not this; see the boundary note in §2.
10. **Unrelated user changes overlap the write set.** `docs/PRD-DMS.md` is
    untracked, unrelated work and must never be read, moved, edited or staged.

## 15. Planning Notes

`plan.md` is required. It must settle:

- **Execution topology.** True dependencies: Gate 0 → WS-1 → WS-3, and
  Gate 0 → WS-2 → WS-3. WS-4 depends only on Gate 0 by contract, but shares
  `src/db/index.ts` and `src/domain/scheduling/index.test.ts` under an
  append-only convention. WS-5 lands last. Default to sequential where write
  sets are not provably disjoint.
- **Whether the change ships as one branch or five** — §8's two rollout windows
  are the deciding constraint.
- **Ownership of the shared files:** `ExercisesStep.tsx`, `ImportWizard.tsx`,
  `src/db/index.ts`, `src/features/import/issues.ts`,
  `src/domain/scheduling/index.ts`.
