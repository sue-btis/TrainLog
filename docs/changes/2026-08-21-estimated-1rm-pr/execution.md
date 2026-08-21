# Estimated 1RM + PR detection — Execution

## Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Branch | `change/exercise-catalog` |
| Planned base | `9ec8e9a` |
| Current start commit | `9ec8e9a` at preflight; **`45e6314` by the integration gate** — see Deviations |
| Working tree before edits | `?? docs/changes/2026-08-21-estimated-1rm-pr/`, `?? public/_redirects` |
| Pre-existing relevant changes | `public/_redirects` was untracked work belonging to nobody in this change. Not staged, not edited, not deleted by this change — it was replaced by its author mid-run. |

## Preflight Verdict

**Safe.** Base matched the spec, and the one dirty path was outside the write
set. Recorded rather than absorbed.

## Execution Topology

**Shared tree with disjoint writes**, one integration owner.

The domain layer was implemented first and alone, because it is the frozen
contract everything else reads and the only part under Stryker's gate. Once it
compiled, two subagents ran **in parallel** on one file each, against the frozen
contract. Documentation was done by the integration owner in parallel with them.

| Writer | Exact write set |
|---|---|
| Integration owner | `src/domain/history.ts`, `src/domain/history.test.ts`, `docs/PRD.md`, `docs/changes/…` |
| Subagent A | `src/features/progress/ExerciseChart.tsx` |
| Subagent B | `src/features/progress/ProgressScreen.tsx` |

No writer was permitted `pnpm test` while another was active; each ran
`typecheck` and `lint` only. Neither subagent's report was accepted as evidence —
both diffs were read directly at the gate.

## Executed Work

| Task | REQ IDs | Status | Files Changed | Checks | Evidence |
|---|---|---|---|---|---|
| Formula, field, record rule | R-1, R-2, R-3, R-5, R-11 | Completed | `domain/history.ts`, `domain/history.test.ts` | vitest, Stryker | Red→green twice; see below |
| Chart metric, record dot, spoken label | R-4, R-6, R-9 | Completed | `ExerciseChart.tsx` | typecheck, lint, browser | Browser QA below |
| Best-estimate figure | R-8 | Completed | `ProgressScreen.tsx` | typecheck, lint, browser | Browser QA below |
| PRD | R-12 | Completed | `docs/PRD.md` | — | §11.11 rewritten, §39 rows 1–2 → ✅ |
| Integration wiring | — | Completed | both progress files | all four gates | `round()` de-duplicated; see below |

### Red→green, twice

1. `TypeError: estimateOneRepMaxKg is not a function` — **11 failed / 20 passed**.
2. After implementing, **4 still failed**:
   `expected [ true, true, false, false, true ] to deeply equal [ false, true, false, false, true ]`.
   `Array.prototype.every` returns `true` on the empty slice, so the **first
   session was being marked a record** — precisely the rule the spec froze. The
   fix replaced the scan with a running maximum and gated it on `index > 0`
   rather than on a sentinel value, because **a bodyweight set logged at 0 kg
   estimates 0** — a real value, not an absent one, and the session after it must
   still be able to beat it.
3. Green: **31 passed**.

## Integration Gates

| Gate | Owner | Diff Inspected? | Checks | Result |
|---|---|---:|---|---|
| Final | this session | Yes, both subagent diffs read in full | `pnpm typecheck && pnpm lint && pnpm test && pnpm build` | All green. **395 tests**, 26 files. |

Two things the gate caught that the subagent reports could not settle:

- **The empty-series throw that wasn't.** `ProgressScreen`'s new
  `points.reduce(…)` carries no initial value and would throw on an empty
  series. Verified by reading the file, not the report: it sits at line 157,
  **after** the `points.length === 0` early return at line 138. Safe.
- **A duplicated `round()`.** Subagent B correctly reported that it had copied
  `ExerciseChart`'s private one-decimal helper because that file was not its to
  edit, and flagged it rather than reaching across. Resolved here, where both
  files are owned: the existing helper is now exported and imported. No new file
  was added to the write set — `src/features/ui/format.ts` is the better
  long-term home for it, and is left for a change that owns it.

## Requirement Status

