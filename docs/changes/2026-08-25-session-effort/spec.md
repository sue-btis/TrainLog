# Session effort — Spec

Status: **Implemented in `ed5c221`. This record was written afterwards**, on
2026-08-25, because the change shipped without one.
Size: quick
Reliability: strict
Base: `master` at `a540c28`.

## Why this record exists at all

The change landed as a single commit with its test, its glossary entry and its
PRD row, but no `docs/changes/` folder. Two later documents already lean on it
as settled — `docs/changes/2026-08-24-exercise-measurement/shaping.md` cites it
as **DEC-E** ("`effort` is the cross-modal figure, and it already shipped"), and
`docs/PRD.md` §39 A·15 lists it as done — so the decision is recorded, but the
change is not. This file closes that gap and states plainly which parts were
reconstructed from the commit rather than decided in advance.

Nothing here re-litigates the design. Where the reasoning already lives in the
code, this file points at it instead of restating it: `session-summary.ts`'s
header and `effortOf`'s comment carry the argument, and they are the source of
truth for it.

## Goal

A finished Session reports one figure that means the same thing whatever kind of
work it held.

Done when: `SessionSummary` carries `effort`, derived from the sets and the
Session's duration, and the finish summary shows it beside the minutes it is
half made of.

Origin: `docs/PRD.md` §39 item A·15, and §30's own note that a lifter's history
should eventually support reading *load progression + fatigue + effort*
together.

**Provenance, stated exactly.** The PRD row was written one commit *ahead* of
the code, in `a540c28`, already marked ✅. So §39 A·15 is not part of this
change's surface — it is the backlog entry that describes it, and it was marked
done before `ed5c221` existed. Recorded rather than smoothed over: a ✅ that
lands before the commit it describes is the kind of thing that reads as
finished when it is not.

## Evidence and current behavior — before `ed5c221`

Read at `a540c28`, the commit this one sits on.

- `summarizeSession` reported `setsLogged`, `volumeKg`, `minutes`, the three
  status counts and the records list
  ([`session-summary.ts`](../../../src/domain/session-summary.ts)). Every figure
  in it was already derived and stored nowhere; the module header says so.
- **`volumeKg` is `Σ weightKg × reps`.** For a hold, a carry or a run that sum
  is zero, so the summary's headline figure was blind to exactly the work a
  hybrid programme adds. This is the gap the change exists to close, and it is
  also why `effort` could not be another accumulator: kilogram-reps, seconds and
  metres do not add up, and a single total claiming to sum them has an invented
  conversion inside it (the same reasoning as DEC-D of the exercise-measurement
  shaping).
- **RIR is on every set.** §30 stores the RIR actually achieved, whatever was
  being measured, which is what makes it the one axis both halves of a hybrid
  programme share.
- **A logged RIR has no upper bound.** `backup/schema.ts:265` reads it as
  `measure`, and
  [`schema.test.ts:532`](../../../src/domain/backup/schema.test.ts) asserts that
  a logged RIR of 12 is accepted deliberately — "which the set logger permits".
  Any arithmetic over `10 − rir` therefore has to survive a negative term.

## Scope

**In:**

- `effort` on `SessionSummary`, derived in `summarizeSession`.
- The `effortOf` helper and its `RPE_AT_FAILURE` constant.
- The figure on the finish summary of `SessionDetailScreen`.
- The `Effort` entry in `CONTEXT.md`.
- Regression tests for the arithmetic and its three edge cases.

**Out:**

- **Storing it.** It is a pure function of rows the app already holds; a stored
  copy could only disagree with them.
- **Showing it anywhere else** — the history list, the progress dashboard, any
  weekly or block-level roll-up. All reasonable, none needed to make one Session
  readable, and a per-week figure raises questions this change does not answer.
- **Any schema, index or backup version change.** There is none.
- **Reinterpreting past sessions.** The figure derives from rows already stored,
  so history gains it without a migration.

