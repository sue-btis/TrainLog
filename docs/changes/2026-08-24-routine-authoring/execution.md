# Routine Authoring — Execution

## Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Branch | `change/routine-authoring` |
| Planned base | `master@49efc78` + the landed quick change |
| Current start commit | `e6f3165` (change record) — on `40e0c02` (quick change) — on `49efc78` |
| Working tree before edits | Clean, except untracked `docs/PRD-DMS.md` |
| Pre-existing relevant changes | None. The quick change was committed to `change/empty-routine-accept` at `40e0c02` before any wave began. |

## Preflight Verdict

**Safe sequentially only.**

The tree was dirty at preflight, but every item was accounted for: the quick
change's three `src/` files, this change's four documents, and one unrelated
file. Plan §1's two required actions were performed before the first edit —
the quick change was committed on its own branch by explicit pathspec, and
`docs/PRD-DMS.md` was unstaged and left untracked. It has not been read, moved,
edited or staged since (stop condition 10).

All 34 existing paths named by spec §5 were verified present, and all 4 new
paths verified absent, before editing.

## Execution Topology

**Sequential.** One writer, one branch, per plan §4. No subagents were used to
write code; none were simulated. Waves A–E in order.

## Executed Work

| Wave / WS | REQ IDs | Status | Files Changed | Checks | Evidence |
|---|---|---|---|---|---|
| A / WS-1 | REQ-100…110, 902, 909 | **Completed** | 7 | typecheck, test, lint, build — all green | 471 tests (458 → +13); UI observed, below |
| B / Gate 0 + WS-2 | REQ-001…014, 200…212, 900, 901, 903, 906, 908 | **Completed** | 12 | all four green | **490** tests (471 → +19); UI observed, below |
| C / WS-3 | REQ-300…312, 900, 902, 910, 911 | **Completed** | 6 | all four green | 19 new domain tests; UI observed, below |
| D / WS-4 | REQ-400…417, 905, 907, 912, 913 | **Completed** | 12 | all four green | 34 new domain + repository tests; UI observed, below |
| E / WS-5 | REQ-500…516, 901, 904, 906 | **Completed** | 15 | all four green | **543** tests; grep sweep for the invariant |

## Wave A — "I can create an exercise the app does not ship with."

### Files changed

| Path | Change |
|---|---|
| `src/domain/catalog/index.ts` | `findExerciseByName`, `CATALOG_CATEGORIES`, `CATALOG_EQUIPMENT` |
| `src/domain/routine-file/to-domain.ts` | `resolveFileExercise` re-expressed on the shared matcher |
| `src/db/repositories/exercises.ts` | `createUserExercise`, `ExerciseNameRequiredError`, `CreatedExercise` |
| `src/db/index.ts` | append-only re-export (exercises block) |
| `src/features/exercises/ExerciseCatalogScreen.tsx` | create affordance, header contract, empty-state copy |
| `src/domain/catalog/index.test.ts` | TST-100, TST-108 |
| `src/db/repositories/exercises.test.ts` | TST-102…107 |

No file outside WS-1's May-Edit column changed. Verified against the actual diff.

### The regression gate ran first, and it mattered

REQ-902's whole point is that one matcher replaces two. The refactor was landed
against the **existing** `resolveFileExercise` tests before anything else
changed: `to-domain.test.ts` + `catalog/index.test.ts`, 39 tests, green with the
extraction in place and no test modified. That is TST-101 — a no-edit gate, and
the only evidence that the observable resolution order survived.

### Requirement status

| Requirement | Implementation | Acceptance evidence | Status |
|---|---|---|---|
| REQ-100 | create affordance + live query | AC-100 — observed: created "Zercher Good Morning", found by search with no reload | Completed |
| REQ-101 | resolve-then-report | AC-101/102 — observed: "Front Squat already exists, so nothing was created." with a link to it | Completed |
| REQ-102, 902 | `findExerciseByName` in `@/domain/catalog`; `resolveFileExercise` re-expressed on it | AC-103 — TST-100, TST-101 | Completed |
| REQ-103 | shared matcher | AC-104 — TST-105 | Completed |
| REQ-104 | decision + write in one transaction | AC-105 — TST-104: two racing creates, one row, one `created: true` | Completed |
| REQ-105 | closed vocabularies from `CATALOG` only | AC-106 — TST-107 (round-trip) **and** TST-105, added in the fourth pass: TST-107 never asserted the "from `CATALOG` only" clause | Completed |
| REQ-106 | trim, then `ExerciseNameRequiredError` | AC-107 — TST-102, TST-106 | Completed |
| REQ-107 | catalog hit returns the slug, writes nothing | AC-108 — TST-103, **and** the running app: after typing a catalog name the `exercises` table still held exactly one row | Completed |
| REQ-108 | no update or delete verb exists | AC-109 — static: the repository exports one writer | Completed |
| REQ-109 | not closed, pinned | AC-110 — TST-108 | Completed |
| REQ-110 | header + empty-state rewritten | AC-111 — observed | Completed |
| REQ-909 | `CreatedExercise` declared locally | — (structural) | Completed |

