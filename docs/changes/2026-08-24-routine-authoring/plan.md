# Routine Authoring — Implementation Plan

Status: Ready — after the preflight actions in §1 are performed
Size: large
Reliability: strict
Base: `master@49efc78`, plus the landed-but-uncommitted quick change
[`2026-08-24-empty-routine-accept`](../2026-08-24-empty-routine-accept/)

## 1. Preflight Baseline

| Field | Value |
|---|---|
| Working tree | **Dirty and staged.** `src/domain/routine-file/validate.ts`, `validate.test.ts` and `src/features/import/issues.ts` carry the quick change; `docs/PRD-DMS.md` and the change folders are staged. |
| Spec | [`spec.md`](./spec.md) — Ready for planning |
| Audit | [`audit.md`](./audit.md) |
| Commands | `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` — all four verified working and green at baseline (458 tests, 29 files) |
| Paths | All 34 existing paths named by spec §5 verified present; all 4 new paths verified absent |

### Required before the first line of code

Neither is optional, and neither is an implementer's call:

1. **Commit the quick change on its own branch.** It is a defect fix with its
   own spec, execution and verification records, and leaving it uncommitted
   makes every wave below inherit an unrelated diff. Suggested:
   `change/empty-routine-accept`, then branch this change from it or from
   `master` after merge.
2. **Unstage `docs/PRD-DMS.md`.** It is unrelated work belonging to a different
   product (stop condition 10). Staged as things stand, a bare `git commit`
   sweeps it into the quick change's commit.

### Standing rule for every commit in this change

**Commit by explicit pathspec.** Never `git commit -a`, never a bare
`git add .`. `docs/PRD-DMS.md` sits untracked-or-staged in this tree for the
duration, and one careless commit publishes it. Stated once here rather than
trusted to memory at five separate gates.

## 2. Wave 0 — Adjudications

The spec is frozen on *behavior*. These ten are **ownership and placement**
questions the spec left open or contradicted itself on; every one was surfaced
by an independent write-set analysis, and two workstreams could not proceed
without them. They are settled here, in the plan, which is where ownership
belongs. No behavior changes.

| # | Defect | Adjudication |
|---|---|---|
| J-1 | **REQ-504 requires editing `src/domain/routine-file/schema.ts:10-13`, which §5 freezes and stop condition 6 protects.** WS-5 reported infeasible on this. | **Narrow carve-out.** WS-5 may edit **the doc comment at `:10-13` only** — it enumerates six semantic checks and is already stale at HEAD. No Zod chain, no `.min(1)`, no export changes. Stop condition 6 targets schema *constraints*, which this does not touch. ⚠ *Touches a §5 freeze — see §9.* |
| J-2 | **REQ-203's fix to `routine_has_no_workouts`'s message sits at `validate.ts:61`, inside the block §5 scopes to Gate 0 with "Nothing else", while §3 assigns the requirement to WS-2.** | **Gate 0 owns it.** `blankRoutineFile` is what makes a nameless draft reachable, and TST-014 — Gate 0's test — is what exercises it. WS-2 cites REQ-203; Gate 0 implements the conditional. |
| J-3 | **`RoutineDetailScreen.tsx` is given wholly to WS-4 by §5, while REQ-906 gives `:55` to WS-5 and REQ-512 gives `:2` and `:6` to WS-5.** WS-4 cannot add two write affordances without rewriting a header that says "Nothing here is editable". | **WS-4 writes the header (`:1-9`) and the body. WS-5 writes only `:55`** and verifies the header in place. |
| J-4 | **`plannedExerciseDraftFile` has no pinned module.** §6 prints it inside the `offer.ts` (WS-3) code block; §5 gives WS-4 an unnamed row. Highest-probability accidental collision in the change. | **Pinned: `src/domain/routine-file/planned-exercise-draft.ts`, WS-4 exclusively.** Signature: `plannedExerciseDraftFile(targets: PlannedExerciseTargets, workoutName: string): RoutineFile`, where `PlannedExerciseTargets = Pick<PlannedExercise, 'sets' \| 'minReps' \| 'maxReps' \| 'minRir' \| 'maxRir' \| 'restSeconds' \| 'unit' \| 'progression'>`. It is **not** exported from the `offer` block. |
| J-5 | **All 14 test files in §9 are owned by nobody.** Four workstreams reported this independently; three files have real multi-claimant pressure. | **The ownership table in §5 below is binding.** One writer per test file. |
| J-6 | **`execution.md` is owned by nobody**, yet §12 makes it a hard obligation for every "running the app" AC, and REQ-516 ties the PRD table update to it. | **One `##` section per wave, appended at that wave's integration gate** by that wave's writer. REQ-516's §38/§39 edit lands in the **final** wave's commit. |
| J-7 | **`src/features/import/fields.tsx` is owned by nobody.** WS-2 reported infeasible: REQ-204/205/207 need a text control with the module's `aria-invalid`/`aria-describedby` error wiring, which lives in the module-private `FieldFrame`. | **WS-2 is sole writer**, exporting a `TextField` beside the existing `NumberField`/`SelectField`/`NotesField`. WS-3 and WS-4 consume it read-only. |
| J-8 | **`ExercisePicker.tsx:4-5` becomes false.** Its header says the picker offers "every Exercise a routine file has already created" — WS-1's `createUserExercise` makes that provenance claim wrong. The file is frozen by DEC-Q4 and the line is not among REQ-512's sites. | **Fourteenth REQ-512 site, comment-only carve-out**, owned by WS-5. Its other claim ("this picks, it does not create") stays true, so REQ-311 and DEC-Q4's substance are untouched. ⚠ *Touches a DEC-Q4 freeze — see §9.* |
| J-9 | **`docs/PRD.md:539`** lists "rutina sin nombre" under the **Structural** tier, but REQ-901 and stop condition 6 place the blank-name rule in the **Semantic** tier. After Gate 0 lands, §11.1 contradicts itself. | **Pre-authorized for WS-5** as part of REQ-504's sweep, so it does not read as scope drift at review. |
| J-10 | **`AGENTS.MD:4`, `CONTEXT.md:3-5`, `PRODUCT.md:75`** still assert a file declares the programme, and fall between REQ-500 and REQ-513. | **Added to REQ-500's site list**, WS-5. |