## Decisions and assumptions

Reconstructed from the commit and its comments; each is what the code does.

- **DEC-1 — Foster's session load, not an invented index.** Mean RPE × minutes,
  with `RPE = 10 − RIR`. Because §30 stores the RIR achieved, the conversion is
  a rename rather than an estimate.
- **DEC-2 — the mean across sets, not the hardest set.** A session's difficulty
  is not its worst moment; the hardest-set reading would make one all-out single
  outrank an hour of work. Pinned by a test that makes RIR 0 and RIR 4 read the
  same as two sets at RIR 2.
- **DEC-3 — negative terms are floored at zero, not clamped at the source.**
  `Math.max(0, 10 − rir)`. Given the unbounded logged RIR above, an easy set
  would otherwise *subtract* effort from the session it was part of. The floor
  lives in the arithmetic because the bound is deliberately absent upstream.
- **DEC-4 — rounded, and unitless.** A mean of whole-number ratings times an
  already-rounded minute count has no decimal's worth of precision to report.
  `CONTEXT.md` states the vocabulary consequence: this is an index, and *Load*
  means kilograms and is never this.
- **DEC-5 — `null`, not `0`, where there is nothing to compute from.** An open
  Session has no duration and a setless one has no RPE; in both cases the answer
  is unknown, which is the distinction `minutes` already makes.
- **DEC-6 — `minutes` is hoisted and shared.** `effort` multiplies by that exact
  number, so deriving the duration twice would let the two figures round apart.
- **ASM-1 — wall clock is the definition, not a shortcut.** Rest, a phone left
  on a bench and a conversation between sets are all inside `minutes`. That is
  Foster's own definition — the figure is meant to scale with time spent
  training — but a leisurely session and a dense one of equal length do read
  alike. Recorded as the known ceiling, in `effortOf`'s comment.

## Requirements and acceptance

| ID | Requirement |
|---|---|
| REQ-1 | `SessionSummary` carries `effort`, typed `number` or `null`. |
| REQ-2 | For a finished Session with at least one set, `effort` is `round(mean(max(0, 10 − rir)) × minutes)`. |
| REQ-3 | `effort` is `null` for an open Session and for one holding no set. |
| REQ-4 | `minutes` is derived once and shared with `effort`. |
| REQ-5 | The finish summary shows `effort` when it is not `null`, beside `minutes`. |
| REQ-6 | Nothing is stored, no schema or backup version moves, no other figure changes. |

| ID | Acceptance | Test |
|---|---|---|
| AC-1 | Three sets at RIR 2 over 61 minutes read `8 × 61`. | `session-summary.test.ts` |
| AC-2 | RIR 0 and RIR 4 read the same as two sets at RIR 2 — the mean, not the max. | same |
| AC-3 | A set at RIR 12 contributes zero, not a negative. | same |
| AC-4 | An open Session and a setless one both read `null`. | same |
| AC-5 | Four gates green, no schema or version change in the diff. | gates |

## Change surface

| Path | Change |
|---|---|
| `src/domain/session-summary.ts` | `effort` on the interface, `effortOf`, `RPE_AT_FAILURE`, hoisted `minutes`. |
| `src/domain/session-summary.test.ts` | Four cases: AC-1…AC-4. |
| `src/features/history/SessionDetailScreen.tsx` | One `Figure`, `tone="progress"`. |
| `CONTEXT.md` | The `Effort` glossary entry, with its `_Avoid_` list. |

Four files — `docs/PRD.md` is deliberately absent; see Provenance above. No repository touched, no Dexie table read or written, no new
dependency.

## Stop conditions

Stated as they would have been, and none was hit.

- Stop if the figure needs storing to be correct — that would mean it is not a
  pure function of the rows, and the design is wrong.
- Stop if it needs a set to carry anything it does not already carry.
- Stop if making it read well requires changing `volumeKg`, `minutes` or the
  records list.
