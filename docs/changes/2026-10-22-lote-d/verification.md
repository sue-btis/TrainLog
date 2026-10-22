# Lote D (real-season findings) — Verification

Verdict: Pass with accepted limitations (independent review pass 1 = Fail on F-1/F-2/F-3, fixed and re-checked by the writer; no second independent pass). Acceptance by Josue: pending.
Base: `b9d7f77`; changes uncommitted in the working tree.

## Checks run (final state)
| Check | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm lint` | 0 errors; 2 warnings, both the pre-existing `ImportWizard.tsx` exhaustive-deps (one in `.claude/worktrees` copy) |
| `pnpm test` | 951 passed / 41 files (917 at start) |
| `pnpm build` | pass |

## Independent review (reviewer agent, pass 1)
Fail on F-1 (restore toast ignored returned file name), F-2 (Workout added before a future start date anchored at today), F-3 (PREVIOUS filter untested). All three fixed: toast uses the returned name and omits the clause when no file was downloaded; `addWorkoutToRoutine` and `AddToRoutine` anchor at the later of today and block start (test: `workouts.test.ts`); `withoutSession` in `domain/history.ts` with test. PRD step 2 and routine start wording synced.

## Real-UI scenario (Playwright, Chrome, 390×844 touch, fake clock, dev server :5291, reduced season of blocks A→B)
PASS: R-1 Complete button box identical before/while/after blur and a single tap logs; R-2 reload reopens on first unfinished exercise; R-3 "Last backup today"; R-4 no-RIR exercises open "—", IndexedDB/CSV null/empty, backup v3; R-5/R-6 reps tile 410 = hand sum, effort hint, tiles do not overlap at 390/320, no red chip with `finished=1`, PREVIOUS has no own-session BEST SET; R-7 opens on most recent exercise, search works, chart scrollLeft at max incl. after switching exercise, flat ticks 11/12/13, first label not clipped; R-8 out-of-month tap navigates, toast names `trainlog-before-restore-<date>.json`; R-9 pull-up 10 kg×8×4 in a partial session → next suggests 12.5; R-10 start 11-11 gives 16 placements, 4 per weekday, unchecked option leaves A (10 shared dates), checked gives 0 duplicates keeping past/Session-answered ones; R-11 Upper trained Monday leaves Tuesday "planned", an uncovered placement still "missed"; R-12 Back Extension 14 / Tuck Planche 25 s open at suggestion with no OFF; R-14 focus/notes shown.

Found by the scenario and fixed afterwards (re-verified):
- 320px: `· OFF` made the reps/RIR row overflow (scrollWidth 343→452). Fix `min-w-0` on the Field wrapper; re-run at 320: scrollWidth stays 320 with reps and RIR off plan.
- Banner redundancy ("14 reps · 14 reps · was 12 reps"): `recordClaim` now states only "was X" for non-estimated-max axes (tests updated).
- Wizard kept an 80px scroll offset between steps (the "stray glyph" was intro text under the translucent header, not a spinner): `goToStep` scrolls to top; re-run: scrollY 0.

## Not verified / accepted limitations
- Restore safety-file actual download not captured (toast text only); lb units not exercised.
- R-5 tie case ("80×8 again") verified by unit test of `recordClaim`/records, not in the browser.
- Monthly calendar tally filters to the month while the grid does not: a done-early session crossing a month border can read missed/unplanned in the tally (decision F-4, pending Josue).
- A routine with a future start date is labelled "created <start>" in the routines list (RoutinesScreen).
- Observation, not changed: Front Squat opened at 66 kg × 4 reps (below its 5–8 window) without an OFF flag — comes from previous-set prefill, not this change.
- Mutation testing not run.
