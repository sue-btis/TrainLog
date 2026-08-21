# Backup numeric bounds — Spec

Status: Ready for implementation
Size: medium
Reliability: critical
Base: `change/exercise-catalog` at `d82392d`, clean working tree.

## Goal

A backup file carrying impossible numbers is refused at the door, with a message
saying which field, instead of being restored and quietly turning into
nonsensical figures on the Progress screen.

Done when: every numeric field in `parseBackup`'s schema carries a lower bound,
a document violating one is refused with a located error, **and no backup the
app itself can produce is refused.**

Origin: finding **V-1** of `docs/changes/2026-08-21-estimated-1rm-pr/verification.md`.

## Evidence and Current Behavior

Verified by inspection at `d82392d`:

- **No numeric field in the backup schema has any bound.** Every one is
  `z.number()` or `z.number().int()`
  ([`schema.ts:85,113,119,129,136–141,145,176,194–199,237–242,259,271`](../../../src/domain/backup/schema.ts)).
  The schema validates **types and never ranges**.
- **The app's set-logging door clamps at zero and nowhere else.** `Field` uses
  `onChange(Math.max(0, …))` when stepping and refuses `parsed < 0` when typed
  ([`SetLogger.tsx:170,177`](../../../src/features/session/SetLogger.tsx)). There is
  **no upper cap** on reps or RIR.
- **The routine-file door enforces a different, tighter vocabulary:** `sets > 0`,
  `rest_seconds >= 0`, `min_reps <= max_reps`, and RIR within `MIN_RIR = 0` /
  `MAX_RIR = 10` ([`validate.ts:32,58–83`](../../../src/domain/routine-file/validate.ts)).
  That bound is documented there as *this change's recorded assumption*, not a
  PRD rule, and it governs **planned** RIR in a routine file — not the RIR a
  lifter logs against a set.
- **`weeks` is not even an integer at the front door** — `z.number()` in
  [`routine-file/schema.ts:78`](../../../src/domain/routine-file/schema.ts), and
  `validate.ts` never checks it. A genuine imported Routine may therefore carry
  values a stricter backup schema would now refuse.
- **`parseBackup` is fuzzed, and the fuzz test is the contract.**
  [`schema.fuzz.test.ts`](../../../src/domain/backup/schema.fuzz.test.ts) asserts
  two invariants for arbitrary input: it always returns, and a refusal always
  carries at least one error. Its header names §18 and **critical reliability**.
- **Restore replaces the whole database in one transaction**
  (`restoreBackup`), which is why refusing the wrong file is not a cosmetic
  mistake.
- **`src/domain/backup/**` is inside Stryker's configured scope**
  ([`stryker.config.json`](../../../stryker.config.json)), so the repo's own gate
  applies without any override.

## Scope

Included:

- a lower bound on every numeric field of the backup schema;
- tests: accepted boundary values, refused violations, located errors;
- the fuzz contract re-run unchanged.

Excluded:

- **any upper bound.** See the governing decision.
- cross-field rules (`minReps <= maxReps`, `completedAt >= startedAt`). They are
  a different kind of check, they belong with the semantic tier of §11.1, and
  none of them is what V-1 reported.
- changing `validate.ts`, the routine-file schema, or `MAX_RIR`.
- `BACKUP_VERSION`, the document shape, or anything under `src/db/`.
- clamping or repairing a bad value. A backup is evidence of what happened; a
  parser that silently rewrites it is worse than one that refuses it.

## Decisions and Assumptions

- **Decision (user, approved):** the whole schema, field by field — not only the
  three fields V-1 named.
- **Decision — bounds come from what the app can write, never from what
  `validate.ts` demands.** This is the governing rule of the change. `Field`
  caps nothing from above, so a lifter can and does log `RIR 12`; adopting
  `MAX_RIR = 10` here would refuse their genuine backup. **No upper bound is
  added to any field.** Every bound is `>= 0`, or `>= 1` only where zero is
  structurally impossible *and that has been verified against the writer*.
- **Decision:** a violation refuses the document, exactly as any other schema
  violation does today. No new failure mode, no partial restore, no repair.
- **Assumption:** `timestamp` values are epoch milliseconds and never negative.
  Stop if any writer can produce a pre-1970 instant.

