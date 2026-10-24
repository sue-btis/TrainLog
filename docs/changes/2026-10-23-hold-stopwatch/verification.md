# Hold stopwatch — Verification

Verdict: Pass (writer verification, lean profile; no independent review). Acceptance by Josue: accepted 2026-10-23.
Base: `e3f1428`; changes uncommitted on `feat/hold-stopwatch/Josue`.

## Checks run
| Check | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm lint` | 0 errors; 2 warnings, both the pre-existing `ImportWizard.tsx` exhaustive-deps |
| `pnpm test` | 964 passed / 42 files (adds `stopwatchElapsed`, `holdCuesReached`; bloque C joins the shipped-block tests) |
| `pnpm build` | pass |

## Real-UI scenario (dev server :5233, 375×812, built-in browser)
Imported `docs/bloque-c-estetica-hibrida.yaml` through the wizard: 5 Workouts including `Cardio HIIT`, accepted clean. Session on Pierna B:
- AC-5: Pogo Jumps (reps) shows no stopwatch.
- AC-1: Horse Stance Hold (2 × 30–60 s) shows `0:00 STOPWATCH` + Start; after Start it read `0:01 HOLDING`.
- AC-2 / AC-4: `Date.now` offset to simulate a locked phone: +31 s read `0:32 IN RANGE` with one cue; +61 s read `1:03 TARGET REACHED` with a second cue; a further second stayed at two cues (`navigator.vibrate` counted).
- AC-3: Stop wrote 64 into the seconds field; Complete set stored `durationSeconds: 64` in `completedSets` and the rest timer opened at `0:29 · Horse Stance Hold`.
- No console errors.

## Visual pass (after Josue: "funciona pero no se siente del sistema")
Restyled to DESIGN.md: idle is a raised card-white row (pressable) with a planned-blue icon cell and the window in planned ink; running is a solid `live-ink` band (Live = what is happening now) with Clock type, the rest timer's scrim track and `live-rail` fill, and a white tick at the window's minimum. The whole band is the Stop target. Screenshots taken at 375×812 in both states; label stays on one line.

## Not verified / accepted limitations
- Wizard steps and buttons were driven by script clicks; tap feel was not checked on a device.
- Sound cue not exercised (setting off by default); vibration checked via a stub, not on a device.
- Real phone lock not exercised; covered by the wall-clock derivation and its unit test.
- A running stopwatch is lost on reload or when leaving the exercise (by design, spec exclusion).
