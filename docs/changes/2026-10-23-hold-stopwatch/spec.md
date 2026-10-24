# Hold stopwatch

Status: Ready for implementation
Size: quick
Reliability: lean
Implementation effort: medium
Triggered artifacts: none

Goal: while logging a set that records seconds, the lifter can start a stopwatch,
is cued at the planned minimum and maximum, and stopping it writes the elapsed
seconds into the set; the lifter still confirms the set with Complete set. HIIT
is programmed as a Workout (a duration exercise, sets = rounds, `rest_seconds` =
rest), so stopwatch + the existing rest timer cover intervals with history.

Evidence facts:
- Entry point: `src/features/session/SetLogger.tsx:184` (the `seconds` Field inside `SetFields`; `SetLogger` at `:278` renders it while logging).
- Covering tests: `src/features/session/SetLogger.test.ts` (pure helpers), `src/domain/session/index.test.ts` (`restRemaining`, the clock-derived precedent). No component tests: UI is verified by running it (AGENTS.MD).
- Consumers of altered contracts: no contract altered. `durationSeconds` on `SetValues`/`CompletedSet` already exists; Dexie, backup and routine-file schemas are untouched.

Decisions (Josue, 2026-10-23):
- DEC-1 Stopwatch counts up (not a countdown); cues at target min and max.
- DEC-2 HIIT is a Workout, not a standalone interval tool.

Scope:
- Include: stopwatch in `SetLogger` whenever the measurement collects `durationSeconds`; elapsed derived from a start timestamp against the wall clock (same correctness rule as §11.6); cue = vibration and/or sound per the existing timer settings, once per threshold; Stop writes whole elapsed seconds into `durationSeconds`; the beep helper moves out of `RestTimer.tsx` so both timers share it.
- Include: `docs/bloque-c-estetica-hibrida.yaml` gains a Saturday `Cardio HIIT` Workout and a closing incline-walk exercise on both leg Workouts.
- Exclude: standalone interval screen; persisting a running stopwatch across reloads (component state, per AGENTS.MD); notifications; new measurement types; stopwatch in `SetEditor` (editing a past set).

Acceptance:
- AC-1 A duration-axis set (e.g. Planche Lean 15–30 s) shows Start; after Start the readout counts up m:ss from 0.
- AC-2 Reaching 15 s cues once; reaching 30 s cues once more; no repeat cues.
- AC-3 Stop writes the elapsed whole seconds into the seconds field; Complete set logs it; the rest timer starts as today.
- AC-4 Elapsed stays correct after the tab is hidden and shown again (derived from the start timestamp).
- AC-5 Reps-only exercises show no stopwatch; the seconds field stays editable by hand.
- AC-6 The bloque C file still parses, validates clean and maps (existing block tests).

Change surface:
- Expected: `src/domain/session/index.ts` (+test) for `stopwatchElapsed`; new `src/features/session/HoldStopwatch.tsx`; new `src/features/session/cue.ts` (beep + vibrate); `RestTimer.tsx` (use shared cue); `SetLogger.tsx`; `docs/bloque-c-estetica-hibrida.yaml`.
- Do not touch: Dexie schema, backup schema, routine-file schema, progression, `SetEditor`.

Canonical design:
- Affected authorities: `docs/PRD.md` §11.6 (timer correctness) is preserved, not changed.
- Required synchronization: none.

Quality:
- Tests: `stopwatchElapsed` unit test; existing routine-file block tests.
- Static/build: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- QA: dev server, start a session on a duration exercise, run the stopwatch past min and max, stop, complete.

Done when: in the running app a Planche Lean set is timed with the stopwatch, stopped, and logged with the elapsed seconds, and the rest timer starts.

Implementation:
1. `stopwatchElapsed` + test.
2. Shared cue module; RestTimer uses it unchanged in behavior.
3. `HoldStopwatch` rendered by `SetLogger`.
4. YAML Workout for HIIT and walk.
5. Checks and browser walkthrough.

Stop if:
- Wiring settings requires changing a stored contract.
- The stopwatch would need to survive a reload to be usable.