### What was observed, and how

§12 requires the "running the app" ACs to record what was observed. The dev
server ran on port 5235 (`trainlog-verify-3`), at mobile viewport.

- The Exercises screen renders a **New exercise** control; opening it shows
  name, category and equipment with Create and Cancel.
- **Create is disabled while the name is blank** and enables once a name is
  typed — observed as a state transition, not inferred.
- Creating "Zercher Good Morning" reported *"Zercher Good Morning is yours
  now."*, closed the form, and the movement was findable by searching
  "zercher" **with no reload**, under the "other" band since it carries no
  category.
- Typing `"  front   SQUAT "` — deliberately mis-cased and mis-spaced — reported
  *"Front Squat already exists, so nothing was created."* and offered
  `/exercises/front-squat`, the permanent catalog slug.
- Reading IndexedDB directly afterwards: the `exercises` table held **exactly
  one row**, the created movement with a UUID. The catalog name wrote nothing.

**Method, stated plainly.** Clicks through the `computer` tool timed out — the
Browser pane is hidden in this session — so the interactions were driven by
dispatching real events at the page (`element.click()`, native value setter plus
an `input` event), which run the component's actual React handlers. Rendering,
copy and the IndexedDB state were read directly. This exercises the real
component and the real repository; it is not a trusted user gesture, and it is
recorded as what it is rather than as a click.

### Checks

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass — 29 files, **471** tests (baseline 458, +13) |
| `pnpm lint` | Pass |
| `pnpm build` | Pass |

## Wave B — "I can build a routine without a file." (Gate 0 + WS-2)

Landed as one wave, per plan §6: splitting it would ship §8's second rollout
window as a live defect — `routine_name_blank` blocks Accept the moment Gate 0
lands, and the field that fixes it arrives with WS-2.

### Files changed

| Path | Change |
|---|---|
| `src/domain/routine-file/edit.ts` | `addWorkout`, `addExercise`, `setRoutineName`, `setWorkoutName`, `blankRoutineFile`; header amended |
| `src/domain/routine-file/validate.ts` | `routine_name_blank`; the J-2 message conditional |
| `src/domain/routine-file/index.ts` | barrel exports; header prose amended |
| `src/features/import/issues.ts` | `FIX` + `problemOf` for the new code; `routine_has_no_workouts` reworded |
| `src/features/import/state.ts` | `fileName` out of `editing`; `DEFAULT_WEEKS` |
| `src/features/import/fields.tsx` | `TextField` (J-7) |
| `src/features/import/ImportWizard.tsx` | from-scratch entry, `?new=1`, three handlers, both abandon guards |
| `src/features/import/ExercisesStep.tsx` | editable names, `AddWorkout`, three copy blocks |
| `src/features/import/FileStep.tsx` | "Start from scratch"; well copy |
| `src/features/import/ScheduleStep.tsx` | opening line |
| `src/features/today/TodayScreen.tsx` | second entry point + copy (`:224-230`) |
| `src/features/routines/RoutinesScreen.tsx` | third entry point; `imported` → `created`; empty-state copy |
| `src/domain/routine-file/edit.test.ts`, `src/db/repositories/import.test.ts` | TST-001…015, TST-207 |

`TodayScreen.tsx:161-163` was **not** touched — it belongs to WS-4 (REQ-906).

### D-004 held, and the compiler proved it

Adding `routine_name_blank` to `SemanticIssueCode` broke `tsc` in exactly two
places — `FIX`'s total `Record` and `problemOf`'s `default`-less switch — and
nowhere else. That is the contract check §12 asks for: the consumer set was
found by the compiler, not by grep, and Gate 0 shipping `validate.ts` without
`issues.ts` would not have typechecked.

### `state.fileName` turned out to be dead

REQ-202 removes `fileName` from the `editing` phase. Grepping first showed the
`editing` copy was read by nothing — only the `choosing` phase's own `fileName`
is rendered, and that stays. So the requirement was a dead-field removal rather
than a refactor, and the compiler caught the single stale dispatch.

### Requirement status

