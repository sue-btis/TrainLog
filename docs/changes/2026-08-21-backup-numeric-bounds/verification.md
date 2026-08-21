# Backup numeric bounds — Verification

Verdict: **Pass**
Size: medium
Reliability: critical

## Audit Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Declared base | `d82392d` |
| Audited head / working tree | `d82392d`, dirty on `change/exercise-catalog` |
| Diff range | `git diff d82392d` — two tracked files — plus this change's untracked docs folder |
| Unrelated work in range | None |
| Verification date | 2026-08-21 |

## Requirement Compliance

| Req / AC | Implementation Evidence | Independent Check | Result |
|---|---|---|---|
| R-1 / AC-1 | every numeric field routed through `count`, `positiveCount`, `measure` or `timestamp` | `grep "z.number()"` returns **only the four definitions** — no bare numeric field remains anywhere in the schema. 24 refusal tests, red before the change | Pass |
| R-2 / AC-2 | Zod paths untouched | each refusal asserts the field name appears in the formatted path | Pass |
| R-3 / AC-3 | `.min(0)` is inclusive | `0 kg × 0 reps @ RIR 0` accepted; `-0.5` and `-1` refused | Pass |
| R-4 / AC-4 | no `.max()` in the file | `rir: 12`, `reps: 500`, `maxRir: 50` all accepted. Independently confirmed against the writer: `Field` clamps at zero and caps nothing ([`SetLogger.tsx:170,177`](../../../src/features/session/SetLogger.tsx)) | Pass |
| R-5 / AC-5 | `positiveCount` used exactly once | **Both writers traced independently.** `ExerciseView.tsx:91` is the only producer — `const setNumber = sets.length + 1`, so never below 1 — and `removeSet` renumbers survivors to `index + 1` ([`session/index.ts:381`](../../../src/domain/session/index.ts)), also 1-based. `setNumber >= 1` cannot refuse app-produced data | Pass |
| R-6 / AC-6 | — | The round-trip at [`backup.test.ts:224`](../../../src/db/repositories/backup.test.ts) — `exportBackup` over a populated fake-indexeddb, then `parseBackup` — **passes** in the re-run. This is the control that matters and it was executed | Pass |
| R-7 / AC-7 | fuzz file untouched | `schema.fuzz.test.ts` is absent from the diff and passes | Pass |
| R-8 / AC-8 | optional-field rule untouched | the pre-settings backup cases still pass | Pass |
| R-9 / AC-9 | — | `BACKUP_VERSION` untouched; no file under `src/db/` in the diff | Pass |

### The check the diff itself demanded

A bound is only half the change; the other half is **not silently tightening the
type**. Adding `.int()` to a field that legitimately holds decimals would refuse
real backups — a half-kilo plate, a fractional RIR — and no test in the suite
names that risk.

All thirteen mappings were checked line by line against the pre-change schema:

| Previously | Now | Int-ness |
|---|---|---|
| `increment`, `minRir`, `maxRir`, `restSeconds`, `plannedMinRir`, `plannedMaxRir`, `plannedRestSeconds`, `weight`, `weightKg`, `rir`, `defaultRir` — no `.int()` | `measure` (`z.number().min(0)`) | preserved, still fractional |
| `weeks`, `order` ×3, `sets`, `minReps`, `maxReps`, `plannedSets`, `plannedMinReps`, `plannedMaxReps`, `reps`, `version` — `.int()` | `count` (`z.number().int().min(0)`) | preserved |
| `setNumber` — `.int()` | `positiveCount` (`.int().min(1)`) | preserved, bound raised on proof |
| `timestamp` — `.int()` | `.int().min(0)` | preserved |

**No fractional field gained `.int()`, and no integer field lost it.**

## Automated Checks

| Command | Result | Covers | Evidence |
|---|---|---|---|
| `pnpm typecheck` | Pass | all | both tsconfigs clean |
| `pnpm lint` | Pass | all | eslint clean |
| `pnpm test` | Pass | R-1…R-8 | **26 files, 425 tests**, 0 failures |
| `pnpm build` | Pass | R-9 | 0 errors |
| `vitest --coverage` on `schema.ts` | Pass | — | see metrics |
| `stryker run --mutate schema.ts`, clear-text **and** JSON | Pass | R-1, R-5 | see below |

## QA

