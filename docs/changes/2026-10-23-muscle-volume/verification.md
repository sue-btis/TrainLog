# Weekly volume per muscle — Verification

Verdict: Pass (writer verification, lean profile; no independent review). Acceptance by Josue: accepted 2026-10-23.
Base: `6d162ec` (`origin/development`); changes uncommitted on `feat/muscle-volume/Josue`.

## Checks run
| Check | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm lint` | 0 errors; 2 warnings, both the pre-existing `ImportWizard.tsx` exhaustive-deps |
| `pnpm test` | 969 passed / 43 files (adds four `weeklyVolume` tests and one `listWeekVolume` repository test) |
| `pnpm build` | pass |

## Real-UI scenario (dev server :5235, fresh database, 375×812)
Imported Bloque C on Friday 2026-10-23, so this week holds two Placements: Pierna B (Fri) and Cardio HIIT (Sat). Logged two Pogo Jumps sets. Progress opens with "sets this week":
- Quadriceps 0/8 (Box Jump 3, Leg Press 3, Horse Stance 2), Hamstrings 0/6, Glutes 0/3, Calves 2/5, Shoulders 0/3, Core 0/3, Full body 0/7 (walk 1, sprint 6). Matches a hand count of the file.
- Logged sets fill green over the planned blue-wash track on one shared scale. No console errors. Screenshot taken.

AC-3 (unknown category goes to "other") and AC-5 (no active Routine) are covered by unit tests or by construction; Bloque C has no unknown category, so the "other" list was not seen in the browser.

## Layout pass (after Josue: "ocupa mucho espacio")
Progress now has a full-width two-segment bar, `Exercises` (the previous screen, default) and `This week`; the volume no longer pushes the exercise picker down. Each muscle is one line — name, bar, `logged/planned` — about half the earlier height. At 375×812 the seven Bloque C rows fit above the fold. A week with nothing planned or logged shows an empty state instead of an empty card.

## Not verified / accepted limitations
- Mobility holds and cardio count as sets of their category (Horse Stance as quadriceps, treadmill as full body); there is no notion of "not hypertrophy work" yet.
- A row counts toward its own category only; presses do not add fractional sets to triceps.
- Only the current week; no history.
- `feat/block-comparison/Josue` also edits `ProgressScreen.tsx` imports; merging the second of the two will need a small conflict resolution.
