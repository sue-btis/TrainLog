# Session effort — Verification

Verified 2026-08-25, after the fact. Range inspected: `git show ed5c221`
(base `a540c28`), four files, +116 / −6.

**What this verification can and cannot be.** It was written by the same session
that wrote the spec, from the same commit, so it is not an independent review of
a plan — the change had already shipped. What it *can* do is test the code
rather than read it, and that is what it does: every claim below is either a
command that ran or a reading taken from the app. Where a decision turned out to
be unasserted, it says so and what was done about it.

## Re-run evidence

At the tip of `change/routine-authoring`, which contains `ed5c221`.

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass |
| `pnpm test` | Pass — 552 tests, 34 files, 0 skipped |
| `pnpm build` | Pass |

Regression floor (§12): 458. The count includes the one test this verification
added; see Finding V-1.

## Acceptance

| ID | How it was checked | Verdict |
|---|---|---|
| AC-1 | `session-summary.test.ts` — three sets at RIR 2 over 61 minutes read `8 × 61` | **Pass** |
| AC-2 | RIR 0 and RIR 4 read the same `8 × 61` — the mean, not the max | **Pass** |
| AC-3 | RIR 12 contributes 0, giving `4 × 61` rather than `3 × 61` | **Pass** |
| AC-4 | Open Session and setless Session both `null` | **Pass** |
| AC-5 | Diff is four files; no schema, migration, repository or dependency in it | **Pass** |
| REQ-5 | Observed in the app; see below | **Pass** |

## Mutation testing

Each mutation was applied to `session-summary.ts`, the effort tests run, and the
file restored with `git checkout` before the next.

| Mutation | Result |
|---|---|
| `Math.max(0, …)` floor removed | **Caught** — 1 failure |
| Setless guard weakened to `minutes === null` only | **Caught** — 1 failure |
| Mean replaced by the hardest set | **Caught** — 3 failures |
| `effort` given `minutes + 1` instead of the shared value | **Caught** — 4 failures |
| `Math.round` removed | **Caught after V-1** — see below |

## V-1 — rounding was decided and never asserted

Removing `Math.round` from `effortOf` left the whole suite green: every fixture
in the file happened to average to a whole number of RPE, so `457.5` never
occurred and nothing could tell rounding from its absence. DEC-4 says the figure
is an index and rounds for that reason, and the code did round — but the
decision was resting on nothing.

Closed here rather than logged as debt, since the gap is one fixture wide: a
case with sets at RIR 2 and RIR 3 means to RPE 7.5, and `7.5 × 61 = 457.5` reads
`458`. With it, the rounding mutation fails. That is the one test this
verification added, and the reason the count above is 552 rather than 551.

## Observed in the app

Dev server at 375×812, real IndexedDB. One completed Session was seeded directly
into the store — three sets at RIR 2, 61 minutes of wall clock — and the finish
summary read:

```
3 SETS · 1,500 kg VOLUME · 61 MIN · 488 EFFORT · 1 of 1 EXERCISES
```

`488` is `(10 − 2) × 61`, the arithmetic exactly, and it sits immediately after
the minutes, which is what the comment on that `Figure` says it is for. The
seeded rows were deleted afterwards; the store is back to zero Sessions.

Note for anyone reproducing this: the finish summary renders only under
`?finished=1` (`SessionDetailScreen.tsx:52`), so a plain visit to a Session
shows the set list without it. That is existing behaviour, not something this
change introduced.

## Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| V-1 | Minor | `Math.round` was unasserted; the suite survived its removal | Fixed here — one test added |
| V-2 | Record | The change shipped without a `docs/changes/` folder | Fixed by this folder |
| V-3 | Record | §39 A·15 was marked ✅ in `a540c28`, one commit before the code landed in `ed5c221` | Recorded as D-2; end state is correct, nothing to change |

## Verdict

**Pass.** The figure is what the spec says it is, its four edge cases are
asserted, and four of the five mutations were caught before this verification
touched anything — the fifth is caught now. The change itself needed no
correction; what it was missing was this record.

## Not exercised

- `effort` on a Session with a set logged at a **negative** RIR. `measure` in
  `backup/schema.ts` bounds RIR below at 0, so the value cannot come from a
  restore, and the set logger does not offer it — but the floor only guards the
  upper end, and a negative RIR would read as RPE above 10. Out of scope here
  and left as a known, bounded gap rather than silently covered.
- Any roll-up of `effort` across Sessions. Deliberately out of scope (see the
  spec), so there is nothing to verify.