Two further standing rules, from the same analysis:

- **`src/domain/routine-file/fixtures.ts` is written by nobody.** Every domain
  test in the change reads it. `aFile()` hardcodes the name `'Hybrid Strength'`;
  TST-013 uses `setRoutineName(aFile(), '')` rather than adding a parameter.
  Verified sufficient for every assigned test.
- **The two barrels are append-only, not single-owner.**
  `src/domain/routine-file/index.ts` takes three sequential writers (Gate 0
  verbs → WS-3 offer → WS-4 draft helper); `src/db/index.ts` takes two (WS-1
  exercises block, WS-4 workouts/plannedExercises blocks). Strike "incl. the
  offer module" from Gate 0's §5 cell — **Gate 0 cannot export a file that does
  not exist and still typecheck alone**, which §12 requires of it.

## 3. Dependency Graph

### True Dependencies

Compile-level only, verified symbol by symbol. This is the whole graph.

| ID | Dependency | Why It Must Precede | Unlocks |
|---|---|---|---|
| D-001 | WS-1 → WS-3 | WS-3's `offeredExercises`/`resolveTypedName` call `findExerciseByName` from `@/domain/catalog` (REQ-902). Building first means building against the pre-extraction shape and shipping three §26 deciders. | Wave C |
| D-002 | Gate 0 → WS-2 | `state.ts` consumes `blankRoutineFile` (REQ-908) and `setRoutineName` (REQ-204) through the domain barrel. Neither symbol exists until Gate 0. | Wave B |
| D-003 | Gate 0 → WS-3 | `draftExercise`'s output is only consumable through Gate 0's `addExercise(file, index, exercise)`. | Wave C |
| D-004 | `validate.ts` + `issues.ts` in **one commit** | `FIX` is `Record<SemanticIssueCode, string>` (`issues.ts:82`) and `problemOf` a `default`-less switch returning `string` (`:104-126`). Adding a union member without both fails `tsc` — TS2739 and TS2366. This is stop condition 2, and it is real. | Gate 0 landing green |

### Corrections to spec §15

The spec's dependency claims were checked against what the code actually
imports. Three were wrong:

- **§15 overstates `Gate 0 → WS-1`.** No file in WS-1's set imports any Gate 0
  symbol, and WS-1 touches neither `validate.ts` nor `issues.ts`. **WS-1 has
  zero true upstream and can go first** — which is why it does.
- **§15 overstates `WS-4 depends only on Gate 0`.** WS-4 needs nothing Gate 0
  produces; `validateRoutineFile`, `RoutineFile` and `SemanticIssue` are already
  exported today. **WS-4 has zero true upstream** and is placed by write-set
  serialization alone.
