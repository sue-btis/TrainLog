---
target: branch change/routine-authoring — the routine-authoring surface
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-25T16-32-34Z
slug: src-features-routines-addtoroutine-tsx
---
⚠️ DEGRADED: single-context (harness rule in this session forbids spawning sub-agents unless the user asks; A and B were run sequentially — A's judgment was formed and written before the detector was read)

Target: `src/features/routines/AddToRoutine.tsx` and the routine-authoring surface it belongs to (branch `change/routine-authoring`, 12 commits vs `master`). Mode: **Operate**.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | `AddWorkoutForm` previews the exact write and then reports what was actually written; `AddPlannedExerciseForm` confirms nothing — it just closes. |
| 2 | Match System / Real World | 2 | "movement" is on CONTEXT.md's `_Avoid_` list for **Exercise**, and this branch makes it the primary noun of two new pickers. |
| 3 | User Control and Freedom | 3 | Every new form has Cancel and forgets its draft; the popstate sentinel catches hardware back. Two forms can be open at once on Routine detail. |
| 4 | Consistency and Standards | 2 | Three add-forms shipped in one branch with three different conventions (list cap, autofocus, field components, weekday control). |
| 5 | Error Prevention | 3 | Entered targets go through the same `validateRoutineFile` the file path uses — no second rulebook. But a blank draft opens accusing the lifter of 2 problems. |
| 6 | Recognition Rather Than Recall | 2 | The wizard picker renders 96 flat rows (4608px of scroll in a 288px window) with no count and no grouping — while `groupExercises` already exists in the domain. |
| 7 | Flexibility and Efficiency | 2 | No autofocus on either picker, no Enter-to-commit, and adding six exercises means six reopen-and-scroll cycles. |
| 8 | Aesthetic and Minimalist Design | 3 | Detector clean, zero contrast failures on the composed screen, copy restrained and specific. Ragged 3-row weekday wrap and double-open forms cost it a 4. |
| 9 | Error Recovery | 3 | `useAsyncAction` failure lines carry `role="alert"` throughout; the name collision reports "already exists" with a route to it rather than an error. |
| 10 | Help and Documentation | 3 | The increment explainer, the shipped example YAML, and the catalog/yours/in-this-routine provenance labels are genuinely good teaching. |
| **Total** | | **26/40** | **Solid engineering, drifting craft** |

## Design Specificity Verdict

**LLM assessment.** This is authored, not assembled. The collision warning on `AddToRoutine.tsx:191-200` does something almost nothing ships: it states the *recurring weekly cost* of a decision rather than just naming the conflict. The provenance column in `AddExercise.tsx` (catalog / yours / in this routine) is a product-specific answer to a product-specific confusion. The `popstate` sentinel in `ImportWizard.tsx` exists because someone thought about a one-handed phone and the hardware back button. None of that is category-interchangeable.

What is interchangeable is the **exercise picker** — a flat alphabetical scroller, the most generic possible answer, shipped twice in one branch with two different caps. This app already knows how to present a catalog: the Exercises screen groups by category and opens closed. Both new pickers ignore that.

**Deterministic scan.** `detect.mjs` over `src/features` (`.tsx`/`.ts`): **0 findings, exit 0**. Composed-screen contrast audit over every leaf text node on Routine detail with both new forms open: **0 WCAG AA failures**. The 48px control floor holds — every weekday pill measured 48px tall.

**Visual overlays.** Not available. The Browser pane never composited in this session, so screenshots and click-driven inspection failed; the flow was walked end to end via `read_page`, `get_page_text` and scripted DOM measurement instead. No user-visible overlay exists — do not expect one in a tab.

**Build health:** `pnpm typecheck` clean, `pnpm lint` clean, `pnpm test` 552 passed / 34 files.

## Overall Impression

The reasoning in this branch is better than the interface it produced. Every comment names a rejected alternative and a requirement; the domain boundary is respected (`offeredExercises` decides what may be offered, the component only draws it); nothing here rewrites stored data. That is real discipline.

The single biggest opportunity: **the branch added three ways to name an exercise and never made them the same thing.** A lifter meets a 96-row unbounded list in the wizard, a 40-row capped list with a "56 more" tail on Routine detail, and an autofocused free-text field on the Exercises screen — for one conceptual act. Unify those three and the score moves five points without a new idea.

## What's Working

1. **The consequence-before-commit pattern in `AddWorkoutForm`.** `emptyReason` has three branches, and the third — "every remaining Monday has already gone by in this block" — is the one that would normally ship as "no day selected" while Monday sits lit in `aria-pressed` above. Saying the true reason instead of the convenient one is the hardest thing on this list to get right.
2. **The validator is not duplicated.** `plannedExerciseDraftFile` builds a synthetic routine file so the form's targets go through `validateRoutineFile` — the same rules the YAML path runs. A second rulebook for a second entry point is how two paths silently diverge, and this branch refused it.
3. **The collision outcome on the Exercises screen is a statement, not an error.** "Back Squat already exists, so nothing was created" plus an **Open it** link. Nothing went wrong, so nothing reads as red — and the lifter lands where they meant to go anyway.

## Priority Issues

### [P1] The binding glossary is losing to the new copy

**Why it matters.** AGENTS.MD: "Name things as CONTEXT.md names them, in identifiers as well as in prose." PRODUCT.md: "The glossary outranks the world." CONTEXT.md, `Exercise`: `_Avoid_: Lift, movement, activity`. On `master` there was exactly **one** user-facing "movement" (`MoreScreen.tsx:44`). This branch adds five more and makes it the primary noun of both new pickers: "Search, or type a new movement", "Add \"X\" as a new movement", "adding it will use that movement", "Search the catalog and your movements", "Only movements that already exist".

Separately, six new strings call a Placement a Session — "3 sessions will be placed", "no sessions will be placed" (×3), "Workout added, with N sessions placed", "move or delete that session on the calendar". CONTEXT.md: a Session is *one performed training*; the thing generated onto a date is a **Placement**. This one is inherited from `ImportWizard`'s accepted summary on `master`, so it is consistent drift rather than new drift — but the branch multiplied it sixfold in the one place where a lifter is being told what a write will do.

**Fix.** Replace user-facing "movement" with "exercise" throughout `AddExercise.tsx`, `AddToRoutine.tsx` and `ExerciseCatalogScreen.tsx`. Then decide the Placement question deliberately: either fix the vocabulary everywhere or amend CONTEXT.md to say the UI calls a Placement a planned session — but write the decision down, because right now the code and the glossary disagree and the glossary claims to win.

**Suggested command:** `/impeccable clarify`

### [P1] The wizard's exercise picker is 96 unbounded rows

**Why it matters.** Measured live: the `Exercises you can add` group in `AddExercise.tsx` renders **96 sibling buttons, `scrollHeight` 4608px inside a 288px viewport** — sixteen screens of flat alphabetical scroll, no count, no grouping, no "N more" tail. Its sibling `AddPlannedExerciseForm` caps at 40 and says "56 more — search to narrow the list". Same branch, same act, two answers, and the wizard got the worse one.

The usage scene is a phone, one hand, and this is the Wall of Options at full height. Worse, the app *already solved this*: `groupExercises` lives in `@/domain/catalog` and the Exercises screen opens on collapsed category groups precisely because "two hundred movements in one scroll is a wall" — its own file comment says so.

**Fix.** Give `AddExercise` the same `SHOWN` cut and hidden-count tail its sibling has, as the floor. Better: run both pickers through `groupExercises` so an empty query shows collapsed categories and typing flattens to matches. One picker component, used twice, with a `canCreate` boolean — the flag that decides *presentation* is not the flag `DEC-Q4` refused, which was the one deciding whether a lifter can mint an Exercise.

**Suggested command:** `/impeccable distill`

### [P2] A blank draft opens by accusing the lifter

**Why it matters.** `/import?new=1` renders, before a single keystroke: an error line under the name field ("This routine has no name. Give the routine a name."), an empty-state well, and an action bar announcing "**2 problems still block this routine**" with a live-region status saying the same. The lifter pressed "Start from scratch" two seconds ago. Nothing is wrong yet — they have not had a chance to be wrong.

This is the emotional low point of the whole new flow, and it lands in the first 300ms of it. It also trains the lifter to read the issue counter as decoration, which is the one control that has to stay credible through step 2.

**Fix.** Suppress semantic issues on a from-scratch draft until the field has been touched or `Next` has been pressed — the issues still block Accept, they just do not greet. `validateRoutineFile` stays untouched; this is a presentation gate in `ExercisesStep`/`ActionBar`, not a validation change.

**Suggested command:** `/impeccable onboard`

### [P2] Step 2 still speaks as if a file wrote it

**Why it matters.** The branch did careful work removing file-language from the wizard — `Discard this import?` → `Discard this draft?`, `Importing` → `Saving`, titles, the accepted chip. Step 2 was missed. On an authored routine it reads: *"These are the days this routine suggests. Change them if your week looks different."* Nothing suggested anything — the lifter is looking at seven unpressed days on a Workout they named ninety seconds ago. The sentence describes a file that does not exist, in the same voice the rest of the branch just fixed.

**Fix.** Make the line conditional on whether any Workout carries a suggested day, not on the draft's origin (the branch deliberately stopped recording origin, and that decision is right). With days: keep it. Without: "Choose the days each Workout should fall on. You can move them on the calendar later."

**Suggested command:** `/impeccable clarify`

### [P2] Three new forms, three sets of house rules

**Why it matters.** Shipped together, in one branch:

| | wizard `AddExercise` | routine `AddPlannedExerciseForm` | catalog `NewExercise` |
|---|---|---|---|
| list cap | none (96) | 40 + "N more" | n/a |
| autofocus | no | no | yes |
| text field | `fields.tsx` `TextField` | `fields.tsx` `TextField` | raw `<label>` + `<Input>` |
| select | n/a | `fields.tsx` `SelectField` | its own `VocabularyField` |

`AddToRoutine.tsx` (in `features/routines/`) already imports `fields.tsx` from `features/import/` — so the cross-feature import is a path this branch has accepted. `ExerciseCatalogScreen` then declined it and hand-rolled a near-duplicate `VocabularyField` instead. Pick one. Weekday selection has the same problem: the wizard uses a 7-column `MON TUE WED` grid, `AddWorkoutForm` uses seven full-name pills that wrap into three ragged rows (measured widths 74–113px) on a 375px viewport.

**Fix.** Move `fields.tsx` to `features/ui/` (it is no longer the import wizard's), delete `VocabularyField` in favour of `SelectField`, autofocus every search/name field the same way, and reuse the wizard's day grid in `AddWorkoutForm`.

**Suggested command:** `/impeccable extract`

## Persona Red Flags

**The lifter, mid-gym, one hand, between sets** (PRODUCT.md's fixed scene). Adding an exercise to today's Workout from Routine detail means: open the card, press *Add an exercise*, then thumb through up to 40 rows in a 256px window, then fill **eight** fields in a 2-column grid — sets, rest, min reps, max reps, min RIR, max RIR, unit, increment — with no defaults visible as defaults and no way to commit from the keyboard. Six of those eight are optional or already correct. This is a kitchen-table task wearing a gym-screen's clothes, and nothing tells the lifter they can skip straight to *Add exercise*.

**Jordan (First-Timer).** Presses "Start from scratch" and is told they have 2 problems. Then meets a picker whose placeholder says "Search, or type a new movement" — a word the app uses nowhere else in its own vocabulary — over 96 unlabelled rows. Then, on Routine detail, can open the add-exercise form and the add-workout form simultaneously and see four buttons (*Add exercise*, *Cancel*, *Add Workout*, *Cancel*) with no visual signal that they belong to different pending writes.

**Alex (Power User).** Building a 4-workout, 24-exercise block here costs 24 picker-open + scroll + 8-field cycles with no autofocus, no Enter-to-commit, and no duplicate-last-exercise. Alex will write the YAML by hand, which is fine — but then the from-scratch path exists for Jordan, and Jordan is the one it treats worst.

## Minor Observations

- `AddPlannedExerciseForm` returns no confirmation on success; its sibling `AddWorkoutForm` sets `written` and reports the count. The new row does appear (live query), but the asymmetry between two forms on the same screen is arbitrary.
- Nothing prevents both forms on Routine detail being open at once. `open` state is local to each.
- `TextField`'s `placeholder` frequently equals the value the lifter typed (workout name "Push", placeholder "Push"), so the field's filled and empty states are indistinguishable at a glance in exactly the case the placeholder was chosen for.
- The weekday toggle group in `AddWorkoutForm` has a `<span className={LABEL}>suggested days</span>` that is not programmatically associated with the seven `aria-pressed` buttons. A `role="group"` + `aria-labelledby` costs two attributes.
- `AddWorkoutForm`'s success line ("Workout added, with N sessions placed") renders above the collapsed button and never dismisses — it will still be there next time the lifter opens the screen's form.

## Questions to Consider

- If `groupExercises` is right for browsing 96 exercises, why is a flat list right for choosing one of them?
- The branch removed the draft's origin from state on purpose — and it was right. So why does any copy in the wizard still know where the draft came from?
- What would this look like if adding an exercise to a Workout took *one* decision instead of nine? Which of those eight target fields does the lifter actually change from the seeded 3×8–12?
- The glossary claims to outrank the visual world. Does it outrank the copywriter's ear too — and if "movement" reads better than "exercise", is the finding a copy bug or a CONTEXT.md bug?