## Requirements and Acceptance

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-1 | Every numeric field in the backup schema rejects values below its lower bound. | AC-1: for each bounded field, a document differing only in that field being below the bound is refused. |
| R-2 | The refusal names the field. | AC-2: each refusal carries at least one error whose path locates the offending field, not a bare "invalid document". |
| R-3 | `reps`, `rir`, `weight`, `weightKg` accept **0** and refuse anything below. | AC-3: a set of `0 kg × 0 reps @ RIR 0` restores — bodyweight work and a logged zero are both real — while `-1` in any of the four is refused. |
| R-4 | No field gains an upper bound. | AC-4: a set logged at `RIR 12` and one at `500 reps` both restore. A planned RIR of `10` and of `50` both restore. |
| R-5 | `>= 1` is used only where zero is structurally impossible, and only where verified against the code that writes the field. | AC-5: for every field given `>= 1`, the spec's table names the writer that cannot emit 0. Any field whose writer is not proven takes `>= 0`. |
| R-6 | A backup exported by the current app always parses. | AC-6: round-trip — `exportBackup` on a populated database, then `parseBackup` on its output, succeeds. |
| R-7 | The two fuzz invariants still hold. | AC-7: `schema.fuzz.test.ts` passes unchanged — `parseBackup` always returns, and every refusal carries at least one error. |
| R-8 | Backward compatibility is preserved for documents the app wrote before this change. | AC-8: an older backup fixture parses. If none exists in the repo, one is constructed from `BACKUP_VERSION`'s current shape and stated as such. |
| R-9 | No document shape, version or storage change. | AC-9: `BACKUP_VERSION` is untouched; the diff touches no file under `src/db/`. |

## Field Table

The implementer fills the third column by reading the writer, and applies R-5:
**anything not proven takes `>= 0`.**

| Field(s) | Proposed bound | Writer to verify |
|---|---|---|
| `timestamp` (all uses) | `>= 0` | epoch ms; assumption above |
| `weight`, `weightKg`, `reps`, `rir` | `>= 0` | `Field` clamps at 0 — proven |
| `setNumber` | `>= 1` **if proven**, else `>= 0` | `logSet` in `domain/session` |
| `order` (workout, planned exercise, exercise session) | `>= 0` | index-derived; check whether 0- or 1-based |
| `weeks` | `>= 0` | `routine-file/schema.ts:78` is bare `z.number()` and unvalidated — **do not assume `>= 1`** |
| `sets`, `plannedSets` | `>= 0` unless proven | `validate.ts` demands `> 0` for a *file*, which is not proof about a *stored* row |
| `minReps`, `maxReps`, `plannedMinReps`, `plannedMaxReps` | `>= 0` | |
| `minRir`, `maxRir`, `plannedMinRir`, `plannedMaxRir`, `defaultRir` | `>= 0`, nullable preserved | no upper bound (R-4) |
| `restSeconds`, `plannedRestSeconds` | `>= 0`, nullable preserved | `validate.ts` already refuses negative in a file |
| `increment` | `>= 0` | a negative increment would walk the bar down forever |
| `version` | `>= 0` | already compared against `BACKUP_VERSION` elsewhere |

## Contracts and Risk Controls

Changed:

- `parseBackup` becomes **stricter**. A document that parsed before may now be
  refused. That is the point, and it is why R-4, R-6 and R-8 exist.

Preserved:

- the document shape, `BACKUP_VERSION`, and the optional-field compatibility
  rule that lets a pre-settings backup restore;
- both fuzz invariants;
- refusal semantics: whole document, no partial restore, no repair.

Risk control: this is the **restore trust boundary**, and restore replaces the
entire database in one transaction. The failure that matters is not "a bad file
got through" — it is **"a lifter's only copy of their training was refused"**.
R-4 and R-6 are the controls, and R-6 must be executed, not reasoned about.

## Quality Obligations (critical profile)

- **Tests:** per-field boundary pairs — the bound itself accepted, one below
  refused — plus the located-error assertion.
- **Adversarial:** the existing fuzz test re-run unchanged; add a generator case
  emitting extreme and negative numerics if it does not already.
- **Round-trip:** R-6 executed against a populated database, not asserted.
- **Static/build:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- **Coverage:** changed-line ≥ 95%, changed-branch ≥ 90%.
- **Mutation:** `pnpm exec stryker run` unmodified; `break: 80` applies.
  **No surviving mutant on a bound is acceptable** — a bound whose mutant lives
  is a bound nothing tests. Every survivor classified.

## Change Surface

Expected edits:

- `src/domain/backup/schema.ts` — the bounds.
- `src/domain/backup/schema.test.ts` — boundary tests.
- `src/domain/backup/schema.fuzz.test.ts` — only if a generator case is added.
- `docs/changes/2026-08-21-backup-numeric-bounds/verification.md` — new, at the end.

Do not touch:

- `src/domain/backup/document.ts`, `src/domain/routine-file/**`, `src/db/**`,
  `src/features/**`, `stryker.config.json`, `docs/PRD.md`.

## Planning Decision

Plan required: **No.** One file of production code, one owner, no sequencing.
The field table above is the ordering.

## Stop Conditions

Stop and report rather than inventing behavior if:

- any bound would refuse a document `exportBackup` can produce (R-6 fails);
- a field's writer cannot be located, and the fallback `>= 0` is still in doubt;
- a timestamp writer can emit a negative instant;
- closing this appears to require cross-field rules, `validate.ts`, or a
  `BACKUP_VERSION` bump;
- a mutant on a bound survives and cannot be killed.
