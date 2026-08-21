# Estimated 1RM + PR detection — Verification

Verdict: **Pass with accepted limitations**
Size: medium
Reliability: strict

## Audit Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Declared base | `9ec8e9a` at preflight; re-baselined to `45e6314` mid-execution |
| Audited head / working tree | `45e6314`, dirty on `change/exercise-catalog` |
| Diff range | `git diff 45e6314` — five tracked files — plus one untracked docs folder |
| Unrelated work in range | **None.** `45e6314` (`wrangler.jsonc`, Cloudflare Workers SPA config) was committed by another author onto this branch during the run; it is *behind* the diff range, not inside it, and shares no file with this change. |
| Verification date | 2026-08-21 |

Both subagent diffs were read in full at the integration gate and again here.
No implementation summary was accepted as proof.

## Requirement Compliance

Browser evidence is DOM and SVG attribute readings at 375 × 812 on the scratch
origin `:5233`, with training data seeded and deleted (`sessions` back to 1,
`exerciseSessions` 4, `completedSets` 3 — confirmed after each pass).

| Req / AC | Implementation Evidence | Independent Check | Result |
|---|---|---|---|
| R-1 / AC-1 | `estimatedOneRepMaxKg` is `sets.reduce(max of estimateOneRepMaxKg)` | Unit: session of `100×5@RIR0` + `110×1@RIR0` → `topSetKg` 110, estimate **116.67**. The lighter set wins, which is the whole point of the rule | Pass |
| R-2 / AC-2 | `weightKg × (1 + (reps + rir) / 30)` | Unit table `116.67 / 103.33 / 123.33 / 100`; a `lb` set estimates from `weightKg` and lands below its own pound number | Pass |
| R-3 / AC-3 | reps and rir are non-negative at entry | Unit assertion across a mixed series. **Independently traced to the boundary:** `Field` clamps with `Math.max(0, …)` when stepping and rejects `parsed < 0` when typed ([`SetLogger.tsx:170,177`](../../../src/features/session/SetLogger.tsx)). Holds for every set the app can produce — see V-1 for the other door | Pass |
| R-4 / AC-4 | fourth `Metric`, `METRICS` and `READING` entries | Browser: tabs read `Load · e1RM · Reps · Volume`; selecting e1RM redraws and the spoken label says `estimated 1RM … kg` | Pass |
| R-5 / AC-5 | running maximum, strict, gated on `index > 0` | Unit: `100,105,105,103,110` → `[false,true,false,false,true]`; unsorted input judged after sorting; an unfinished session can hold one | Pass |
| R-6 / AC-6 | fill swap on the same circle | Browser, two independent datasets. Record-in-the-middle: `[{4.5,card},{4.5,actual},{6,card}]`. **Record-as-latest** (a case the implementation pass never observed — see G-1): `[{4.5,card},{4.5,actual},{4.5,card},{6,actual}]`. Both halves of "the latest stays larger whether or not it is a record" are now seen. Marking is metric-independent — same fills under `load` and `e1rm` | Pass |
| R-7 / AC-7 | `ExerciseSummary` untouched | Browser: `/exercises/front-squat` renders exactly `current working weight · best set · heaviest · lightest`, and the page contains neither "estimated" nor "record" | Pass |
| R-8 / AC-8 | max over the points, not the last flagged one | Browser: with the max in the middle it read **119.6 kg · Thu, Aug 20** (`102.5 × 7/6`); with the max last, **163.3 kg · Sat, Aug 22** (`140 × 7/6`). It tracks the maximum, not the latest | Pass |
| R-9 / AC-9 | records clause appended in `describe()` | Browser: `…— rising. 2 personal records along the way.` and `…— falling. 1 personal record along the way.` On the unseeded single-session history the clause is **absent** | Pass |
| R-10 / AC-10 | nothing stored | Diff touches no file under `src/db/` or `src/domain/backup/`; no schema, index, Dexie version or `BACKUP_VERSION` change | Pass |
| R-11 / AC-11 | pure, in `domain/` | No React or Dexie import; 11 new tests; `features → db → domain` intact | Pass |
| R-12 / AC-12 | §11.11 and §39 | §11.11 states both metrics and carries the `100×5` vs `110×1` case; §39 rows 1–2 are ✅ with evidence | Pass |

