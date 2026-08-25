# Exercise Measurement Audit

Status: Ready after explicit decisions
Size: large
Reliability: critical

## Baseline

| Field | Value |
|---|---|
| Repository root | `C:\Users\Josue Escobar\Documents\projects\mine\TrainLog` |
| Branch | `master` |
| Commit SHA | `e974365f4b86b84866790a973c5cf74c41d38694` |
| Working tree | Clean |
| Relevant pre-existing changes | `2026-08-24-routine-authoring` merged (PR #6). `2026-08-25-session-effort` landed. `docs/changes/2026-08-24-exercise-measurement/` holds `shaping.md` only — no code exists for this change. |
| Audit date | 2026-08-25 |

Validation baseline, executed at this SHA:

- `pnpm test` — 35 files, 557 tests, all passing, exit 0.
- `pnpm typecheck` — clean, exit 0.
- `pnpm lint` — clean, exit 0.

DEC-G's precondition is satisfied: routine-authoring has landed, and nothing in
the tree references `measurement` (the two grep hits in `session-summary.ts:144`
and `features/ui/fields.tsx:112` are prose about the word "measurement", not the
field).

## Desired Outcome and Constraints

- **Outcome:** an Exercise declares how it is measured; a set collects the
  fields that type asks for and only those; every derived figure knows which
  axis it reads and which direction is better.
- **Included:** the eight types of DEC-A; the set-logging surface; the derived
  figures; bodyweight over time as the enabler for the two bodyweight-relative
  types.
- **Excluded** (from shaping, all confirmed as untouched by this audit):
  reinterpreting stored history beyond a mechanical backfill; sensors of any
  kind; §39 items 9–11 (warm-up, supersets, drop sets); renaming or removing a
  catalog slug (REQ-023).

## Current Behavior Trace

The one path that decides everything else — logging a set and reading it back:

1. `src/features/session/ExerciseView.tsx:53` — the exercise fills the screen.
   The unit is resolved by a fixed precedence chain at line ~88:
   `lastSet?.unit ?? planned?.plannedUnit ?? suggestion?.unit ?? previousSets[0]?.unit ?? defaultUnit`.
2. `src/features/session/SetLogger.tsx:SetFields` — renders exactly three
   `Field` controls, hard-coded: `weight` (with unit), `reps`, `RIR`. The green
   button is disabled only on `values.reps === 0`; a weight of 0 is explicitly
   allowed, with the comment *"A load of zero is a bodyweight exercise"*.
3. `src/domain/session/index.ts:logSet` — builds `CompletedSet` with
   `weightKg: toKg(weight, unit)`. Five value fields, none optional.
4. `src/db/repositories/completedSets.ts:saveLoggedSet` — one transaction, set
   plus the `performed` transition.
5. `src/domain/history.ts:better` — orders sets by `weightKg`, ties broken by
   `reps`. `estimateOneRepMaxKg` = `weightKg × (1 + (reps + rir) / 30)`.
6. `src/domain/history.ts:exerciseSeries` — `topSetKg`, `reps`,
   `volumeKg = Σ weightKg × reps`, `estimatedOneRepMaxKg`, and `isRecord` as a
   **running maximum** over the ordered series.
7. `src/features/progress/ExerciseChart.tsx:READING` — four metrics, each
   pinned to a literal unit string (`'kg'` or `'reps'`).

**Observable current result:** every exercise in the app is weight × reps. A
plank is logged as reps of an undefined thing; a run cannot be logged at all.
A bodyweight movement is logged at 0 kg and charts as a flat zero line on
Load, e1RM and Volume, while Reps is the only reading that moves.

## Relevant Surface

| Path / Area | Role | Evidence | Confidence |
|---|---|---|---|
| `src/domain/types.ts:54` | `Exercise` — 4 fields, the discriminator's home per DEC-B | read in full | High |
| `src/domain/types.ts:CompletedSet` | 5 value fields; 4 become conditional | read in full | High |
| `src/domain/types.ts:PlannedExercise` | `minReps`/`maxReps` non-null, `unit` required | read in full | High |
| `src/domain/units.ts` | `Unit = 'kg' \| 'lb'`, `toKg` only. No distance, no duration | read in full | High |
| `src/domain/history.ts` | `better`, `estimateOneRepMaxKg`, `ExercisePoint`, `exerciseSeries` | read in full | High |
| `src/domain/progression/index.ts` | `doubleProgression` reads `set.reps >= maxReps` and `previous.weight + increment` — two literal field reads | read in full | High |
| `src/domain/session/index.ts` | `logSet`, `editSet`, `startPlannedExercise` | read in full | High |
| `src/domain/catalog/data.ts` | 96 rows; `Equipment` vocabulary is gym-only | counted, read | High |
| `src/domain/backup/schema.ts` | Zod row shapes; `completedSet` requires all five | read in full | High |
| `src/domain/backup/document.ts` | `BACKUP_VERSION = 1`, nine tables | read in full | High |
| `src/domain/backup/csv.ts` | `CSV_HEADER` single literal | read in full | High |
| `src/domain/routine-file/schema.ts` | `reps: rangeSchema` — **structurally required** | read in full | High |
| `src/db/schema.ts` | `SCHEMA_VERSION = 2`; nine stores; `backfillPlannedUnit` precedent | read in full | High |
| `src/db/migrations.test.ts` | raw-IndexedDB v1 seeding harness — reusable | read header | High |
| `src/features/session/SetLogger.tsx` | the three hard-coded fields | read in full | High |
| `src/features/routines/AddToRoutine.tsx` | add-Planned-Exercise form; Exercise is picked *before* target fields render | grepped structure | Medium |
| `src/features/exercises/ExerciseCatalogScreen.tsx:301` | the only `createUserExercise` call site | grepped | High |
| `src/features/progress/ExerciseChart.tsx` | `Metric`, `METRICS`, `READING` | read in full | High |
| `src/domain/session-summary.ts:effortOf` | reads `rir` + wall minutes **only** | read | High |
| `src/domain/scheduling/index.ts:estimateDuration` | reads `sets` + `restSeconds` **only** | read | High |

**Blast radius, measured:** 31 non-test source files and 23 test files reference
`weightKg`, `reps`, `minReps` or `maxReps`. 73 `weightKg` references tree-wide
(shaping estimated 71; session-effort added two).

## Actual Problem / Change Location

The problem is not that `CompletedSet` lacks fields. It is that **three
different layers each hard-code the same assumption independently**, and no
single seam exists where "which axis, which direction" could be answered once:

1. **Storage** — `CompletedSet` states five required value fields
   (`types.ts`, mirrored in `backup/schema.ts`, mirrored again in `csv.ts`).
2. **Derivation** — `better()`, `estimateOneRepMaxKg()`, `exerciseSeries()`
   and `doubleProgression()` each read `.weightKg` and `.reps` directly. Four
   independent readings of the same assumption.
3. **Presentation** — `SetFields`, `SetPill`, `format.ts:load`,
   `format.ts:setLine` and `ExerciseChart.READING` each restate the notation
   `weight unit × reps`.

DEC-B puts the discriminator on `Exercise`, which is well-founded — but
`Exercise` is **not reachable** from three of those call sites.
`domain/history.ts` and `domain/progression/index.ts` receive
`SessionHistory` (Session + ExerciseSession + CompletedSet); neither carries
an `Exercise`, and `SessionHistory` is the exact shape the repositories were
built to assemble. `SetPill` receives a bare `CompletedSet`.

So the change's real location is a decision the shaping did not surface: the
measurement must either travel with the set (denormalized onto `CompletedSet`
or onto `ExerciseSession` as another snapshot field, in the manner
`plannedUnit` already travels) or every derivation signature must grow an
`Exercise` parameter. This is the largest structural fork in the change and it
is not listed among the shaping's unresolved items.

## Contracts and Boundaries

| Contract / Boundary | Current Shape | Consumers | Change Risk |
|---|---|---|---|
| `SCHEMA_V1` / nine tables | `db/schema.ts`; `schema.test.ts:147` asserts `TABLE_NAMES` has length 9 | REQ-070, §17, `backup/document.ts` | **High** — a bodyweight table breaks a named test, REQ-070, §17 and the "no translation layer" property |
| `BACKUP_VERSION = 1` | `document.ts`, deliberately decoupled from `SCHEMA_VERSION` | every exported file a lifter holds | **High** |
| `CSV_HEADER` | `date,exercise,set,weight,unit,reps,rir` | external spreadsheets (§19) | **Medium** — see contradiction 3 |
| Routine file v1 | `version: z.literal(1)`; `reps` required, no duration/distance keys | `docs/bloque-a`, `docs/bloque-b`, `docs/examples/*.yaml` | **High** — a duration exercise is unwritable in v1 |
| Catalog slugs | permanent (REQ-023) | stored history, the repo's own programme files | **High** |
| `Unit` in CONTEXT.md | *"The weight unit an Exercise is logged in"* — binding on identifiers | whole tree | **Medium** — reusing it for distance contradicts a binding definition |
| `ADR 0002` snapshot | planned values copied on start, never read back | `PlannedExerciseSession` | Low — the change extends it, does not violate it |
| `ADR 0001` | Placement ↔ Session never reference each other | scheduling | Low — untouched |

## Tests and Validation

| Test / Command | Covers | Gap | Prerequisite |
|---|---|---|---|
| `pnpm test` | 557 tests, 35 files | none for measurement | none |
| `pnpm typecheck` | both tsconfigs | — | none |
| `pnpm lint` | eslint flat config | — | none |
| `src/db/migrations.test.ts` | v1→v2 backfill via **raw IndexedDB** | pattern is directly reusable for v2→v3 | `fake-indexeddb` |
| `src/db/schema.test.ts:147` | "exactly the nine tables of REQ-070" | **will fail** if a tenth table is added | none |
| `src/domain/backup/schema.fuzz.test.ts` | backup validator robustness | must be extended per new field | none |
| `src/domain/history.test.ts`, `progression/index.test.ts` | current weight×reps derivations | no inverted-axis coverage exists | none |
| `stryker.config.json` | mutation testing configured | not run in this audit | — |

**Named gap:** nothing in the suite exercises an exercise whose better
direction is *downward*. That is the defect class DEC-A item 3 exists to
prevent, and it currently has zero coverage.

## Candidate Ownership

| Workstream | May Read | Candidate Write Set | Coupling / Conflict Risk |
|---|---|---|---|
| WS-A Contract | all | `domain/types.ts`, `CONTEXT.md`, `AGENTS.MD` | **Gate 0.** Everything else waits on it. Single writer. |
| WS-B Catalog | `domain/types.ts` | `domain/catalog/data.ts`, `catalog/index.ts`, `catalog/index.test.ts` | Low once WS-A freezes the type |
| WS-C Persistence | `domain/types.ts` | `db/schema.ts`, `db/migrations.test.ts`, `db/schema.test.ts`, `db/repositories/*` | **Migration owner required.** Sole writer of `SCHEMA_VERSION` |
| WS-D Derivation | `domain/types.ts` | `domain/history.ts`, `domain/progression/index.ts`, + their tests | Medium — `SessionHistory` shape is shared with WS-C |
| WS-E Backup/CSV | `domain/types.ts` | `domain/backup/*`, `db/repositories/backup.ts` | Sole writer of `BACKUP_VERSION` |
| WS-F Routine file | `domain/types.ts` | `domain/routine-file/*` | Low; owns the file-version question |
| WS-G Logging UI | `domain/types.ts` | `features/session/*`, `features/ui/SetPill.tsx`, `features/ui/format.ts` | Medium |
| WS-H Read UI | WS-D output | `features/progress/*`, `features/history/*` | Depends on WS-D's `ExercisePoint` |
| WS-I Authoring UI | WS-B | `features/exercises/ExerciseCatalogScreen.tsx`, `features/routines/AddToRoutine.tsx`, `features/import/*` | Medium |

**Parallel execution is not safe without Gate 0.** WS-D, WS-E, WS-G and WS-H
all read the same discriminated union; if it is not frozen first, four
workstreams will invent four incompatible shapes for it. With `domain/types.ts`
frozen as a contract, the write sets above are plausibly disjoint — the one
genuine overlap is `SessionHistory`, read by WS-D and assembled by WS-C.

`domain/types.ts` and `CONTEXT.md` are merge-conflict hotspots: every
workstream wants to touch them. Both should be integration-owned.

## Integration and Generated-File Hotspots

| File / Area | Why Shared | Required Control |
|---|---|---|
| `src/domain/types.ts` | every workstream imports it | Gate 0, single writer, frozen before fan-out |
| `CONTEXT.md` | vocabulary is binding on identifiers | integration owner; one edit at the end |
| `src/db/schema.ts` | `SCHEMA_VERSION` is a single number | WS-C only |
| `src/domain/backup/document.ts` | `BACKUP_VERSION` is a single number | WS-E only |
| `docs/PRD.md` §11.7, §14.8, §19, §39 | four sections amended by one change | integration owner, one commit |
| `pnpm-lock.yaml` | no new dependency is required by this change | should not appear in the diff |

No generated files, no codegen, no migrations directory — the Dexie upgrade is
hand-written in `db/schema.ts`.

## Supported Options

| Option | Evidence | Pros | Cons | Approval Status |
|---|---|---|---|---|
| **Measurement travels on `CompletedSet`** | `plannedUnit` precedent (`types.ts`), `SessionHistory` carries no `Exercise` | derivations need no new parameter; a set is self-describing in the backup and CSV | denormalized; contradicts DEC-B's *spirit* (though not its letter — DEC-B places the *declaration*, not the copy) | Not approved |
| **Measurement snapshotted onto `ExerciseSession`** | exactly what ADR 0002 does for `plannedUnit` | one row per exercise, not per set; `SessionHistory` already carries it | `SetPill` receives a bare `CompletedSet` and would still need it passed down | Not approved |
| **Derivations take an `Exercise` parameter** | strictest reading of DEC-B | no denormalization | changes the signature of `summarizeExercise`, `exerciseSeries`, `suggestLoad`, `projectNextLoad` and every caller; repositories must join | Not approved |
| **Bodyweight as a tenth table** | `schema.test.ts:147` would need amending | answers "what did I weigh on a rest day" | amends REQ-070 and §17; breaks the field-for-field property | Not approved |
| **Bodyweight snapshotted onto `Session`** | ADR 0002 philosophy | no table, no §17 amendment | cannot record a weigh-in on a rest day | Not approved |
| **Distance as a second unit axis** (`DistanceUnit = 'km' \| 'mi'`) | `Unit` is bound to weight in CONTEXT.md | honest; mirrors the existing kg/lb design | second conversion function, second stored derived value | Not approved |
| **Distance always stored in metres** | — | one axis, no conversion | stores a number the lifter never typed, which §11.7 explicitly avoids for weight | Not approved |
| **CSV: additive columns** | precedent exists — see contradiction 3 | consistent with how `unit` was already added | widens a file someone parses | Not approved |
| **Catalog: type all 96 now** | build-time, no migration either way (DEC-007) | no half-typed catalog | 96 judgement calls in one review | Not approved |

## Material Decisions Needed

| ID | Decision | Why It Matters | Supported Options | Blocking? |
|---|---|---|---|---|
| DEC-Q1 | How does `measurement` reach `history.ts`, `progression/index.ts` and `SetPill`? | `SessionHistory` carries no `Exercise`. This is the structural fork of the whole change and is **not** in the shaping's list | on `CompletedSet` / snapshot on `ExerciseSession` / new parameter | **Yes** |
| DEC-Q2 | Where does bodyweight live? | tenth table amends REQ-070 + §17 + a named test; `Session` snapshot cannot answer a rest-day weigh-in | table / Session snapshot | **Yes** |
| DEC-Q3 | Does distance carry its own unit axis? | `Unit` is bound to *weight* in CONTEXT.md; reusing it breaks a binding definition | second axis / metres-only / km-only | **Yes** |
| DEC-Q4 | Does the routine file format version move to 2? | `reps` is structurally required in v1; a duration exercise is unwritable today. `version: z.literal(1)` refuses anything else | v2 / optional keys within v1 | **Yes** |
| DEC-Q5 | What does a stored 0 kg set become? | nothing in the data distinguishes `bodyweight_reps` from `weight_reps` at 0 kg — see contradiction 2 | all → `weight_reps` / heuristic per-exercise / ask the lifter | **Yes** |
| DEC-Q6 | Does `CSV_HEADER` grow, split, or stay? | §19's stated purpose is external analysis | additive / second file / unchanged | No — can follow |
| DEC-Q7 | Are all 96 catalog rows typed in this change? | scope call, no migration cost either way | all / default + correct later | No |
| DEC-Q8 | Can an existing Exercise's measurement be corrected? | no edit verb exists; §39 item 7 is 🟡 (create only). Without one, the backfill types a user Exercise forever | in scope / defer to §39 item 7 | No |
| DEC-Q9 | What is a record for the five types with no e1RM? | §11.11 defines records only through estimated 1RM | Riegel / per-axis best / no record | No |

## Assumptions

| ID | Assumption | Validation | Stop If False |
|---|---|---|---|
| ASM-1 | `effort` needs no change and remains the cross-modal figure | **Validated.** `effortOf` (`session-summary.ts:158`) reads only `set.rir` and wall-clock minutes | — |
| ASM-2 | `estimateDuration` is measurement-agnostic | **Validated.** Reads only `sets` and `restSeconds` (`scheduling/index.ts:270`) | — |
| ASM-3 | `z.object` strips unknown keys, so a version gate is the only protection | **Validated** by the code's own design: `backup/schema.ts` uses `looseObject` for the unplanned member *precisely because* `object` strips before checks run | `BACKUP_VERSION` need not move |
| ASM-4 | The v1→v2 backfill pattern is reusable for v2→v3 | **Validated.** `backfillPlannedUnit` + `migrations.test.ts` raw-IndexedDB harness | migration must be designed from scratch |
| ASM-5 | `AddToRoutine` knows the Exercise before rendering target fields | Grepped: an Exercise is bound, then `NumberField`s render (lines 439–493). Not traced through every branch | conditional target fields need a form restructure |
| ASM-6 | No new dependency is required | `package.json` read; Zod discriminated unions and Dexie upgrades cover it | scope grows |

## Contradictions and Risks

1. **The PRD states the set shape as universal — confirmed, twice.** §11.7
   (`docs/PRD.md:839`) and §14.8 (`:1390`) both list `weight, unit, weightKg,
   reps, rir` as what every set stores. This change makes four of five
   conditional. Both sections need amending.

   **New evidence that softens it:** §11.7's own "could be added later" list
   already names `assistance` — the PRD anticipated one of the eight types, and
   placed the *value* on the set while the *declaration* stays on the Exercise.
   That is exactly DEC-B's split.

2. **A 0 kg bodyweight set is genuinely indistinguishable — confirmed.**
   `SetLogger.tsx` blocks only `reps === 0`; a weight of 0 is explicitly
   allowed and commented as bodyweight. `backup/schema.ts` types `weight` as
   `measure = z.number().min(0)`. **No field, flag or derived value separates a
   bodyweight set from a weighted set entered at zero.** A backfill typing
   every stored set `weight_reps` is therefore lossy for exactly the sets that
   motivated this change. DEC-Q5 is a data decision, not a code decision.

3. **`CSV_HEADER` is less frozen than the shaping believed.** PRD §19's example
   header (`docs/PRD.md:1595`) is `date,exercise,set,weight,reps,rir` — no
   `unit`. The shipped `CSV_HEADER` is `date,exercise,set,weight,unit,reps,rir`.
   **The code already deviated from the PRD by one additive column**, with the
   reasoning recorded in `csv.ts`'s header comment (DEC-B of that change), which
   states the extra column *"is additive for anything reading the file"*.
   A precedent for additive extension exists and is documented. This lowers
   DEC-Q6 from a blocking contract question to a scope call.

4. **The catalog workaround is load-bearing in this repo's own data.**
   `weighted-dip` and `weighted-pull-up` are referenced by `exercise_id` in
   `docs/bloque-a-acumulacion.yaml`, `docs/bloque-b-intensificacion.yaml` and
   `docs/examples/routine.yaml`. These are not hypothetical rows — they are in
   the programme files this repository ships. If those routines have been
   imported, history references those slugs and REQ-023 makes them permanent.
   Retyping them quietly is not available; they must survive alongside any real
   `weighted_bodyweight` typing of `dip`/`pull-up`.

5. **Four of the eight types have zero catalog rows to attach to.** The
   `Equipment` vocabulary is `barbell | dumbbell | machine | cable | bodyweight
   | kettlebell | band` — no cardio equipment exists. There is no run, row-erg,
   bike, swim, sled or carry beyond `farmers-walk`. `plank` is the only true
   duration movement in 96 rows. So `duration`, `distance_duration` and
   `weight_distance` ship with an effectively empty catalog unless rows are
   added — which REQ-023 permits (adding is allowed) but which the shaping did
   not scope.

6. **`§39` has no slot for this change.** Group C lists items 9–12 (warm-up
   sets, supersets, drop sets, deload). Measurement is absent. The change must
   add a numbered row, and §39's own instruction is that the table is updated in
   the same commit that closes a change.

   Supporting: §39 A·15 already states this change's motivation in the PRD's own
   words — *"el volumen en kg·reps no ve una carrera ni un hold, y un programa
   híbrido necesita una cifra que sí"*.

7. **Risk — inverted axes have no test coverage today.** Two of eight types
   invert (`assisted_bodyweight`, and pace within `distance_duration`).
   `exerciseSeries`'s `isRecord` is a running **maximum** and `better()` prefers
   the **larger** `weightKg`. Both silently produce a wrong-but-plausible answer
   for an inverted axis — the failure looks like training, which is the same
   class of defect `backup/schema.ts` refuses negative reps to prevent.

8. **Risk — `SCHEMA_VERSION` and `BACKUP_VERSION` are decoupled by design** and
   the reason is documented in `document.ts`: *"a lifter's saved backups must
   not be invalidated by a change they cannot see"*. Moving both without stating
   why would contradict that comment; moving neither, given ASM-3, silently
   drops `measurement` when an older build restores a newer file.

## Do Not Touch

- `src/domain/session-summary.ts:effortOf` — validated measurement-agnostic
  (ASM-1). DEC-E holds; changing it would break the one cross-modal figure.
- `src/domain/scheduling/index.ts:estimateDuration` — validated
  measurement-agnostic (ASM-2).
- Catalog slug identity — REQ-023. Add rows; never rename or remove one.
  Specifically `dip`, `weighted-dip`, `pull-up`, `weighted-pull-up`, `plank`.
- ADR 0001 — Placement and Session must not learn about each other.
- ADR 0002 — no derivation may read a planned target back through
  `plannedExerciseId`.
- The "no stored suggestion" rule (§11.9) — no `currentWorkingWeight`,
  no stored per-axis best.
- Unrelated in-flight work: none. Tree is clean.

## Recommended Next Step

**Obtain decisions, then write the spec.**

DEC-Q1 through DEC-Q5 are blocking and must be answered before
`writing-change-spec` runs. DEC-Q1 in particular is new — it was not among the
shaping's unresolved items, and it determines whether this change is a
type-plus-migration (measurement travels with the data) or a tree-wide
signature change (measurement is looked up from `Exercise`). Specifying the
other eight decisions on top of an unanswered DEC-Q1 would produce a spec whose
write sets are wrong.

No targeted follow-up audit is required: every area named in the shaping's
"Suspected area" was inspected, and the two contradictions the shaping could not
settle from prose (the 0 kg set, the CSV header) are now settled as facts.
