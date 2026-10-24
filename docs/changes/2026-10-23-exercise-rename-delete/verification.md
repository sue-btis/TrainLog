# Rename and delete user exercises — Verification

Verdict: Pass (independent reviewer: Pass with findings F-1, F-2; both fixed and re-checked by the writer). Acceptance by Josue: accepted 2026-10-23.
Base: `c2f6c67` (`origin/development`); changes uncommitted on `feat/exercise-rename-delete/Josue`.
Size: medium. Reliability: strict.

## Checks run (final state)
| Check | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm lint` | 0 errors; 2 warnings, both the pre-existing `ImportWizard.tsx` exhaustive-deps |
| `pnpm test` | 986 passed / 43 files (adds alias matching, rename, delete, backup and wizard tests) |
| `pnpm build` | pass |

## Independent review (reviewer agent, medium)
Confirmed from code: matching precedence (catalog → current user names → aliases); one wizard offer per user exercise; collision rules for catalog names, other current names and aliases; delete transaction covers every table it reads and Placements carry no `exerciseId`; restore `bulkAdd`s parsed rows so `previousNames` survives; no Dexie version bump needed.

| ID | Finding | Resolution |
|---|---|---|
| F-1 | Typing a former name in the wizard's picker was labelled "new" although import binds it to the renamed exercise. | `resolveTypedName` falls back to user offers' `previousNames`; test added. `createUserExercise` returning the renamed exercise for an old name was judged correct and kept. |
| F-2 | No test for a casing-only rename. | Test added: casing changes, no alias recorded. |

## Real-UI scenario (dev server :5235, 375×812, real clicks)
Imported Bloque C; seeded an unused user exercise "Typo Curl".
- AC-3 refusal: Delete → Delete it on Bayesian Curl (in the routine) showed "This exercise has logged sessions or is part of a routine, so it cannot be deleted. Renaming it is safe." and kept it.
- AC-1: renamed to "Bayesian Cable Curl"; row shows "also matches Bayesian Curl on import". Re-importing Bloque C (which still says "Bayesian Curl") left the exercise count at 11 → 11, with the alias stored.
- AC-3 delete: Delete → Delete it on "Typo Curl" removed it. No console errors.
- AC-5: catalog rows show no name field or Delete.

## Not verified / accepted limitations
- No full backup restore round-trip test; covered at schema level plus the restore path's pass-through.
- Not checked on a phone.