## Automated Checks

| Command | Result | Covers | Evidence |
|---|---|---|---|
| `pnpm typecheck` | Pass | all | both tsconfigs clean |
| `pnpm lint` | Pass | all | eslint clean |
| `pnpm test` | Pass | R-1…R-3, R-5, R-11 | **26 files, 395 tests**, 0 failures |
| `pnpm build` | Pass | R-4, R-10 | 0 errors |
| `vitest --coverage` on `src/domain/history.ts` | Pass | R-11 | see metrics |
| `pnpm exec stryker run` (the repo's own configured gate, unmodified) | Pass | R-11 | see metrics |

## QA

1. `/progress`, single-session history. Expected: figure and four metrics, no records clause. Actual: `BEST ESTIMATED 1RM 3.1 kg`, four tabs, clause absent. (`2.5 × (1 + 7/30) = 3.083`, RIR 1.)
2. Seed two earlier sessions (100 kg, then 102.5 kg). Expected: middle point a record. Actual: dots `[card, actual, card]`, aria `1 personal record`, figure `119.6 kg · Thu, Aug 20`.
3. Switch to the e1RM tab. Expected: same marking, kg readings. Actual: `from 116.7 to 3.1 kg`, identical fills.
4. `/exercises/front-squat`. Expected: §11.10 unchanged. Actual: its four figures, nothing new mentioned.
5. Re-seed so the **record is the latest point**. Expected: `r=6` and filled together. Actual: `[{4.5,card},{4.5,actual},{4.5,card},{6,actual}]`, aria `2 personal records`, figure `163.3 kg · Sat, Aug 22`.
6. Delete every seeded row. Expected: store restored. Actual: `sessions 1, exerciseSessions 4, completedSets 3`.

## Ownership and Scope

| Writer | Assigned Write Set | Actual Files | Compliant? |
|---|---|---|---|
| Integration owner | `domain/history.ts`, `domain/history.test.ts`, `docs/PRD.md`, `docs/changes/…` | exactly those | Yes |
| Subagent A | `ExerciseChart.tsx` | exactly that | Yes |
| Subagent B | `ProgressScreen.tsx` | exactly that | Yes |

Confirmed **not** touched: `pnpm-lock.yaml`, `package.json`,
`stryker.config.json`, `vitest.config.ts`, `wrangler.jsonc`, `src/db/**`,
`src/domain/backup/**`, `src/domain/progression/**`, `src/features/history/**`.

## Contract / Integration Review

- **Frozen contract fidelity:** `ExercisePoint` gained two fields — additive, and
  the type is derived, never persisted or parsed, so no stored document changes
  shape. `ExerciseSummary`, `summarizeExercise`, `better()`, `topSetKg`,
  `topSetReps`, `reps` and `volumeKg` are unchanged in type and in meaning.
- **Integration wiring:** the one seam between the two parallel writers — a
  `round()` helper copied because its home file was not the copier's to edit —
  was resolved by the integration owner, who owned both files: the existing
  helper is exported and imported. No third file was pulled into the write set.
- **DESIGN.md §Charts:** no second Y axis, no gradient, no series shadow; dots
  stay `r=4.5` / latest `r=6`; the record uses `{colors.actual}`, the stroke's
  own colour, rather than borrowing `{colors.progress}`, which on this skin means
  *derived/projected* and would have said the opposite of "record".
- **Generated / migration / project / lockfile:** none in the diff.

## Quality Metrics

Scope: `src/domain/history.ts` — the only changed file either tool covers.

- Changed-line coverage: **100%** (29/29) — strict target 90%.
- Changed-branch coverage: **100%** (20/20) — strict target 80%.
- Statements: **100%** (33/33).
- Mutation, `history.ts`: **94.57%** — strict target 70%; repo break threshold 80.
- Mutation, repo-wide with the unmodified config: **92.02%**, gate passed.
- Surviving mutants in `history.ts`: **5**, all classified below.
- Flaky/skipped tests affecting scope: none.

### Surviving mutants

| Line | Code | Classification |
|---|---|---|
| 48, 49 | `better()`'s `!==` and `>=` | **Pre-existing** |
| 101 | `latest === null \|\| …` in `summarizeExercise` | **Pre-existing** |
| 110, 111 | `heaviest` / `lightest` reduces | **Pre-existing** |

Verified pre-existing rather than assumed: none of these five lines appears as an
added line in `git diff 45e6314 -- src/domain/history.ts`. **Zero survivors in
new code.**

## Missing / Partial Requirements

None. All twelve requirements carry implementation evidence and independent
validation.

## Extra / Unrequested Changes

None. Every hunk maps to a requirement or to the one declared integration seam.

## Findings

**V-1 — the backup schema admits negative reps, RIR and weight.**
`completedSet` in [`schema.ts:234`](../../../src/domain/backup/schema.ts) is
`reps: z.number().int()`, `rir: z.number()`, `weightKg: z.number()` — **no lower
bound on any of them**. The app's own entry path clamps (traced above), so this
is unreachable through the UI; a restored backup is the other door, and
`parseBackup` is the trust boundary that would have to refuse it.

Pre-existing, and **not** introduced or worsened by this change — but this change
is the first consumer that turns those numbers into a *claim about a lifter's
strength*: a hand-edited backup carrying `rir: -40` yields a negative estimated
1RM, and AC-3's invariant (`estimate >= topSetKg`) stops holding. Out of this
change's write set — `src/domain/backup/**` is explicitly "do not touch" — and
not fixed here. Reported for the change owner; the fix is `.min(0)` on the three
fields plus a fuzz case.

**G-1 — a gap in the implementation pass's QA, closed here.**
That pass verified the latest point rendering `r=6` while *not* being a record,
and reported AC-6 satisfied. The other half of AC-6's sentence — the latest point
that *is* a record, needing `r=6` and the fill together — was never observed. A
second dataset was seeded here specifically to exercise it. It passes; the point
is that it had not been shown.

## Security / Tenant / Permission / Compatibility Concerns

None. The change is read-only over data already stored, adds no persistence, no
network call and no permission surface. A backup written before this change still
restores unchanged, because nothing here is serialised.

## Limitations or Deviations

**L-1 — nothing was photographed.** The Browser pane does not composite in this
environment, so every visual claim above is an attribute read off the DOM or the
SVG — `fill`, `r`, `aria-label`, rendered text — not a picture. For the record
dot that is arguably stronger evidence than eyeballing a colour; for layout,
spacing and type it means the figure's placement on the Progress screen is
**asserted from the shared tokens it wears, not seen**.

**D-1 — the base moved mid-execution.** Preflight recorded `9ec8e9a`; another
author committed `45e6314` onto the branch while the subagents ran. It shares no
file with this change, the diff range was re-baselined rather than forced, and
nothing was reverted or rebased. Recorded because a second author writing to the
same branch during a fan-out is a condition worth knowing about, not because it
affected this result.

## Merge Risk

**Low.**

Behaviour is additive and derived — nothing is stored, no document shape moves,
and a pre-change backup restores unchanged. Both parallel writers stayed inside
their exact write sets and the single seam between them was closed by the
integration owner. All four repository gates pass, changed-line and
changed-branch coverage are both 100%, mutation clears the repo's own threshold
with zero survivors in new code, and every acceptance criterion was observed in a
running browser rather than inferred. V-1 is a pre-existing validation gap worth
a separate small change; L-1 is an environment limit, not a defect.
