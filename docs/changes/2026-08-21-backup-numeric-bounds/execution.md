# Backup numeric bounds — Execution

## Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Branch | `change/exercise-catalog` |
| Planned base | `d82392d` |
| Current start commit | `d82392d` — unchanged throughout |
| Working tree before edits | `?? docs/changes/2026-08-21-backup-numeric-bounds/` only |
| Pre-existing relevant changes | None |

## Preflight Verdict

**Safe.**

## Execution Topology

**Quick direct**, sequential, single owner. No subagents: one production file,
and a critical trust boundary is the wrong place to split ownership.

## Executed Work

| Task | REQ IDs | Status | Files Changed | Checks | Evidence |
|---|---|---|---|---|---|
| Boundary tests | R-1, R-2, R-3, R-4 | Completed | `schema.test.ts` | vitest | Red: **24 failed / 52 passed** |
| Bounds | R-1…R-5, R-9 | Completed | `schema.ts` | vitest, all gates | Green: **91 backup tests**, then 425 repo-wide |

### Writers verified before bounding (R-5)

The spec's rule was that `>= 1` may be used **only** where zero is structurally
impossible *and proven against the writer*; anything unproven takes `>= 0`.

| Field | Bound | Proof |
|---|---|---|
| `setNumber` | `>= 1` | `LogSetInput.setNumber` is documented *"Its position in the exercise, 1-based"* ([`session/index.ts:131`](../../../src/domain/session/index.ts)), and `removeSet` closes survivors into a contiguous `1..n` (`:360`). Proven. |
| `order` (workouts, planned exercises, exercise sessions) | `>= 0` | A live IndexedDB read during the previous change showed `order: 0,1,2,3`. 0-based. |
| `weeks` | `>= 0` | The routine-file schema types it as bare `z.number()` and `validate.ts` never checks it, so a genuine Routine may carry 0. **Not** given `>= 1`, exactly as the spec required. |
| `sets`, `plannedSets` | `>= 0` | `validate.ts` demands `> 0` of a *file*; that is not proof about a *stored* row. Left wider. |
| everything else | `>= 0` | unproven ⇒ wider bound |

The rule is stated once in the code rather than per field: three named schemas —
`count`, `positiveCount`, `measure` — carry the reasoning in one doc comment,
including why no upper bound exists anywhere.

## Integration Gates

| Gate | Owner | Diff Inspected? | Checks | Result |
|---|---|---:|---|---|
| Final | this session | Yes | `pnpm typecheck && pnpm lint && pnpm test && pnpm build` | All green. **425 tests**, 26 files. |

`git status` lists exactly `src/domain/backup/schema.ts`,
`src/domain/backup/schema.test.ts` and this change's docs folder. No lockfile, no
config, no generated file. `schema.fuzz.test.ts` was **not** edited — its
generator already emits arbitrary JSON, so no new case was warranted.

## Requirement Status

| Req | Implementation | Acceptance Evidence | Status |
|---|---|---|---|
| R-1 | every numeric field bound | 21 table-driven refusals across `completedSets`, `sessions`, `routines`, `workouts`, `plannedExercises`, `exerciseSessions`, plus `increment`, `exportedAt`, `defaultRir` | Completed |
| R-2 | Zod path preserved | each refusal asserts the offending field name appears in the formatted paths | Completed |
| R-3 | `measure`/`count` are inclusive of 0 | `0 kg × 0 reps @ RIR 0` accepted; `-0.5` / `-1` refused | Completed |
| R-4 | no `.max()` anywhere | `rir: 12`, `reps: 500`, `maxRir: 50` all accepted | Completed |
| R-5 | `positiveCount` used once | only `setNumber`, on the proof above | Completed |
| R-6 | — | the existing round-trip at [`backup.test.ts:224`](../../../src/db/repositories/backup.test.ts) — `exportBackup` over a populated database, then `parseBackup` — **passes**. Executed, not reasoned about | Completed |
| R-7 | untouched | `schema.fuzz.test.ts` passes unchanged | Completed |
| R-8 | optional-field compatibility untouched | the pre-settings backup cases in `schema.test.ts` still pass | Completed |
| R-9 | — | `BACKUP_VERSION` untouched; no file under `src/db/` in the diff | Completed |

### Quality metrics

- Changed-line coverage: **100%** (91/91) — critical target 95%.
- Changed-branch coverage: **94.11%** (32/34) — critical target 90%.
- Mutation, `schema.ts`: **83.47%**, repo break threshold 80. Forty survivors,
  none on a line this change touched — spot-checked at 112, 238, 240–242, 310,
  391, 435, 444, all pre-existing message strings and referential-integrity code.

### The bounds are pinned by mutation too

**Corrected during verification.** This record first claimed Stryker generates no
mutants on the bound lines, and that the critical profile's "no surviving mutant
on a bound" was therefore satisfied vacuously. That was wrong, and wrong because
of how it was measured: the clear-text reporter prints only survivors, so
grepping it for the bound lines could never have found a killed mutant.

The JSON reporter settles it. Stryker emits **four `MethodExpression` mutants**
across lines 104–108 — one per bound, each removing the `.min()` call — and
**all four are Killed**. The requirement is met substantively: delete any bound
and a test fails.

The red→green evidence still carries the change; mutation now corroborates it
rather than saying nothing about it.

## Deviations

- **`version` took `count` (`>= 0`) rather than being left bare.** The spec's
  field table asked for it. Its existing comment explains it is deliberately
  loose so a *newer* document reaches the version check with a good message;
  that path is `version > BACKUP_VERSION` and is unaffected, since a negative
  version is not a newer one. Behaviour preserved, comment left intact.

## Ownership / Contract Conflicts

None.

## Blockers

None. No stop condition fired: R-6 passes, every `>= 1` was proven, no timestamp
writer emits a negative instant, and nothing required cross-field rules,
`validate.ts` or a version bump.

## Independent Verification Readiness

**Ready.**

Two things for the verifier to weigh:

1. **The mutation claim in this record was corrected during verification** — see
   above. Every bound carries a killed mutant.
2. **No browser QA, and none is warranted.** Nothing user-visible changed; the
   change is a parser refusing input it should never have accepted. The
   user-facing consequence — restore showing a located error — is covered by the
   existing `MoreScreen` restore path, which this change does not touch.
