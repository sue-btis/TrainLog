# Storage warning on Today — Verification

Verdict: Pass (writer verification, lean profile). Acceptance by Josue: accepted 2026-10-24.
Base: `3cd4199` (`origin/development`); changes uncommitted on `feat/storage-warning/Josue`.

## Checks run
| Check | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm lint` | 0 errors; 2 warnings, both the pre-existing `ImportWizard.tsx` exhaustive-deps |
| `pnpm test` | 986 passed (no new tests: UI-only) |
| `pnpm build` | pass |

## Real-UI scenario (dev server :5235, 375×812)
- AC-1: browser tab (`persisted()` false, not standalone) — Today shows "Add TrainLog to your home screen" in a planned-blue band above the date. Screenshot taken.
- AC-2 / AC-3: `matchMedia('(display-mode: standalone)')` and `navigator.storage.persisted` were stubbed, then Today remounted: installed + not persisted → "This browser may clear your training"; installed + persisted → no warning.

## Not verified / accepted limitations
- Not checked inside an installed PWA on a phone; states 2 and 3 were simulated.