Browser QA on the scratch origin `:5233` at 375 × 812. That origin held a single
session, which cannot produce a record, so **two earlier Front Squat sessions
were seeded directly into IndexedDB** to exercise the true branch, and **deleted
afterwards** (`sessions` back to 1, `exerciseSessions` 4, `completedSets` 3).

| Req | Implementation | Acceptance Evidence | Status |
|---|---|---|---|
| R-1 | max of `estimateOneRepMaxKg` across the session's sets | Unit: a session of `100×5@RIR0` and `110×1@RIR0` reports `topSetKg` 110 and estimate **116.67**, from the lighter set | Completed |
| R-2 | `weightKg × (1 + (reps + rir) / 30)` | Unit table: `116.67 / 103.33 / 123.33 / 100`; a `lb` set estimates from its `weightKg` and lands below its own pound number | Completed |
| R-3 | — | Unit: `estimatedOneRepMaxKg >= topSetKg` across a mixed series | Completed |
| R-4 | fourth `Metric`, `METRICS` and `READING` entries | Browser: tabs read `Load · e1RM · Reps · Volume`; selecting e1RM draws it and the spoken label says `estimated 1RM … kg` | Completed |
| R-5 | running maximum, strict, `index > 0` | Unit: `100,105,105,103,110` → `[false,true,false,false,true]`; unsorted input judged after sorting; an unfinished session can hold one | Completed |
| R-6 | fill swap on the same circle | Browser, three points: `[{r:4.5, card}, {r:4.5, actual}, {r:6, card}]`. The record is filled; the first is not; **the latest is still `r=6` while not being a record**. Marking is metric-independent — same fills under e1RM | Completed |
| R-7 | `ExerciseSummary` untouched | Browser: `/exercises/front-squat` shows exactly `current working weight · best set · heaviest · lightest` and the page mentions neither "estimated" nor "record" | Completed |
| R-8 | max over the points, not the last flagged one | Browser: **119.6 kg · Thu, Aug 20** — the middle session, i.e. the maximum rather than the latest. `102.5 × (1 + 5/30) = 119.583` | Completed |
| R-9 | records clause appended to `describe()` | Browser: `…— falling. 1 personal record along the way.` With the unseeded single-session history the clause is absent | Completed |
| R-10 | nothing stored | Diff touches no file under `src/db/` or `src/domain/backup/` | Completed |
| R-11 | pure, in `domain/` | No React or Dexie import; 11 new tests | Completed |
| R-12 | §11.11, §39 | §11.11 states both metrics with the 100×5 vs 110×1 case; §39 rows 1–2 are ✅ with evidence | Completed |

### Mutation

`pnpm exec stryker run --mutate src/domain/history.ts` → **94.57%**, break
threshold 80. **Five survivors, all five in pre-existing code** — `better()`'s
two equality operators and three `reduce` comparisons inside
`summarizeExercise`. **None in new code.**

## Deviations

- **The base moved mid-run.** Preflight recorded `9ec8e9a`; by the integration
  gate `HEAD` was `45e6314`, *"feat(config): add initial wrangler configuration"*,
  committed onto this branch by its author while the subagents worked. It adds
  only `wrangler.jsonc` (Cloudflare Workers SPA fallback) and removes the
  untracked `public/_redirects` seen at preflight. **Zero overlap** with this
  change's write set. The diff range was re-baselined to `45e6314` and execution
  continued; nothing was reverted, rebased or forced.

## Ownership / Contract Conflicts

None. `git status` lists exactly this change's five tracked files plus its own
docs folder. No lockfile, no config, no generated file, and `wrangler.jsonc` was
left entirely to its author.

## Blockers

None. No stop condition fired: `rir` was non-null as assumed, the record flag
reached the dot through Recharts' existing `payload` clone without restructuring
the series, R-8 and R-9 were delivered without touching `ExerciseSummary`, and no
mutation survivor landed in new code.

## Independent Verification Readiness

**Ready.**

One limitation for the verifier: **no screenshot.** The Browser pane does not
composite in this environment, so every browser result above is a DOM or SVG
attribute reading — `fill`, `r`, `aria-label`, rendered text — rather than a
picture. The fills and radii are read straight off the `<circle>` elements, which
is stronger than eyeballing them, but nothing was seen.