| Requirement | Implementation | Acceptance evidence | Status |
|---|---|---|---|
| REQ-001…003, 005…009, 012, 014 | the five draft verbs | AC-001…014 — TST-001…015 | Completed |
| REQ-004, 900 | seed deferred to WS-3's `draftExercise`; `addExercise` takes a whole row | AC-004 **deferred to Wave C**, as plan §8 records | Deferred |
| REQ-010 | barrel + two headers | AC-010 — static | Completed |
| REQ-011, 013, 901 | `routine_name_blank` across all three files | AC-013 — TST-013; AC-011 — TST-009, **added in the fourth pass** (TST-013 was miscredited to it) | Completed |
| REQ-200 | three entry surfaces | AC-200 — observed on all three | Completed |
| REQ-201 | `?new=1`, consumed once on mount | AC-201 — observed | Completed |
| REQ-202 | `fileName` gone from `editing` | AC-202 — typecheck | Completed |
| REQ-203, 908 | `blankRoutineFile(DEFAULT_WEEKS)` | AC-203 — TST-014 **and** observed: opens on exactly two problems | Completed |
| REQ-204 | routine name is a `TextField` | AC-204 — observed | Completed |
| REQ-205 | blocked until named | AC-205 — observed: 2 problems → 1 on naming | Completed |
| REQ-206 | `AddWorkout`; new Workout becomes active | AC-206 — observed | Completed |
| REQ-207 | Add disabled while blank | AC-207 — observed as a state transition | Completed |
| REQ-208 | both wells reworded | AC-208 — observed | Completed |
| REQ-209 | titles, chip, primary button, step 2 line | AC-209 — observed **after a correction, below** | Completed |
| REQ-210 | same `importRoutine` path | AC-210 — TST-207 **and** observed end to end | Completed |
| REQ-211, 906 | `created {date}` | AC-211 — observed: "4 weeks · created Mon, Aug 24" | Completed |
| REQ-212 | both surfaces state both ways in | AC-212 — observed | Completed |
| REQ-903 | `beforeunload` + history sentinel & `popstate` | AC-421 — see below | Completed, with a stated limit |

### Two defects found by running it, not by reading it

Both were in copy the tests cannot reach, and both were introduced by this
change making a previously unreachable state reachable:

1. **"Push has no exercises left."** The empty-Workout well was written for the
   delete path, where "left" is true. A Workout added here never had any. Fixed
   to "has no exercises", with a comment recording why.
2. **REQ-209 was not actually satisfied on first pass.** After accepting an
   authored routine the confirmation still said **"Imported"**, the chip said
   **"imported"**, the primary button said **"Import another routine"**, and
   step 2 opened with **"These are the days your file suggested."** My earlier
   grep had found only the ScheduleStep *header comment* and I took that for the
   copy. Titles are now "Add a routine" / "Ready", the chip is "saved", the
   button is "Add another routine", and step 2 says "this routine suggests".

### AC-421 — what was and was not verified

Both mechanisms were verified **armed and correct**, at the listener:

- Dispatching a cancelable `beforeunload` while editing came back
  `defaultPrevented: true` — the guard is live.
- `window.history.state` while editing is `{"trainlogDraft":true}` — the
  sentinel is pushed.
- Dispatching `popstate` raised the existing Leave question — *"Discard this
  import? Nothing has been stored yet, so every correction you made here goes
  with it."* — and the sentinel was re-pushed afterwards, so a second back press
  asks again.

**Not verified:** an actual hardware or browser back press, and an actual
reload-with-dialog. The `computer` tool times out in this session (the Browser
pane is hidden), so the events were dispatched rather than produced by a real
gesture. A dispatched `popstate` is the same event the browser fires on back and
the handler is the same code, but the gesture itself was not exercised, and this
is recorded as an inference at that last step rather than as an observation.

### Checks

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass — **490** tests (471 → +19), measured in a clean worktree; see Ownership below |
| `pnpm lint` | Pass |
| `pnpm build` | Pass |

## Wave C — "I can put an exercise into a Workout while I am building it." (WS-3)

### Files changed

| Path | Change |
|---|---|
| `src/domain/routine-file/offer.ts` | **new** — `Offer`, `offerName`, `offeredExercises`, `resolveTypedName`, `draftExercise` |
| `src/domain/routine-file/offer.test.ts` | **new** — TST-300…309, 19 tests |
| `src/features/import/AddExercise.tsx` | **new** — the in-flow picker |
| `src/domain/routine-file/index.ts` | append-only offer block |
| `src/features/import/ExercisesStep.tsx` | `offers` + `onAddExercise`; the control in both the list and the empty-Workout well |
| `src/features/import/ImportWizard.tsx` | `useUserExercises`, memoised `offers`, `edit.addExercise` |

### The frozen `Offer` contract was implemented wrong first

The first implementation used a flat `{ kind, name, exerciseId }` interface and a
`resolveTypedName` returning `Offer | undefined`. Spec §6 freezes a
**discriminated union** and a **total** `resolveTypedName`. §6 was not read
before implementing — §3.4's requirements were, and they do not restate the
shape. Corrected before the wave closed.

The frozen shape is the better one, and the reason is worth keeping: the union
makes REQ-303 *structural*. A `user` offer has nowhere to put an id, so a
persisted Exercise's UUID cannot reach `exercise_id` — the shape the domain
forbids cannot be constructed. It is the argument `types.ts` already makes for
`ExerciseSession`.

### REQ-301 contradicts REQ-911 — escalated, owner resolved

REQ-301 says a draft row resolving to a catalog entry is *"offered once, as that
catalog entry"*, which drops the file's own spelling from the list. §6 freezes
`resolveTypedName(name, offers)` — it sees only that list. Together they reopen
the exact failure REQ-911 exists to prevent:

1. the file declares `exercise_id: front-squat` under `name: Sentadilla Frontal`;
2. the wizard **shows** that spelling in the Workout it came from;
3. the lifter adding the movement elsewhere types what they just read;
4. nothing matches, so it becomes a `new` offer;
5. a **second** Exercise is minted for a movement the draft already binds.