- **§15 misstates `WS-2 → WS-3`.** Correct, but it is not a contract
  dependency — WS-3 needs no WS-2 symbol and reuses the existing
  `{type:'edited', file}` action. It is pure textual serialization over three
  shared expressions in `ImportWizard.tsx` and two wells in `ExercisesStep.tsx`.

### Artificial Dependencies Removable by Gate 0

None. Gate 0 here is a real workstream that ships behavior (the draft verbs and
`routine_name_blank`), not a contract-materialization gate. It is named "Gate 0"
in the spec for continuity and executes inside Wave B.

### Integration-only couplings

Nine files carry two or more writers with no compile dependency between them.
Every one is resolved by ordering, not by concurrency control — see §5.

## 4. Execution Strategy

**Topology: single-agent sequential, one branch.**

Not a default — the alternative was examined and rejected on three independent
grounds:

1. **Write sets are not provably disjoint.** Twenty-two files carry more than
   one claimant. Three are genuinely concurrent-unsafe at the hunk level:
   `issues.ts` (Gate 0's new `FIX` key lands on the line below WS-2's reword),
   `ExercisesStep.tsx` (three writers, two wells six lines apart), and
   `ImportWizard.tsx` (WS-2 and WS-3 write the *same three expressions* — the
   `edit` object, the `<ExercisesStep>` call site, and the mount effect).
2. **§8's second rollout window forecloses splitting Gate 0 from WS-2.** The
   instant `routine_name_blank` lands, an unnamed imported file is blocked from
   Accept — and `jumpToIssue` focuses `f-routine-name`, a DOM id that does not
   exist until REQ-204 ships. The lifter would have no way out. Gate 0 and WS-2
   must land as one unit.
