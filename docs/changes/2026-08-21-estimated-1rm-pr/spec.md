# Estimated 1RM + PR detection — Spec

Status: Ready for implementation
Size: medium
Reliability: strict
Base: `master`/`change/exercise-catalog` at `9ec8e9a`, clean working tree.

## Goal

A lifter sees, on the Progress screen, how strong an exercise has actually made
them — not just the weight on the bar. Every session gets an estimated one-rep
max that accounts for how close to failure the set was, the chart can draw that
estimate over time, and the sessions that beat everything before them are marked
as records.

Done when: §11.11 offers **e1RM** as a fourth metric, the chart marks record
sessions distinctly and says so to a screen reader, and a figure names the best
e1RM and when it happened. Nothing is stored; all of it works offline.

This closes §39 A·1 (estimated 1RM) and A·2 (PR detection).

## Evidence and Current Behavior

Verified by inspection at `9ec8e9a`:

- **RIR is always present.** `CompletedSet.rir` is `readonly rir: number`
  ([`types.ts:250`](../../../src/domain/types.ts)), `z.number()` in the backup
  schema ([`schema.ts:242`](../../../src/domain/backup/schema.ts)), and both
  `logSet` and `editSet` always write it
  ([`session/index.ts:157,343`](../../../src/domain/session/index.ts)). The chosen
  formula needs no fallback and no nullability handling.
- **`ExercisePoint` is where a per-session metric belongs.** It already carries
  `topSetKg`, `topSetReps`, `reps` and `volumeKg`
  ([`history.ts:113`](../../../src/domain/history.ts)).
- **The chart's metric list is open.** `METRICS` and `READING`
  ([`ExerciseChart.tsx:30-44`](../../../src/features/progress/ExerciseChart.tsx))
  are a list and a `Record` keyed by metric; a fourth entry is two additions, not
  a restructure.
- **The series is already ordered oldest-first** and sorts rather than assumes
  ([`history.ts:142`](../../../src/domain/history.ts)), which is exactly what a
  running maximum needs. `summarizeExercise` by contrast declares its input may
  arrive in any order.
- **`better()` chooses by load, then reps**
  ([`history.ts:47`](../../../src/domain/history.ts)). Under e1RM that stops being
  the same choice — see R-1, which freezes the difference rather than leaving it
  to implementation.
- **DESIGN.md §Charts has no "record" mark, and `{colors.progress}` is already
  spoken for** — it names the *Derived* (projected) segment, dashed, with a
  `progress-wash` terminal dot. Reusing that hue for a record would say
  "projection". The Actual series is fixed at `r=4.5` white fill with a 2.5 px
  `{colors.actual}` stroke, latest `r=6`.
- **Every chart must carry `role="img"` and an `aria-label` stating the trend in
  words** (DESIGN.md §Charts); `describe()` already builds that sentence.
- **`domain/history.ts` is inside Stryker's mutate scope**
  ([`stryker.config.json:11`](../../../stryker.config.json)) with `break: 80`. This
  change is under that gate automatically — unlike the catalog change, no CLI
  override is involved.
- **Two screens read this module.** §11.10's `ExerciseHistoryScreen` calls
  `summarizeExercise`; §11.11's `ProgressScreen` calls both it and
  `exerciseSeries`. A change to `ExerciseSummary` moves figures on a screen this
  change is not meant to touch.

## Scope

Included:

- `estimatedOneRepMaxKg` on `ExercisePoint`;
- `e1rm` as a fourth chart metric;
- record detection over the series, and its mark on the chart;
- a best-e1RM figure on the Progress screen;
- PRD §11.11 and §39 updated.

Excluded:

- **any change to `ExerciseSummary` or to §11.10's screen.** The four figures
  there stay exactly as they are; see R-7.
- workout volume, workout adherence, calendar statistics, advanced charts —
  §39 A·3 to A·6, deliberately not in this slice.
- storing e1RM or record status anywhere. Both are derived on read (§11.9).
- any schema, index, Dexie version or `BACKUP_VERSION` change.
- a cap or guard on the formula at high repetitions — see L-1.

## Decisions and Assumptions

