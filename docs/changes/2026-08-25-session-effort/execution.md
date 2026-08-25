# Session effort — Execution

Written after the fact, on 2026-08-25, from the commit itself. Everything below
is what `ed5c221` contains, read at `git show ed5c221`; nothing is reconstructed
from memory of a plan, because there was no plan document.

Base: `a540c28`. Head: `ed5c221`. One commit, four files, +116 / −6.

## What was done

| Path | What landed |
|---|---|
| `src/domain/session-summary.ts` | `effort: number \| null` on `SessionSummary`; `effortOf(sets, minutes)`; `RPE_AT_FAILURE = 10`; `minutes` hoisted out of the return object so both figures read the same duration. Module header gained the paragraph saying why this one figure is a new measure when nothing else in the file is. |
| `src/domain/session-summary.test.ts` | Four cases — the arithmetic, the mean-not-max distinction, the RIR-12 floor, and the two `null` paths. |
| `src/features/history/SessionDetailScreen.tsx` | One `Figure`, `tone="progress"`, rendered only when `effort !== null`, placed immediately after `minutes`. |
| `CONTEXT.md` | The `Effort` glossary entry, with `_Avoid_: Load, training load, sRPE, intensity`. |

No repository, no Dexie table, no schema, no backup version, no dependency.

## Requirements

| ID | Evidence | Status |
|---|---|---|
| REQ-1 | `SessionSummary.effort`, documented in place | Completed |
| REQ-2 | `effortOf` — `Math.round(meanRpe * minutes)` over `Math.max(0, 10 - set.rir)` | Completed |
| REQ-3 | `if (minutes === null \|\| sets.length === 0) return null` | Completed |
| REQ-4 | `minutes` computed once above the records loop, passed into `effortOf` and returned | Completed |
| REQ-5 | `{summary.effort !== null && <Figure label="effort" … />}` | Completed |
| REQ-6 | Diff is four files; none is a schema, a migration or a repository | Completed |

## Checks

Re-run on 2026-08-25 at the tip of `change/routine-authoring`, which contains
this commit. The suite has moved since `ed5c221` — later work added tests — so
these are today's figures, not the ones the commit was made against, and they
are labelled as such rather than back-dated.

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass — 552 tests, 34 files (floor 458). The 552nd is the rounding case this change’s verification added; see `verification.md` V-1 |
| `pnpm lint` | Pass |
| `pnpm build` | Pass |

The effort cases were also run alone and pass — four from the commit, plus the
rounding case its verification added.

## Deviations

**D-1 — the change shipped with no record, and this is it.** Under the strict
profile a change of this size still owes a spec, an execution record and a
verification. It got a commit message instead. The message is a good one — it
carries the reasoning — but a commit message is not addressable: the
exercise-measurement shaping had to cite the *code* as DEC-E because there was
no change folder to point at.

**D-2 — §39 A·15 was marked ✅ one commit before the code landed.** The PRD row
is in `a540c28`; the implementation is in `ed5c221`. Nothing was wrong with the
end state, but for the length of one commit the backlog claimed a feature the
repository did not have.

**D-3 — this record cannot fail the change.** It was written after the fact, by
the same session that read the code, and it is therefore evidence of what the
commit contains, not of a plan being followed. Its verification is honest about
the same limit.