3. **UI verification crosses workstreams and is impossible in isolation.** No
   React component can be tested, so every UI requirement is verified by running
   the app — and the flows that must be observed ("author from scratch, then add
   an exercise you created earlier") span WS-1, Gate 0, WS-2 and WS-3. Those
   observations cannot be made from isolated worktrees.

The governing rule is explicit: do not recommend concurrent writers when exact
write sets are not provably disjoint. They are not.

## 5. Ownership Map

| Workstream | Wave | REQ IDs | May Edit | Integration-Reserved | Must Not Edit |
|---|---|---|---|---|---|
| WS-1 | A | REQ-100…110, 902, 909 | `domain/catalog/index.ts`, `domain/routine-file/to-domain.ts`, `db/repositories/exercises.ts`, `features/exercises/ExerciseCatalogScreen.tsx` | `db/index.ts` (exercises block) | everything else |
| Gate 0 | B | REQ-001…014, 900, 901, 908; **+ J-2** | `domain/routine-file/edit.ts`, `validate.ts`, `features/import/issues.ts` | `domain/routine-file/index.ts` (edit block + header) | `schema.ts`, `fixtures.ts` |
| WS-2 | B | REQ-200…212, 903, 906(share), 908(share) | `features/import/{state,ImportWizard,ExercisesStep,FileStep,ScheduleStep,ActionBar}.tsx/.ts`, `features/import/fields.tsx` (**J-7**), `features/today/TodayScreen.tsx:224-226`, `features/routines/RoutinesScreen.tsx` | `issues.ts` (`FIX.routine_has_no_workouts` only) | `ExercisesStep.tsx:11` (WS-5's) |
| WS-3 | C | REQ-300…312, 900(`draftExercise`), 910, 911 | `domain/routine-file/offer.ts` (new), `features/import/AddExercise.tsx` (new), `features/import/ExercisesStep.tsx`, `ImportWizard.tsx` | `domain/routine-file/index.ts` (offer block) | `ExercisePicker.tsx`, `fields.tsx` |
| WS-4 | D | REQ-400…417, 905, 907, 912, 913 | `domain/scheduling/index.ts`, `domain/routine-file/planned-exercise-draft.ts` (new, **J-4**), `db/repositories/{workouts,plannedExercises,placements}.ts`, `features/routines/RoutineDetailScreen.tsx` (**J-3**), `features/today/TodayScreen.tsx:161-163` | `db/index.ts` (workouts + plannedExercises blocks), `domain/routine-file/index.ts` (draft-helper block) | `ExercisePicker.tsx` (imports unmodified) |
| WS-5 | E | REQ-500…516, 906(share) | `AGENTS.MD`, `CONTEXT.md`, `PRODUCT.md`, `docs/PRD.md`, `features/import/ConversionPromptButton.tsx`, `features/calendar/CalendarScreen.tsx`, `RoutineDetailScreen.tsx:55`, `domain/types.ts`, `domain/session/index.ts`, `db/repositories/{routines,exerciseSessions}.ts`, `features/session/ExerciseReorder.tsx`, `ExercisesStep.tsx:11`, `domain/routine-file/schema.ts:10-13` (**J-1**), `ExercisePicker.tsx:4-5` (**J-8**) | — | any Zod chain; any behavior |

### Test file ownership (J-5) — binding

| Test file | Owner | Tests | Note |
|---|---|---|---|
| `domain/catalog/index.test.ts` | WS-1 | TST-100, 108 | append |
| `domain/routine-file/to-domain.test.ts` | WS-1 | TST-101 | **no-edit regression gate** |
| `db/repositories/exercises.test.ts` | WS-1 | TST-102…107 | TST-105 must not drift into `import.test.ts` |
| `domain/routine-file/edit.test.ts` | Gate 0 | TST-001, 003, 006, 007, 008, 010, 012 | WS-5's TST-500 **already exists** at `:67-71` — verify, do not rewrite |
| `domain/routine-file/validate.test.ts` | Gate 0, then WS-2 | TST-002, 009, 013, 014 / TST-015 | WS-5's TST-501 **already exists** at `:27-29` — verify only |
| `db/repositories/import.test.ts` | WS-2 | TST-207 | |
| `domain/routine-file/offer.test.ts` | WS-3 | TST-300…309 | new. WS-3's composition tests live here, **not** in `to-domain.test.ts` — ratified |
| `domain/routine-file/planned-exercise-draft.test.ts` | WS-4 | TST-409 | new. Must **not** be appended to `validate.test.ts` |
| `domain/scheduling/index.test.ts` | WS-4 | TST-400…408, 420, 421 | TST-406 also covers REQ-210; **WS-4 writes, WS-2 cites** |
| `db/repositories/workouts.test.ts` | WS-4 | TST-410…414 | new |
| `db/repositories/plannedExercises.test.ts` | WS-4 | TST-415…417 | new |
| `db/repositories/sessions.test.ts` | WS-4 | TST-418 | append to the existing case |
| `db/repositories/backup.test.ts` | WS-4 | TST-419 | append |
| `features/import/ConversionPromptButton.test.ts` | WS-5 | TST-515 | its existing case is stop condition 7 — **untouched** |

### Contested source files — write/verify rule

| File | Writers | Rule |
|---|---|---|
| `domain/routine-file/index.ts` | Gate 0, WS-3, WS-4 | append-only, in wave order |
| `db/index.ts` | WS-1, WS-4 | append-only; blocks 14 lines apart, genuinely merges |
| `domain/routine-file/edit.ts` | Gate 0, WS-5 | Gate 0 header + verbs; WS-5 rewrites `deleteExercise`'s reason at `:49-52` |
| `features/import/issues.ts` | Gate 0, WS-2 | same wave, sequential inside it |
| `features/import/ExercisesStep.tsx` | WS-2, WS-3, WS-5 | strict WS-2 → WS-3 → WS-5(`:11` only) |
| `features/import/ImportWizard.tsx` | WS-2, WS-3 | strict WS-2 → WS-3 |
| `features/today/TodayScreen.tsx` | WS-2 (`:224-226`), WS-4 (`:161-163`) | distinct blocks ~60 lines apart |
| `db/repositories/{workouts,plannedExercises,placements}.ts` | WS-4, WS-5 | **WS-4 writes the header, WS-5 verifies** — the "read-only" claims must go for WS-4 to ship at all |
| `features/routines/RoutinesScreen.tsx` | WS-2 only | REQ-514 is explicit: WS-2 edits, WS-5 verifies |
| `features/routines/RoutineDetailScreen.tsx` | WS-4, WS-5 | J-3 |

### Generated / Migration / Project / Lockfile Ownership

**None.** No migration, no generated artifact, no project-file or lockfile
change. `src/db/schema.ts`, `domain/backup/document.ts`, `package.json` and
`pnpm-lock.yaml` are frozen (ASM-1). If any wave finds it needs one, that is
stop condition 8 — stop, do not proceed.

## 6. Waves

Each wave delivers something a lifter can observe. Wave 0 is the only exception,
and it produces no code — it is §2 above, already done.

### Wave A — "I can create an exercise the app does not ship with." (WS-1)

- **Requirements:** REQ-100…110, 902, 909 · **Acceptance:** AC-100…111
- **Why first:** zero true upstream (verified), fully observable on its own, and
  its `findExerciseByName` extraction is what unblocks Wave C.
- **Steps:** extract `findExerciseByName` and re-express `resolveFileExercise` on
  it (TST-101 green *before* anything else changes — it is the regression gate)
  → `createUserExercise` + its refusal error → the screen's create affordance →
  header and empty-state copy.
- **Observable:** the lifter creates "Zercher Squat" with a category and it
  appears under that group without a reload; retyping "front squat" is refused
  and points at the catalog entry in one tap.

### Wave B — "I can build a routine without a file." (Gate 0 + WS-2)

- **Requirements:** REQ-001…014, 900, 901, 908, J-2; REQ-200…212, 903, 906(share)
- **Acceptance:** AC-001…014, AC-200…212, AC-421
- **Indivisible.** Splitting it ships §8's second window as a live defect.
- **Steps:** `validate.ts` + `issues.ts` **in one commit** (D-004) → the four
  draft verbs + `blankRoutineFile` → barrel + header → `TextField` in
  `fields.tsx` → `state.ts` (`fileName` out, seed in) → the three entry points →
  the editable name fields and add-Workout control → both abandon guards →
  copy.
- **Observable:** from Today's empty state the lifter taps "Start from scratch",
  names the routine, adds a Workout, picks days, accepts — and the routines list
  says "created", not "imported".
- **AC-421 needs three separate observations:** reload, browser/hardware back,
  and the in-app back. The second is the one `beforeunload` does not cover.

### Wave C — "I can put an exercise into a Workout while I am building it." (WS-3)

- **Requirements:** REQ-300…312, 900(`draftExercise`), 910, 911 ·
  **Acceptance:** AC-300…313
- **Depends on:** A (D-001) and B (D-003 + textual serialization).
- **Steps:** `offer.ts` with `Offer`, `offeredExercises` (resolving each draft
  row *before* de-duplicating — REQ-911), `resolveTypedName`, `draftExercise` →
  `offer.test.ts` including **TST-302 and TST-308**, the load-bearing pair →
  `AddExercise.tsx` → wire into `ExercisesStep`/`ImportWizard` → the
  empty-Workout well.
- **Observable:** the lifter adds an exercise from the catalog, from what they
  created in Wave A, or by typing a new name — and a name that already exists
  reuses it instead of splitting the movement in two.

### Wave D — "I can grow the routine I am already running." (WS-4)

- **Requirements:** REQ-400…417, 905, 907, 912, 913 · **Acceptance:** AC-400…420
- **No true upstream.** Placed here to serialize `db/index.ts` against Wave A
  and `TodayScreen.tsx` against Wave B, and to keep one branch.
- **Steps:** `remainingWeeks` + `claimantsOfDay` with their tests (**TST-402's
  Monday-vs-rolling case pins the formula**) → `planned-exercise-draft.ts` →
  `addWorkoutToRoutine` → `addPlannedExercise` → the two forms with the preview
  and the collision warning → copy at `TodayScreen.tsx:161-163`.
- **Observable:** on an accepted routine the lifter adds a Workout with
  suggested days, sees exactly which dates it will claim and any day another
  Workout already owns, saves, and the placements appear from today forward.
- **TST-417 is this wave's real gate** — it is the only thing making DEC-B safe.

### Wave E — "Nothing the app tells me is a lie any more." (WS-5)

- **Requirements:** REQ-500…516, 906(share) · **Acceptance:** AC-500…517
- **Strictly last.** Six of REQ-512's fifteen sites are headers earlier waves
  must rewrite to ship at all; WS-5 **verifies those in place** and writes only
  what nobody else touched.
- **Steps:** the grep sweep across all fifteen comment sites and seven copy
  blocks → the four rule documents (incl. J-9, J-10) → `CONVERSION_PROMPT` +
  TST-515 → the two carve-outs (J-1, J-8) → PRD §38/§39 rows **and**
  `execution.md`'s final section in the same commit (REQ-516).

### Integration gate — identical at every wave

- **Inspect the actual combined diff**, not the intended one. Confirm no file
  outside that wave's May-Edit column changed.
- Four green: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`.
- Test count never decreases. Baseline 458.
- Map completion to `REQ-*` / `AC-*` / `TST-*`.
- Append this wave's `##` section to `execution.md`, recording **what was
  observed** for every "running the app" AC — not what the code implies.
- Commit by explicit pathspec (§1).

## 7. Single-Agent Fallback

This *is* the plan — §4 selects sequential execution. There is no parallel
variant to fall back from, and no subagent is simulated anywhere in it. The
order is A → B → C → D → E, and it is dependency-safe: D-001 puts WS-1 before
WS-3, D-002 and D-003 put Gate 0 before WS-2 and WS-3, and every remaining edge
is write-set serialization already encoded in the wave order.

If a wave must be abandoned mid-flight, the preceding waves stand on their own:
each ends green, and each delivers observable behavior that does not depend on
the waves after it.

## 8. Requirement Execution Matrix

| Requirements | Wave | Owner | Acceptance | Tests |
|---|---|---|---|---|
| REQ-100…110, 902, 909 | A | WS-1 | AC-100…111 | TST-100…108 |
| REQ-001…014, 900, 901, 908, **J-2** | B | Gate 0 | AC-001…014 | TST-001…015 |
| REQ-200…212, 903, 906(share) | B | WS-2 | AC-200…212, AC-421 | TST-015, 207 |
| REQ-300…312, 910, 911 | C | WS-3 | AC-300…313 | TST-300…309 |
| REQ-400…417, 905, 907, 912, 913 | D | WS-4 | AC-400…420 | TST-400…421, 409 |
| REQ-500…516, 906(share), **J-1, J-8, J-9, J-10** | E | WS-5 | AC-500…517 | TST-515 |

Every requirement in spec §3 has an owner. Every test in §9 has a file and a
writer. Every AC is scheduled.

## 9. Adjudications That Touch a Freeze — Flagged for Review

Two of §2's rulings edit something the spec or a frozen decision declared
untouchable. Both are comment-only and neither changes behavior, but both are
recorded here rather than buried, because the owner may prefer the stale comment
to the carve-out:

- **J-1** — `domain/routine-file/schema.ts:10-13`. §5 lists the file under
  "Must not change". The comment enumerates six semantic checks, is already
  stale at HEAD, and REQ-504 names it as one of three mandatory sites.
  *Alternative if overturned:* drop REQ-504 to two sites and ship the stale
  comment.
- **J-8** — `features/session/ExercisePicker.tsx:4-5`. DEC-Q4 froze this file to
  keep gym mode risk-free. The line's provenance claim becomes false when WS-1
  ships; its "this picks, it does not create" claim stays true, so REQ-311 is
  unaffected. *Alternative if overturned:* leave the sentence and record it as
  known-stale.

## 10. Final Verification

| Check | Covers | Required Evidence |
|---|---|---|
| `pnpm typecheck` | every wave | clean, both tsc projects |
| `pnpm test` | every TST | ≥ 458 + this change's additions, zero skipped |
| `pnpm lint` | layering (`domain/**` imports) | no output |
| `pnpm build` | production bundle | succeeds |
| Running the app | every AC marked "running the app" | `execution.md`, per wave, stating **what was observed** |
| Grep sweep | REQ-512 (15 sites), REQ-513 (7 blocks) | no surviving assertion |
| `git status` | stop condition 10 | `docs/PRD-DMS.md` untouched and unstaged |

Then `verifying-change` against the declared diff range.

## 11. Global Stop Conditions

Spec §14's ten apply unchanged. These are additional and specific to execution:

- A wave's actual diff touches a file outside its May-Edit column.
- Two waves are run concurrently. §4 selected sequential for reasons that do not
  weaken under schedule pressure.
- `validate.ts` is committed without `issues.ts` (D-004) — Gate 0 cannot
  typecheck alone.
- Any wave needs `fixtures.ts`, `schema.ts`'s Zod chains, `db/schema.ts`,
  `BACKUP_VERSION`, `package.json` or `pnpm-lock.yaml`.
- A commit is made without an explicit pathspec while `docs/PRD-DMS.md` is
  staged or untracked.
- WS-5 rewrites TST-500 or TST-501. Both already exist and pass; WS-5 verifies.
- The test count drops below the previous wave's.
- An adjudication in §2 turns out to need a behavior change. It does not — if
  one appears to, the spec is being reinterpreted and that is out of scope.