- **Decision (user, approved):** e1RM is **Epley over reps + RIR** —
  `weightKg × (1 + (reps + rir) / 30)`. RIR is included because §30 stores it as
  a real result and states it must not be discarded; without it, a set stopped
  well short of failure understates capacity every time.
- **Decision (user, approved):** a **PR is an e1RM record**, not a load record.
  These genuinely differ: 105 kg × 1 @ RIR 0 estimates 108.5, while
  100 kg × 5 @ RIR 0 estimates 116.7.
- **Decision:** a session's e1RM is the **maximum across all of its sets**, not
  the e1RM of the set `better()` picks. `better()` chooses by load first, so it
  would hand back a heavy double while a lighter set that day demonstrated more.
  `topSetKg` and `topSetReps` keep their current meaning, untouched.
- **Decision:** a record is **strictly greater** than every earlier point. Ties
  are not records, and **the first session is not marked** — it has nothing to
  beat, and marking every first session turns the mark into noise.
- **Decision:** a record dot keeps the geometry DESIGN.md fixes (`r=4.5`, latest
  `r=6`) and is **filled with `{colors.actual}`** instead of white. It adds no
  hue, no size and no shape to the chart vocabulary, and a solid dot reads as
  achieved. `{colors.progress}` is not used — it means "projected" there.
- **Decision:** an in-progress session can hold a record, on exactly the rule
  `exerciseSeries` already applies to drawing its point — those sets happened.
  No second, narrower rule is introduced.
- **Assumption:** Recharts passes `index` and the point payload to a custom dot
  renderer, as the existing `Dot` already relies on for `index === last`. Stop if
  the record flag cannot reach the dot without restructuring the series data.

## Requirements and Acceptance

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-1 | `ExercisePoint` carries `estimatedOneRepMaxKg`: the highest Epley-over-reps-plus-RIR value among every set of that Session. | AC-1: a session holding `100 kg × 5 @ RIR 0` and `110 kg × 1 @ RIR 0` yields `116.67`, from the lighter set — not `113.67` from the heavier one. |
| R-2 | The formula is `weightKg × (1 + (reps + rir) / 30)`, over `weightKg` only. | AC-2: `100 × 5 @ RIR 0` → `116.67`; `100 × 1 @ RIR 0` → `103.33`; `100 × 5 @ RIR 2` → `123.33`. A set logged in `lb` is estimated from its `weightKg`, never its `weight`. |
| R-3 | A single rep at RIR 0 estimates above the load itself, and no set estimates below its own load. | AC-3: for every point, `estimatedOneRepMaxKg >= topSetKg`. |
| R-4 | The chart offers `e1rm` as a fourth metric, reading `estimatedOneRepMaxKg`, labelled in kg. | AC-4: the metric switch shows four options; selecting the new one draws the estimate and the axis reads kg. |
| R-5 | A point is a **record** when its `estimatedOneRepMaxKg` is strictly greater than that of every earlier point in the series. The first point is never a record. | AC-5: for a series of `100, 105, 105, 103, 110`, exactly the 2nd and 5th are records — the repeat of `105` is not, the dip is not, and the opening `100` is not. |
| R-6 | Record points are drawn filled in `{colors.actual}`, keeping the `r=4.5` / latest `r=6` geometry. | AC-6: a record dot differs from a non-record dot by fill only; no new hue, radius or shape appears, and the latest point stays the larger one whether or not it is a record. |
| R-7 | `ExerciseSummary` and §11.10's screen are unchanged. | AC-7: `summarizeExercise`'s return type is untouched and `ExerciseHistoryScreen` still shows exactly its four figures. |
| R-8 | The Progress screen names the best e1RM and the day it was reached. | AC-8: the figure reads a rounded kg value and its date; with one session it still reads correctly; with no sessions the screen keeps its existing empty state. |
| R-9 | The chart's `aria-label` states records in words, not only the trend. | AC-9: the label names how many records the series holds; a series with none does not mention them. |
| R-10 | Nothing is stored. No schema, index, Dexie version or `BACKUP_VERSION` change. | AC-10: the diff touches no file under `src/db/schema.ts` or `src/domain/backup/`; the app still restores a backup written before this change. |
| R-11 | The estimate and the records are pure functions in `domain/`, unit-tested, with no React and no Dexie import. | AC-11: `pnpm test` covers the formula, the max-across-sets rule, the strict-greater rule, ties, the first point, and the `lb` case. |
| R-12 | PRD records the two items as built. | AC-12: §11.11 lists e1RM and PR detection as shipped rather than "posteriormente"; §39 rows 1 and 2 move to ✅ with evidence. |

