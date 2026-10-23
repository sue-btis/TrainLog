# Compare an exercise across routines — Verification

Verdict: Pass (writer verification, lean profile; no independent review). Acceptance by Josue: accepted 2026-10-23.
Base: `9b9bc24` (`origin/development`); changes uncommitted on `feat/block-comparison/Josue`.

## Checks run
| Check | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm lint` | 0 errors; 2 warnings, both the pre-existing `ImportWizard.tsx` exhaustive-deps |
| `pnpm test` | 958 passed / 42 files (adds three `routineBlocks` tests) |
| `pnpm build` | pass |

## Real-UI scenario (dev server :5234, fresh database, 375×812)
Imported Bloque A, logged one Weighted Pull Up set (0 kg × 18) and finished as partial; imported Bloque B, logged 10 kg × 6. Progress → Weighted Pull Up shows "by routine" with two rows, oldest first:
- AC-1: `Bloque A - Acumulación` · Fri, Oct 23 · 1 session · `4×5–8 · RIR 2 · rest 180s` · best 0 kg × 18; `Bloque B - Intensificación` · `4×3–6 · RIR 1 · rest 210s` · best 10 kg × 6. Plans match each file's snapshot.
- A single-day block shows one date, not a repeated range.
- No console errors. Screenshot taken.

AC-2 (two prescriptions in one Routine), AC-3 (Sessions without sets ignored) are covered by unit tests, not exercised in the browser. AC-4 (single Routine hides the list) follows from the `blocks.length > 1` guard; not exercised in the browser. AC-5 holds by construction: rows read `PlannedExerciseSession` snapshots only.

## Not verified / accepted limitations
- Not checked on a phone.
- Rows show the Routine's current name; renaming a Routine is not possible today, so this is not yet a history concern.
