# Pre-release polish — Verification

Verdict: **Pass with limits** (self-verified, no independent reviewer)
Size: medium · Reliability: strict · Base: `3f7dd02`, working tree dirty (uncommitted by instruction).

## Checks executed

| Command | Result |
|---|---|
| `pnpm lint` | 0 errors; 1 pre-existing warning (`ImportWizard.tsx:114` exhaustive-deps) |
| `pnpm typecheck` | pass |
| `pnpm test` | pass (all files; new tests in `format.test.ts`, `csv.test.ts`) |
| `pnpm build` | pass (existing chunk-size warning) |

## Requirements

REQ-1/2/3 `format.ts`, `ExerciseView.tsx`, `PreviousPanel.tsx`; tests for `programmingLine`, `setLine` hold, `suggestionLine`.
REQ-4 `TryExampleButton` (Today), button in `FileStep`; example and hint now version 2; `parse.test.ts` updated.
REQ-5 `main.tsx`. REQ-6 `index.html`. REQ-7 `csv.ts` + test. REQ-8 `backup.ts` (existing `exportBackup` tests pass). REQ-9 `README.MD`.

## Not verified

- No UI run: ghost values, dome strip text for non-weight measurements, and the two example buttons were not exercised in a browser; dome/ghost text for long values (e.g. `400 m · 1:30`) may overflow its small cell.
- Transaction atomicity of `exportBackup` is not tested (no concurrent writer test).
- og:image is relative; link-preview scrapers may ignore it until an absolute URL exists.
- `ExerciseView.openingValues` still seeds `weight` from a non-load suggestion; out of scope.