Corroboration that REQ-301's literal reading is the wrong one: REQ-303's clause
*"a draft offer … copies its `exercise_id` when the source row carries one"* is
unreachable under it. A clause that can never execute was written for the other
reading.

**Owner decided: reading B.** The spelling stays offerable and carries the slug.
A row whose *name* already resolves to an offered Exercise is dropped, and
`findExerciseByName` decides that — never a name set assembled locally — so
`  front   SQUAT ` is still recognized as the catalog's Front Squat and offered
once (REQ-301's purpose preserved). Two spellings of one movement may both
appear; both bind to the same Exercise, which is the property REQ-911 protects.

Under reading B a draft offer needs no resolution at all: it copies the source
row's two identity fields, so it resolves to exactly what that row resolves to —
by construction rather than by agreement (REQ-902).

### Requirement status

| Requirement | Implementation | Acceptance evidence | Status |
|---|---|---|---|
| REQ-300 | append + `setOpenRef` at the pre-append length | AC-300 — observed: picker closed, row appended `3×8–12 · kg`, editor open with `sets = 3` | Completed |
| REQ-301, 911, 902 | `offeredExercises` over `findExerciseByName` | AC-301 — TST-300, TST-308; observed 96 catalog offers, catalog-first | Completed |
| REQ-302 | draft rows contribute offers | AC-302 — TST-301, TST-304; observed "Sled Push" offered in Pull as **in this routine** | Completed |
| REQ-303 | identity by offer kind, structurally | AC-303 — TST-302 | Completed |
| REQ-304 | composition through `routineFileToDomain` | AC-304 — TST-303, TST-304, TST-308 | Completed |
| REQ-305 | `resolveTypedName` total; `new` offer | AC-305 — TST-305; observed "Add “Sled Push” as a new movement" | Completed |
| REQ-306 | reuse and say so | AC-306 — observed: "Front Squat already exists — adding it will use that movement, not make a second one" | Completed |
| REQ-307, 900 | seeded shape, no issue raised | AC-307 — TST-306; observed problem count unchanged across every add | Completed |
| REQ-308 | in-flow panel, bounded, scrolls internally | AC-308 — observed by hit test: `elementFromPoint` at the ActionBar centre returns the ActionBar; both its buttons enabled | Completed |
| REQ-309 | control inside the empty-Workout well | AC-309 — observed | Completed |
| REQ-310 | `openRef` is by index | AC-310 — observed: two rows named "Front Squat", exactly one editor open | Completed |
| REQ-311, DEC-Q4 | new code; picker untouched | AC-311 — `git status` reports `ExercisePicker.tsx` unmodified | Completed |
| REQ-312 | `exercise_id` stays a catalog channel | AC-312 — TST-307 | Completed |
| REQ-910 | ceiling pinned, not closed | AC-313 — TST-309 | Completed |

### Checks

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass |
| `pnpm lint` | Pass |
| `pnpm build` | Pass |

## Wave D — "I can grow the routine I am already running." (WS-4)

### Files changed

| Path | Change |
|---|---|
| `src/domain/scheduling/index.ts` | `remainingWeeks`, `claimantsOfDay` |
| `src/domain/scheduling/index.test.ts` | append-only — TST-400…408, 420, 421 |
| `src/domain/routine-file/planned-exercise-draft.ts` | **new** — `plannedExerciseDraftFile` (REQ-913) |
| `src/domain/routine-file/planned-exercise-draft.test.ts` | **new** — TST-409 |
| `src/db/repositories/workouts.ts` | `addWorkoutToRoutine` + three error classes |
| `src/db/repositories/plannedExercises.ts` | `addPlannedExercise`, `WorkoutNotFoundError` |
| `src/db/repositories/workouts.test.ts` | **new** — TST-410…414, 418, 419 |
| `src/db/repositories/plannedExercises.test.ts` | **new** — TST-415…417 |
| `src/db/repositories/placements.ts` | header: Placements no longer come only from an import |
| `src/db/index.ts` | append-only re-exports |
| `src/features/routines/AddToRoutine.tsx` | **new** — both forms |
| `src/features/routines/RoutineDetailScreen.tsx` | the two affordances, active-only |

### A defect the spec's own oracle caught

`remainingWeeks` first clamped only the subtraction:
`Math.min(weeks, Math.max(0, weeks - elapsed))`. For a negative `weeks` that
returns the negative unchanged. TST-403 states the answer must be 0, and it is
right: nothing bounds `Routine.weeks` — not the schema, not the stored type — so
a restored backup can carry one. `weeks` is now floored before the subtraction.
Found by writing the test the spec specified rather than the one the code
suggested.

### Three test expectations were wrong, not the code

- **Placement count.** Anchor Mon 2026-09-07, `weeks: 8`, today Wed 2026-09-30
  leaves five weeks — but this week's Tuesday (09-29) is behind today, so four
  Tuesdays are placed. "From today forward" is per *date*, not per week.
- **TST-412 fixture.** The second import archives the first; archiving the second
  too left no active Routine and the writer correctly refused.
- **`placements.where('workoutId')`.** `SCHEMA_V1` carries no such index.

### Requirement status

| Requirement | Implementation | Acceptance evidence | Status |
|---|---|---|---|
| REQ-400, 905 | `addWorkoutToRoutine` | AC-400 — TST-410; observed on the active Routine | Completed |
| REQ-401 | `order` from siblings, in-transaction | AC-401 — TST-414; observed `order: 1` | Completed |
| REQ-402 | `remainingWeeks` + `generatePlacements`, Monday-aligned | AC-402 — TST-400…404, TST-410 | Completed |
| REQ-403 | zero Placements is a success | AC-403 — TST-411; observed both copy paths | Completed |
| REQ-404, 912 | preview = same functions, write wins | AC-404 — observed preview `4 sessions, 2026-08-24 → 2026-09-14`, then "Workout added, with 4 sessions placed", IndexedDB holding those four dates | Completed |
| REQ-405, 406, 907 | `claimantsOfDay` + the full-consequence warning | AC-405…407 — TST-420, TST-421; warning copy observed verbatim | Completed |
| REQ-407 | targets collected; no Exercise created | AC-408 — observed `exercises` table 0 → **0** rows | Completed |
| REQ-408 | `order` from siblings, in-transaction | AC-409 — TST-415; observed `order: 1` | Completed |
| REQ-409, 913 | `plannedExerciseDraftFile` + `validateRoutineFile` | AC-410 — TST-409; observed "Push → Barbell Row: min_reps cannot be greater than max_reps." with Save disabled | Completed |
| REQ-410 | progression a closed choice | AC-411 — no free text reaches `ProgressionRule.type` | Completed |
| REQ-411, 414 | three named errors, status read in-transaction | AC-412, AC-415 — TST-413, TST-416 | Completed |
| REQ-412 | one transaction per add, exact tables | AC-413 — TST-410, TST-415 | Completed |
| REQ-413 | nothing recorded is touched | AC-414a — **TST-417**, the DEC-B safety test: all three execution tables compared whole and identical | Completed |
| REQ-415 | no destructive verb added | AC-416 — the only new writers are the two adds | Completed |
| REQ-416 | empty Workout is trainable | AC-417 — TST-418; observed "This Workout has no exercises." | Completed |
| REQ-417 | backup round-trip | AC-418 — **TST-419**: export → reset → restore | Completed |

### Checks

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass |
| `pnpm lint` | Pass |
| `pnpm build` | Pass |

## Wave E — "Nothing the app tells me is a lie any more." (WS-5)

### The recorded blocker, and how it was cleared

Wave B's record left Wave E **blocked**: `CONTEXT.md` and `docs/PRD.md` carried
uncommitted edits attributed to a concurrent session (a session **Effort**
metric). That attribution was wrong. The Effort work is this same operator's,
made earlier in the same session and known in full — not a third party's
in-flight edit. The owner then explicitly directed that the remaining waves be
completed.

So the block was cleared by identification and instruction, not by the other
work landing. Both files were **appended to and amended in place**; the Effort
entry in `CONTEXT.md` and the §39 A·15 row in `docs/PRD.md` are intact and
untouched. Recorded here because a block recorded in an execution log must be
answered in it, not silently stepped over.

### Files changed

`AGENTS.MD`, `CONTEXT.md`, `PRODUCT.md`, `docs/PRD.md`, `src/domain/types.ts`,
`src/domain/session/index.ts`, `src/domain/routine-file/edit.ts`,
`src/db/repositories/{routines,exerciseSessions,placements}.ts`,
`src/features/session/ExerciseReorder.tsx`,
`src/features/routines/{RoutinesScreen,RoutineDetailScreen}.tsx`,
`src/features/today/TodayScreen.tsx`,
`src/features/calendar/CalendarScreen.tsx`,
`src/features/import/ConversionPromptButton.tsx` + its test.

### Requirement status

| Requirement | Evidence | Status |
|---|---|---|
| REQ-500 | `AGENTS.MD`, `CONTEXT.md`, `PRODUCT.md` all state the amended invariant | Completed |
| REQ-501 | `docs/PRD.md` §11.2 and §25 amended | Completed |
| REQ-502, 503 | §11.1 lists adding, and documents the fileless entry | Completed |
| REQ-504, 901 | all three enumerations count **eight** | Completed |
| REQ-505 | the DEC-Q1 standing rule is in `AGENTS.MD`'s Validation section | Completed |
| REQ-506 | `CONTEXT.md` **Suggested Day** and the `Workout` doc comment corrected | Completed |
| REQ-507 | exactly one new entry: **Routine Draft** | Completed |
| REQ-508 | §39 item 7 → 🟡, item 8 still blocked | Completed |
| REQ-509 | §39 item 14 → 🟡 **and its false claim corrected** | Completed |
| REQ-510 | no new ADR; `docs/adr/` still holds two files | Completed |
| REQ-511 | `deleteExercise`'s stated reason changed | AC-512 — TST-500, TST-501 (pre-existing) | Completed |
| REQ-512 | `grep -rn "immutable\|inmutable" src/` returns **two** hits, both deliberate | Completed |
| REQ-513, 906 | the stale copy blocks amended; see Deviations | Completed |
| REQ-514 | `RoutinesScreen` provenance reads `created {date}` (WS-2's edit, verified not re-edited) | Completed |
| REQ-515, 904 | `CONVERSION_PROMPT` Rules names the zero-Workout, blank-name and numeric rules | AC-516/517 — TST-515 | Completed |
| REQ-516 | §39 updated in this change; §38 unaffected (no MVP item moves) | Completed |

### Checks

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass — **543** tests (baseline floor 458) |
| `pnpm lint` | Pass |
| `pnpm build` | Pass |

## Integration Gates

| Gate | Owner | Diff inspected? | Checks | Result |
|---|---|---:|---|---|
| Wave A | this writer | Yes | four green, 471 tests | **Pass** |
| Wave B | this writer | Yes | four green, 490 tests | **Pass** |
| Wave C | this writer | Yes | four green | **Pass** |
| Wave D | this writer | Yes | four green | **Pass** |
| Wave E | this writer | Yes | four green, 543 tests | **Pass** |

## Deviations

- **UI verification method.** See "What was observed" above. The plan assumed
  browser-driven clicks; the pane is unavailable, so events were dispatched at
  the page instead. Recorded rather than glossed.

## Ownership / Contract Conflicts

**A second session is working in this same tree, and it overlaps WS-5.**

Found at Wave B's integration gate, by reading `git status` rather than assuming
it: five files are modified that no wave of this change owns —
`src/domain/session-summary.ts` and its test,
`src/features/history/SessionDetailScreen.tsx`, `CONTEXT.md` and `docs/PRD.md`.
They implement an unrelated feature (a session **Effort** metric — Foster's
session load). All five are uncommitted.

Two consequences, both handled:

1. **Nothing of theirs was committed.** Every commit in this change used an
   explicit pathspec, which plan §1 made a standing rule for a different reason
   (`docs/PRD-DMS.md`) and which turns out to have covered this too. The staged
   set was diffed against the owned set before each commit.
2. **The reported test count was wrong, and is corrected.** Their work adds 4
   tests to `session-summary.test.ts` (10 → 14), so the 494 the suite reported
   in the shared tree was not all mine. Re-measured in a clean detached
   worktree at each commit: `40e0c02` = 458, Wave A `8f979ae` = **471**, Wave B
   `8ab1082` = **490**. Wave A's figure was already right; Wave B's was inflated
   by 4 and now reads +19.

**This is a stop condition for Wave E, not for Wave C.** `CONTEXT.md` and
`docs/PRD.md` are in WS-5's May-Edit set (REQ-500, REQ-504, REQ-507, REQ-509),
and both carry another session's in-flight edits — `CONTEXT.md` has a new
**Effort** glossary entry, `docs/PRD.md` one added line. Wave E cannot safely
rewrite either until that work has landed or been withdrawn. Waves C and D touch
neither file and are unaffected.

Otherwise: `src/db/index.ts` and `src/domain/routine-file/index.ts` were appended
to, as their shared-file rules require.

## Blockers

**None open.**

The Wave E block recorded above was cleared, and the way it cleared matters: the
"concurrent session" it named was this same operator, and the Effort work was
known in full rather than being a third party's in-flight edit. The owner then
directed that the remaining waves be completed. `CONTEXT.md` and `docs/PRD.md`
were amended in place with the Effort entries left intact — verified by reading
them after the edits, not assumed.

### One incident, recorded because it was destructive

While writing this record, **this file was overwritten**: a fresh Waves C–E
document was written over the existing 288-line Waves A–B record with the Write
tool, destroying it. It was recovered from `HEAD` (`git show`) and the new waves
appended to it instead. Nothing was lost, but nothing about the recovery was
owed — the file was not read before being written over, which is the actual
defect.

## Independent Verification Readiness

Waves A and B: ready. Diff range `git diff 40e0c02..8ab1082`.
Waves C, D and E: ready. Diff range: uncommitted working tree on `16cf1e9`,
excluding the Effort work (`src/domain/session-summary.ts` + its test,
`src/features/history/SessionDetailScreen.tsx`) and
`docs/changes/2026-08-24-exercise-measurement/`.

Untracked and never touched: `docs/PRD-DMS.md`,
`docs/bloque-a-acumulacion.yaml`, `docs/bloque-b-intensificacion.yaml`.

## Post-audit remediation

An independent audit of this change ran after Wave E and reported seven
defects. All seven are closed here; the counts above are restated to the state
that leaves behind.

| # | What was wrong | Where it was fixed |
| --- | --- | --- |
| F-1 | `plannedExerciseDraftFile` dropped the `rir` node unless **both** ends were present, so `rir_out_of_range` never saw a half range and a negative RIR was stored raw — a row `parseBackup` then refuses, with no verb (REQ-415) to repair it | `planned-exercise-draft.ts` — new `plannedExerciseDraftRefusals` |
| F-2 | `increment` accepted `0` and negatives, against its own caption and `backup/schema.ts`'s non-negative read | same |
| F-3 | REQ-504 landed in two of its three sites; `schema.ts:10-13` still counted six. The §5 "must not change" on that file is about its *behaviour* — stop condition 6 names `.min(1)` — so the comment was completed and the reason for the absent `.min(1)` recorded in it | `routine-file/schema.ts` (comment only; no schema change) |
| F-4 | The REQ-903 sentinel was never retired, so the first back press after Accept did nothing, and `pushState` replaced React Router's `history.state` wholesale | `ImportWizard.tsx` |
| F-5 | The add-exercise list was catalog-first cut at forty, hiding the lifter's own movements entirely, with no Cancel and no sign the list was cut | `AddToRoutine.tsx` |
| F-6 | An empty preview had two branches for three reasons, so a past day in the last week read as "No day is selected" | `AddToRoutine.tsx` |
| F-7 | `claimantsOfDay` did not sort, though REQ-907 asks for `order` and the warning reads `[0]` as the one Today prefers | `scheduling/index.ts`; TST-420 now passes a disordered fixture |

### Second pass — accessibility and import-flavoured copy

The audit's two grouped rows, closed the same way.

| Theme | What was wrong | Where it was fixed |
| --- | --- | --- |
| a11y | The two new async failure lines were bare `<p>`, against nine sibling failure lines that carry `role="alert"`. The day-collision warning had no live region at all, so toggling a day announced nothing | `AddToRoutine.tsx` — `role="alert"` on both failures, `role="status"` (polite, because days are toggled in runs) on the collision warning |
| a11y | `aria-label` on a bare `<div>` is dropped — ARIA names only count on an element with a role | `AddToRoutine.tsx`, `AddExercise.tsx` — `role="group"` on both pickers |
| a11y | Eight literal `add-planned-*` ids: a Routine with two Workouts renders two of these forms, so every `htmlFor` resolved to the first | `AddToRoutine.tsx` — ids scoped by `workoutId`, as the picker's `TextField` already was |
| copy | `ActionBar.tsx` was never revisited for REQ-200: "Discard this import?", "N problems still block this import." and "Importing" all describe a file that does not exist on the from-scratch route | `ActionBar.tsx` — draft/routine/Saving |
| copy | `ImportWizard.tsx` back label read "Leave this import" on both routes | `ImportWizard.tsx` — "Leave this draft" |
| copy | REQ-208 landed in neither of its two sites: the empty well and `FIX.routine_has_no_workouts` both still said "choose a file that declares one" | `ExercisesStep.tsx`, `issues.ts` |
| copy | `MoreScreen.tsx` described Routines as "Every programme you have imported" | `MoreScreen.tsx` — "imported or built" |

### Third pass — contradictory comments and dead code

| Theme | What was wrong | Where it was fixed |
| --- | --- | --- |
| REQ-512 | "Editing means importing again" sat three lines under the amendment saying the opposite, and never mentioned the *Start from scratch* the same screen gained | `RoutinesScreen.tsx` |
| REQ-512 | Placements described as generated "once, at import" — REQ-402 also generates them for a Workout added mid-block | `scheduling/index.ts` |
| REQ-512 | "an accepted Routine is never rewritten once accepted" — a garbled half-edit; the amended rule is *never rewritten, only added to* | `exerciseSessions.ts` |
| REQ-512 | Same rule phrased two ways in sibling comments | `ExerciseReorder.tsx`, aligned to `session/index.ts:260` |
| REQ-512 | The `routine_name_blank` prose was spliced into the middle of `routine_has_no_workouts`'s block, leaving that issue with no explanation above it | `validate.ts` — split into two blocks, each over its own `if` |
| dead code | `findCatalogExerciseByNormalizedName` lost its last production caller when `resolveFileExercise` was re-expressed and survived on its test alone — a second exported §26 decider, which is the drift REQ-902 exists to prevent | deleted from `catalog/index.ts`; its one unique assertion (every entry by its own name) moved onto `findExerciseByName` |
| dead code | `onAdded` required on both forms, both call sites passing `() => undefined`; the live queries already repaint after the write | `AddToRoutine.tsx`, `RoutineDetailScreen.tsx` |
| dead code | `siblings={workouts as readonly Workout[]}` — a cast to the type the value already had; it was also the only use of the `Workout` import | `RoutineDetailScreen.tsx` |

Test count drops **543 → 541**: three assertions against the deleted decider,
one of them kept and re-anchored.

### Fourth pass — the coverage the record claimed and did not have

| # | What was wrong | Where it was fixed |
| --- | --- | --- |
| TST-009 | Did not exist. No test broke an *added* exercise and checked the issue at that row's path; the row above credited AC-011 to TST-013, which asserts `routine_name_blank` instead | `edit.test.ts` — add to Workout 1 position 1, set `sets: 0`, assert one `sets_not_positive` at `routine.workouts.1.exercises.1.sets`, and that the row as added is clean |
| REQ-105 | The "vocabularies derived from `CATALOG` only" clause had no assertion anywhere. TST-107 covers the round-trip, which is a different claim | `catalog/index.test.ts` — TST-105: nothing offered that the catalog lacks, everything it does use offered sorted and deduped, and the offer stays closed while `groupExercises` accepts the same dirty value |
| record | `verification.md` claimed both barrels were "never reordered"; the `edit` block was re-alphabetized and `toggleSuggestedDay` moved | `verification.md`, corrected in place with the reason it is unobservable |

Both new tests were mutation-checked rather than merely run: seeding `'lunar'`
into `CATALOG_CATEGORIES` fails all three TST-105 cases, and pinning the
exercise index to `0` in `validate.ts` fails TST-009. Each was restored
immediately and the suite is green.

**Gates rerun:** `typecheck` pass · `lint` pass · `test` **545** passing, 33
files (floor 458) · `build` pass.

**On the counts above.** Every figure in this file was first recorded from a
working tree that also held the in-flight Effort work, which contributes four
tests of its own — so each was four too high, including the 542 the audit
corrected to 543. They are restated as measured on this change alone, in a
detached worktree at each commit: **513** after the wizard picker, **545**
after the Routine additions, unchanged by the documentation commit. The floor
of 458 was never at risk; the lesson is that a count taken in a shared tree
measures the tree, not the change.

**Observed in the app** (dev server, 375x812, real IndexedDB; the browser pane
composes no frames in this session, so handlers were driven and the rendered
DOM read, the same limitation this file and `verification.md` already record):

- F-1/F-2 — min RIR `-1` with max blank and `increment -2.5`: Save disabled,
  both messages on the right fields. Filling max with `-1` hands the pair to
  the shared validator, which answers `RIR must be between 0 and 10` — the
  issue the omission used to make unreachable.
- F-4 — after Accept, `history.state` is `{idx: 0}` (React Router's `idx`
  intact, sentinel retired) and **one** back press leaves `/import?new=1` for
  `/today`.
- F-5 — with an empty search: `["Zercher Good Morning", "Back Squat", "Front
  Squat"]`, `57 more — search to narrow the list.`, and a Cancel.
- F-6 — one-week block, Monday lit (`aria-pressed="true"`): *"Every occurrence
  of Monday has already gone by in this block…"*.
- Copy — the from-scratch route reads "Leave this draft", "Discard this
  draft?", "2 problems still block this routine.", "A routine needs at least
  one. Add it below."
- a11y — two open add-exercise forms render 16 `add-planned-*` ids with zero
  duplicates, each `sets` label resolving to its own Workout; both pickers
  report `role="group"`.

**Not exercised:** `role="alert"` on the two failure lines and `role="status"`
on the collision warning — both need a write failure or a claimed day that this
seed data has no way to produce. Attribute placement reviewed, not observed.

### Fifth pass — the three the second audit found still open

| # | What was wrong | Where it was fixed |
| --- | --- | --- |
| P-1 | `unit` was seeded from the `defaultUnit` prop with `useState`, and `useSettings` resolves a tick after this form mounts — so a lifter set to pounds got a form in kilos every time, with no way to tell a default from their setting | `AddToRoutine.tsx` — only the explicit pick is state (`pickedUnit`), the setting is the fallback: `pickedUnit ?? defaultUnit`. `close()` forgets it with the rest of the form |
| P-2 | The form showed `issue.message` raw: it names a file path this screen never showed, and stops at the problem. The wizard's fields show `describeIssue`, which adds what to do | `AddToRoutine.tsx` — the synthetic file is built once and its row handed to `describeIssue` inside `errorFor` |
| P-3 | The `failure` block in `AddPlannedExerciseForm` sat four levels out, at the sibling form's indentation | `AddToRoutine.tsx` — reindented, markup untouched |

**Test added:** `features/import/issues.test.ts` — the seam P-2 newly depends
on. `describeIssue` reads the row's own fields and `plannedExerciseDraftFile`
is what shapes that row; the two cases pin the four sentences this form can
show and assert none of them leaks the file path again. Mutation-checked:
dropping the row argument back to `undefined` fails both.

**P-1 carries no test, deliberately.** The fix removes the state that lost the
race, so there is no branch left to assert — a test over `pickedUnit ??
defaultUnit` is tautological. The guard that would catch a regression is a
render with settings arriving late, and this repo has no render harness; adding
one (jsdom + testing-library) is a larger change than the fix. Recorded as debt.

**Gates rerun:** `typecheck` pass · `lint` pass · `test` **551** passing, 34
files · `build` pass. That 551 is a shared-tree figure, the same caveat as
above: on this change alone it is the 545 already recorded plus the two new
cases — 547 by construction, not measured in a detached worktree this time.

**Observed in the app** (dev server, 375x812, real IndexedDB, settings set to
`lb`):

- P-1 — with the fix: `increment (lb)` and the unit select on `lb`. With the
  seeding put back on purpose, the same screen and the same settings read
  `increment (kg)` again. The evidence is the difference, not one reading; the
  fix was restored immediately.
- P-2 — `sets` set to `0` now reads *"Sets is 0. Enter at least 1 set."*, where
  it used to read *"Push → Back Squat: sets must be greater than zero."*, and
  Add exercise stays disabled.
