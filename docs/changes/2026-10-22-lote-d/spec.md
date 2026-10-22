# Lote D (real-season findings) — Spec

Status: Ready for implementation
Size: medium
Reliability: strict
Implementation effort: medium
Base: `b9d7f77`. Artifacts: `audit.md`, `spec.md`, `verification.md`. No plan (one writer), no execution.md (no handoff).
Provenance: exploratory test of Josue's real blocks A and B (18 sessions); product decisions approved by Josue in session (marked DEC).

## Decisions (approved by Josue)
- DEC-9 Progression judges per exercise: an exercise fully performed counts even if its Session is `partial`.
- DEC-10 Import with an active Routine: the wizard warns it will be archived, offers to remove its remaining placements, and takes a start date.
- DEC-10b Placements run exactly `weeks × 7` days from the start date (each weekday occurs `weeks` times). A Monday start is identical to today's output.
- DEC-11 A Workout trained earlier in the same Monday-week than its placement counts that placement as kept (done early).
- DEC-12 Prefill = suggestion on every axis; the suggestion itself is never "off plan".
- DEC-13 The previous Session is judged against the plan it was performed under (its snapshot); one increment step only.
- DEC-14 `focus` and `notes` appear on the in-session exercise screen.
- DEC-C The bloque YAML header text is not touched.
- Defaults taken (not asked): DEC-4 RIR is "not recorded" (`null`), not 0, when nothing supplies it. DEC-5 The new-best banner states the compared metric.

## Requirements
Bugs
- R-1 Reps/RIR fields keep a constant height when a value goes off plan; the Complete button never moves.
- R-2 Opening an in-progress Session lands on its first unfinished exercise (planned: fewer sets than planned and not skipped; unplanned: status `pending`); all finished → last exercise. Chosen once per Session; manual paging is not overridden.
- R-3 "Last backup" age is computed at render time and never negative.
- R-4 `CompletedSet.rir` is `number | null`. Opening RIR = planned min → previous set → `defaultRir` → `null`. Null renders "—" in the stepper; the first stepper tap sets 0 on `+`; `-` on null is a no-op. e1RM treats null as 0; Effort skips null sets (no RIR sets → no Effort tile); CSV writes empty; backup schema accepts null, `BACKUP_VERSION` 3, versions 1–2 still restore.
- R-5 New-best banner states what was beaten: the best estimated max and the previous value (`record.value`, `record.previousValue`), not "beats everything before it" for a set that ties.
- R-6 Summary: reps tile = all reps in the Session; Effort has a one-line explanation; volume tile no longer crowds (min-w-0/shrinking readout); the header status chip is not shown while the finish summary is shown; PREVIOUS panel excludes the in-progress Session's own sets.
- R-7 Progress: exercises ordered most-recently-trained first and the screen opens on the first; the selector has a search field; the chart opens at the latest session for every exercise switch, the first x label is not clipped; a constant series gets integer-friendly ticks.
- R-8 Wizard "Days and weeks": no stray spinner glyph (reproduce first); tapping an out-of-month calendar day navigates to that month; the restore toast names the real file `trainlog-before-restore-<date>.json`.

Product rules
- R-9 (DEC-9, DEC-13) `suggestLoad` takes the newest Session that is `completed`, or `partial` with this exercise `performed` and `sets.length ≥ its snapshot plannedSets`; target sets/max come from that Session's own snapshot (current exercise's target only if the snapshot is unplanned); the rule and increment come from the opening exercise. `in_progress` never feeds it.
- R-10 (DEC-10, DEC-10b) Accepting a Routine: wizard step shows the active Routine name and an explicit, unchecked-by-default option to remove its placements dated ≥ today that have no matching Session (same `workoutId` + local date); a start-date input (`min` = today, default today). `importRoutine` does the removal in the same transaction. `generatePlacements` covers `[anchor, anchor + weeks×7)`; `remainingWeeks` and the new Routine's `createdAt` follow the start date.
- R-11 (DEC-11) `isMissed`/`placementState`/`tallyMonth`: a past placement is kept when a Session of its Workout exists in the same Monday-week on an earlier date not already consumed by an exact-date placement; such a Session is not counted "unplanned".
- R-12 (DEC-12) Rep/time/distance opening values use the suggestion value; the primary-axis target window's upper bound is `max(plannedMax, suggestion.value)`.
- R-14 (DEC-14) ExerciseView shows the PlannedExercise's `focus` and `notes` (read live via `plannedExerciseId`); nothing for unplanned exercises. No snapshot, no schema change.

## Contracts
- Backup document v3: `rir` nullable. Older apps reject v3 files (accepted; restore already rejects higher versions).
- No Dexie migration. Historic `rir: 0` stays.
- `importRoutine(draft, placements, options?)` gains `{ removePlacementsOfRoutineIds }`-style option (shape chosen in implementation, db layer only).
- Docs synchronised: AGENTS.MD (progression invariant), PRD §29 and the missed-placement wording, CONTEXT.md if a term is added.

## Acceptance
- AC-1 (R-1) at 390px, typing an off-plan reps/RIR and blurring leaves the Complete button's position unchanged; one tap logs the set (browser).
- AC-2 (R-2) reload mid-session opens on the first unfinished exercise (test of the pure picker + browser).
- AC-3 (R-3) after export the age reads "today"/0 days (test of the pure formatter).
- AC-4 (R-4) tests: opening values with no plan/previous/default give null; logSet with null round-trips db, backup v3 and CSV; v2 backup restores; e1RM and Effort with null.
- AC-5 (R-5) test: an 80×8 tie at higher RIR yields a banner string naming the estimated max and previous value.
- AC-6 (R-6) tests: total reps across weighted sets; PREVIOUS excludes the current session.
- AC-7 (R-7) tests: recency ordering; flat-series ticks; chart scroll at latest in browser.
- AC-8 (R-8) calendar out-of-month tap changes month (browser); toast text test.
- AC-9 (R-9) tests: partial Session with the exercise fully performed advances; partially performed does not; 4×8 under old plan vs 5-set new plan advances one step; unplanned snapshot falls back; in_progress excluded.
- AC-10 (R-10) tests: accept with removal deletes only future, Session-less placements of archived routines; without the option leaves them; generatePlacements Wed start gives each weekday `weeks` times and Monday start equals old output; `remainingWeeks` consistent.
- AC-11 (R-11) tests: Upper Monday covers Tuesday placement; two same-week placements of one Workout consume correctly; tally does not count it unplanned; a different Workout does not cover.
- AC-12 (R-12) tests: opening values equal the suggestion for bodyweight_reps/duration; suggestion within the window is not off plan; a value above the suggestion is.
- AC-13 (R-14) focus/notes visible in the session exercise screen (browser).
- AC-14 `pnpm lint`, `typecheck`, `test`, `build` pass; the real-routine scenario is re-run for touched flows and recorded in `verification.md`.

## Out of scope
Rewriting historic RIR 0 rows; changing the YAML files; a seventh day state in the calendar; multi-step load jumps when a rep window drops.

## Stop conditions
Stop and ask if: backup v3 breaks existing restore tests in a way that needs format redesign; the spinner glyph cannot be reproduced (then record it as not reproduced, do not guess); `remainingWeeks` change breaks AddToRoutine semantics beyond the tests.

## Done when
All ACs pass and the prueba-real scenario (scripts in the scratchpad `prueba-real`, other port than 5190) shows items 1, 2, 3, 6, 7, 8, 12 fixed in the real UI.