No browser QA, and none is warranted: nothing user-visible changed. The change is
a parser refusing input it should never have accepted, and the user-facing path —
restore showing a located error — is the existing `MoreScreen` flow, untouched
here. R-6's round-trip is the behavioural control and it is automated.

## Ownership and Scope

| Writer | Assigned Write Set | Actual Files | Compliant? |
|---|---|---|---|
| Single owner | `schema.ts`, `schema.test.ts`, optionally the fuzz file, plus docs | `schema.ts`, `schema.test.ts`, docs folder | Yes |

Confirmed **not** touched: `document.ts`, `routine-file/**`, `src/db/**`,
`src/features/**`, `stryker.config.json`, `docs/PRD.md`, `pnpm-lock.yaml`.
`reports/` from the JSON mutation run is gitignored (`.gitignore:20`).

## Contract / Integration Review

- **Frozen contract fidelity:** the document shape, `BACKUP_VERSION`, and the
  optional-settings compatibility rule are unchanged. `parseBackup` is strictly
  narrower than before, which is the intent, and R-4/R-6 are the guards that it
  narrowed only where nothing real lives.
- **Refusal semantics preserved:** whole document, no partial restore, no repair.
  A backup stays evidence of what happened rather than something the parser
  rewrites.
- **Boundary consistency:** the bound vocabulary is defined once, with the
  reasoning — including why there is no upper bound anywhere — in a single doc
  comment, instead of a `.min(0)` re-decided twenty times.
- **Generated / migration / project / lockfile:** none in the diff.

## Quality Metrics

- Changed-line coverage: **100%** (91/91) — critical target 95%.
- Changed-branch coverage: **94.11%** (32/34) — critical target 90%.
- Statements: **100%** (97/97).
- Mutation, `schema.ts`: **83.47%**, repo break threshold 80.
- **Bound mutants: 4 generated, 4 killed.**
- Surviving mutants: 40, none on a line this change touched — sampled at 112,
  238, 240–242, 310, 391, 435, 444: all pre-existing message strings and
  referential-integrity code.

### A claim in `execution.md` was wrong, and is corrected

That record stated Stryker generates **no** mutants on the bound lines, and that
the critical profile's "no surviving mutant on a bound" was therefore satisfied
*vacuously* — that mutation testing said nothing about this work.

It was measured wrongly. The clear-text reporter prints only survivors and
no-coverage mutants; grepping it for the bound lines could never have revealed a
*killed* one, so absence of output was read as absence of mutants.

The JSON reporter settles it: Stryker emits **four `MethodExpression` mutants**
across lines 104–108, one per bound, each deleting the `.min()` call — and **all
four are Killed**. The requirement is met **substantively**: remove any bound and
a test fails. `execution.md` has been corrected in place rather than left
standing.

## Missing / Partial Requirements

None.

## Extra / Unrequested Changes

None. Every hunk maps to a requirement.

## Security / Tenant / Permission / Compatibility Concerns

This change *closes* a validation gap at the restore trust boundary rather than
opening one. The compatibility risk it introduces — a stricter parser refusing an
older genuine document — is bounded by R-4 (no upper bounds at all), R-5 (`>= 1`
only on a traced writer) and R-6 (the executed round-trip), and by the deliberate
decision to leave `weeks`, `sets` and `plannedSets` at `>= 0` because the
routine-file front door never constrained them.

## Limitations or Deviations

**D-1 — `version` took `count` rather than staying bare.** The spec's field table
asked for it, and its comment explains it is deliberately loose so a *newer*
document reaches the version check with a good message. That path tests
`version > BACKUP_VERSION` and is unaffected: a negative version is not a newer
one. Behaviour preserved, comment intact. Recorded because the field carries an
explicit design note.

**L-1 — R-8 rests on the current fixture shape.** No backup file written by an
older build exists in the repo, so backward compatibility is evidenced by the
pre-settings optional-field cases in `schema.test.ts` rather than by a real
archived document. Stated rather than implied.

## Merge Risk

**Low.**

The change narrows a parser at a trust boundary, which is exactly the direction
that could refuse a lifter's only backup — so the verification spent its effort
there: every bound traced to the code that writes the field, the one raised bound
(`setNumber >= 1`) proven at both of its writers, int-ness checked field by field
so no decimal value became unparseable, and the export→parse round-trip executed
rather than argued. All four gates pass, coverage clears the critical targets,
and every bound carries a killed mutant.
