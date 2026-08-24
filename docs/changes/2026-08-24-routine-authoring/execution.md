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
| B / Gate 0 + WS-2 | REQ-001…014, 200…212, 900, 901, 903, 906, 908 | **Completed** | 12 | all four green | 494 tests (471 → +23); UI observed, below |
| C / WS-3 | REQ-300…312 | Not started | | | |
| D / WS-4 | REQ-400…417 | Not started | | | |
| E / WS-5 | REQ-500…516 | Not started | | | |

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
| REQ-105 | closed vocabularies from `CATALOG` only | AC-106 — TST-107 | Completed |
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
| REQ-011, 013, 901 | `routine_name_blank` across all three files | AC-011/013 — TST-013 | Completed |
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
| `pnpm test` | Pass — **494** tests (471 → +23) |
| `pnpm lint` | Pass |
| `pnpm build` | Pass |

## Integration Gates

| Gate | Owner | Diff inspected? | Checks | Result |
|---|---|---:|---|---|
| Wave A | this writer | Yes | four green, 471 tests | **Pass** |
| Wave B | this writer | Yes | four green, 494 tests | **Pass** |

## Deviations

- **UI verification method.** See "What was observed" above. The plan assumed
  browser-driven clicks; the pane is unavailable, so events were dispatched at
  the page instead. Recorded rather than glossed.

## Ownership / Contract Conflicts

None. `src/db/index.ts` was appended to, as its shared-file rule requires.

## Blockers

None.

## Independent Verification Readiness

Waves A and B: ready. Diff range `git diff 40e0c02..HEAD -- src/`.
Waves C–E: not started.