## Contracts and Risk Controls

Changed:

- `ExercisePoint` gains one field. **Additive** — every existing reader keeps
  working, and the type is derived, never persisted or parsed.
- `Metric` gains one member; `METRICS` and `READING` gain one entry each.

Preserved:

- `ExerciseSummary`, `summarizeExercise`, `better()`, `topSetKg`, `topSetReps`,
  `reps`, `volumeKg` — all unchanged in meaning and in type.
- The session rule shared by `summarizeExercise` and `exerciseSeries`: a Session
  counts when it holds sets, whatever its status. Not narrowed.
- Everything measured in `weightKg` (§11.7, AGENTS.MD invariant).
- Derived, never stored (§11.9).
- DESIGN.md §Charts: no second Y axis, no area gradient, no drop shadow,
  `role="img"` with a spoken label, `overflow-x: auto` container.

Risk control: `domain/history.ts` renders figures on **two** screens. AC-7 is the
control, and it must be checked by reading §11.10 in the browser, not by
inspecting the type alone.

## Quality Obligations

- **Tests:** unit tests in `src/domain/history.test.ts` for the formula at known
  values, the max-across-sets rule, `lb` input, strict-greater, ties, the first
  point, a decreasing series, and an empty history.
- **QA:** on a 390 px viewport — the four metric options; the record dots against
  a known series; the best-e1RM figure; the spoken label; and §11.10 unchanged.
- **Static/build:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- **Coverage:** changed-line ≥ 90%, changed-branch ≥ 80%.
- **Mutation:** `domain/history.ts` is already in Stryker's configured scope.
  Run `pnpm exec stryker run`; the repo's `break: 80` applies. Every survivor in
  new code must be classified, and an equivalent-mutant claim must say why no
  assertion can kill it.

## Change Surface

Expected edits:

- `src/domain/history.ts` — the formula, the field, the record rule.
- `src/domain/history.test.ts` — its tests.
- `src/features/progress/ExerciseChart.tsx` — the metric, the dot, the label.
- `src/features/progress/ProgressScreen.tsx` — the figure.
- `docs/PRD.md` — §11.11 and §39.
- `docs/changes/2026-08-21-estimated-1rm-pr/verification.md` — new, at the end.

Do not touch:

- `src/domain/history.ts`'s `ExerciseSummary` block, `src/features/history/**`,
  `src/db/**`, `src/domain/backup/**`, `src/domain/progression/**`,
  `stryker.config.json`, `sections.ts`.

## Planning Decision

Plan required: **No.**

One workstream, one owner, linear order: formula and tests → the field → the
record rule → the chart metric → the dot and label → the figure → PRD. No
migration, no rollout, no parallelism.

## Known Limitation

**L-1 — Epley is not capped at high repetitions.** `20 reps @ RIR 5` yields a
factor of 1.83, and the formula is known to overestimate above roughly ten reps.
No cap is added here: the formula was chosen explicitly, a cap is a product
decision nobody has taken, and inventing one would change displayed numbers on
authority this spec does not have. The consequence is stated rather than hidden —
a high-rep accessory set can register a record that a heavy low-rep set would
not. Recorded for the change owner; revisit if it shows up in real data.

## Stop Conditions

Stop and report rather than inventing behavior if:

- the record flag cannot reach the chart's dot renderer without restructuring
  the series (the one assumption above);
- `CompletedSet.rir` turns out to be optional or sentinel-encoded anywhere;
- delivering R-8 or R-9 appears to require changing `ExerciseSummary`;
- a mutation survivor in new code cannot be killed and cannot be shown
  equivalent;
- any part of the work appears to require excluded scope — volume, adherence,
  calendar statistics, or a formula cap.
