# Exercise Measurement — Spec

Status: Ready for planning
Size: large
Reliability: critical
Audit baseline: `e974365f4b86b84866790a973c5cf74c41d38694` (`master`, tree clean,
557 tests / 35 files green, `typecheck` and `lint` clean). Every `path:symbol`
citation in this file is anchored to that tree.

An implementer needs this file plus their own plan section. They do not need
`audit.md`, `shaping.md`, or the conversation that produced either.

Ids prefixed `REQ-0xx`, `AC-0xx`, `DEC-00x` **without further qualification**
refer to **`docs/PRD.md`**. This document's own ids are `REQ-1xx`+, `AC-1xx`+,
`TST-1xx`+, and `DEC-A`…`DEC-P`. Where a provenance cell cites a bare `REQ-071`
or `DEC-007`, it is a PRD id.

## 1. Goal

A hybrid athlete can log and read every kind of work their programme contains,
not only weight × reps.

- An Exercise declares how it is measured, one of nine types.
- A set collects the fields its type asks for, and the screen offers only those.
- Every derived figure knows which axis it reads and which direction is better —
  including the two that invert, where a running maximum is the wrong answer.
- Bodyweight is recorded over time, so the two bodyweight-relative types are
  comparable to something other than themselves.

**The invariant this amends.** §11.7 and §14.8 both state the set shape as
universal — `weight, unit, weightKg, reps, rir` for *every* completed set. After
this change, `reps` is conditional and three new value fields exist. Both PRD
sections are amended in the same commit; this is not routed around in code.

## 2. Scope

### Included

- A `Measurement` type and one module that owns, for each of the nine types:
  which fields a set collects, which axis progress is read on, and which
  direction is better.
- `measurement` declared on `Exercise` and snapshotted onto `ExerciseSession`.
- Conditional set fields: `durationSeconds`, `distance`, `distanceUnit`,
  `distanceM`; `reps` widened to nullable.
- A nullable `minTarget`/`maxTarget` pair on `PlannedExercise` and its snapshot,
  so a plank is programmable as `3 × 45s` and a run as `1 × 5 km`.
- A second unit axis for distance, `DistanceUnit` with a derived `distanceM`.
- `bodyweightKg` on `Session`, carried forward and editable.
- Measurement-aware set logging, set editing, and set rendering.
- Measurement-aware derived figures: best set, records, series, chart metrics,
  double progression, and the per-type volume accumulators.
- All 96 catalog rows typed, plus rows added only for movements whose
  *measurement* the catalog cannot currently declare (DEC-S).
- Routine file format v2, with v1 still accepted.
- `SCHEMA_VERSION` 2 → 3, one upgrade, no new table and no new index.
- `BACKUP_VERSION` 1 → 2, with additive CSV columns.
- A narrow correct-the-measurement verb for a user Exercise holding no sets.
- Amendment of §11.7, §14.8, §19, §11.11 and §39, and of `CONTEXT.md`.

### Excluded

- **Rewriting any stored `CompletedSet`.** No stored set is read, altered or
  reinterpreted by the migration (DEC-L). Reinterpretation comes only from the
  Exercise's declaration.
- Renaming or deleting a user Exercise, and correcting the measurement of one
  that **holds logged sets** (DEC-O). That is §39 item 7.
- GPS, heart rate, route maps, or any device sensor.
- §39 items 9–11 (warm-up sets, supersets, drop sets).
- Riegel or any endurance 1RM-equivalent formula (DEC-P).
- A rest-day bodyweight entry (DEC-I's stated ceiling).
- Renaming or removing any catalog slug (REQ-023). Rows may be added.
- Any change to `effortOf` or `estimateDuration` (ASM-1, ASM-2).

**The declaration/value boundary.** The *type* is declared on `Exercise` and
snapshotted onto `ExerciseSession`. The *values* live on `CompletedSet`. No
`CompletedSet` carries a discriminator, so a set can never contradict the
ExerciseSession above it. Every function that must know the type receives it
from the ExerciseSession or as a parameter — never by inferring it from which
fields happen to be populated.

## 3. Required Behavior

| Requirement ID | Requirement | Provenance | Acceptance IDs |
|---|---|---|---|
| REQ-101 | `Measurement` is a closed union of exactly nine types: the eight of DEC-A — `weight_reps`, `bodyweight_reps`, `weighted_bodyweight`, `assisted_bodyweight`, `duration`, `duration_weight`, `distance_duration`, `weight_distance` — plus `distance`, a distance with nothing beside it. | DEC-A, DEC-R | AC-101, AC-167 |
| REQ-102 | One module states, per type: which value fields a set collects, what the weight field *means* (external load, added weight, or assistance), the **target axis** (the axis a programme states a range on), the **progress axis** (the axis a record and an advance are read on), and whether higher or lower is better on the progress axis. Nothing outside it restates any of those facts. The two axes differ for most types and already differ today: §29 states a target in reps and advances the load. | DEC-A·3, §29, audit §"Actual Problem" | AC-102, AC-103, AC-161 |
| REQ-103 | Exactly two types read *lower is better*: `assisted_bodyweight` on its assistance axis, and `distance_duration` on its pace axis (`durationSeconds / distanceM`). `distance` reads higher-is-better — a longer jump is a better jump. | DEC-A·3, DEC-R | AC-103, AC-168 |
| REQ-104 | `Exercise` carries `measurement`. | DEC-B, DEC-H | AC-104 |
| REQ-105 | `ExerciseSessionBase` carries `measurement`, snapshotted when the exercise starts. It is on the base, not among the `planned*` fields: an unplanned exercise has a measurement too. | DEC-H, audit `domain/types.ts:ExerciseSessionBase` | AC-105, AC-106 |
| REQ-106 | `CompletedSet` gains `durationSeconds: number \| null`, `distance: number \| null`, `distanceUnit: DistanceUnit \| null`, `distanceM: number \| null`, and `reps` widens to `number \| null`. `weight`, `unit`, `weightKg` and `rir` stay required and non-null. | DEC-L, audit contradiction 2 | AC-107, AC-108 |
| REQ-107 | `DistanceUnit` is `'m' \| 'km' \| 'mi'`. A distance is stored as entered with its unit, plus a derived `distanceM`, by one conversion function mirroring `toKg`. `Unit` keeps its existing meaning — weight only — and is not widened. | DEC-J, `CONTEXT.md:98` | AC-109, AC-110 |
| REQ-108 | `Session` carries `bodyweightKg: number \| null`. A new Session opens on the most recent non-null value from any earlier Session, and is editable for the length of the Session. `null` where none has ever been recorded. | DEC-C, DEC-I | AC-111, AC-112 |
| REQ-109 | The set logger offers exactly the fields the ExerciseSession's `measurement` asks for, labelled by what the field means for that type — assistance is labelled as assistance, added weight as added weight. | DEC-A·2, REQ-102 | AC-113, AC-114 |
| REQ-110 | The completion guard is per type: the set cannot be logged when the type's **primary** axis is zero or absent. `reps === 0` is no longer the universal guard. | audit `SetLogger.tsx` | AC-115 |
| REQ-111 | The set editor collects the same fields as the logger for the same type, from one shared control. | audit `SetLogger.tsx:SetFields` | AC-116 |
| REQ-112 | A set renders in its type's own notation. A duration set never renders a rep count, and a distance set never renders a weight it does not carry. | DEC-A·2 | AC-117 |
| REQ-113 | `better()` orders two sets by their type's axis in that type's direction. For `assisted_bodyweight` the *less assisted* set is better; ties break on the secondary axis where the type has one. | REQ-102, REQ-103 | AC-118, AC-119 |
| REQ-114 | `estimateOneRepMaxKg` is defined only for the types carrying an external or added load with a rep count (`weight_reps`, `weighted_bodyweight`). For every other type it yields `null`, and no chart, figure or record reads a substitute. For `weighted_bodyweight` it reads the **added weight alone** and never folds in `Session.bodyweightKg`: the stored `weighted-dip` history means added weight today, and folding bodyweight in would silently restate every past estimate. Bodyweight serves the bodyweight-relative comparison figures, not this one. | DEC-P, §11.11, DEC-L | AC-120, AC-121, AC-160 |
| REQ-115 | A record is the best value on the type's own axis in that axis's direction, strictly better than every earlier session, never the first session. For `weight_reps` and `weighted_bodyweight` that axis is estimated 1RM, which preserves today's behavior exactly. | DEC-P, audit `history.ts:exerciseSeries` | AC-122, AC-123, AC-124 |
| REQ-116 | Volume is accumulated per type family and never summed across them: kilogram-reps, reps, seconds and metres are four accumulators, each in its own unit. No figure anywhere claims a single total across families. | DEC-D | AC-125, AC-126 |
| REQ-117 | `SessionSummary.volumeKg` counts only sets whose type produces kilogram-reps. A set with `reps === null` contributes nothing rather than `NaN` or zero. | DEC-D, `session-summary.ts:113` | AC-126 |
| REQ-118 | The chart's metric switch offers only metrics defined for the selected exercise's type, and its Y axis states that metric's own unit. | §11.11, `ExerciseChart.tsx:READING` | AC-127, AC-128 |
| REQ-119 | Double progression generalizes by axis and sign, not by new rule types: when the first N sets meet the range on the **target axis**, the **progress axis** advances by `increment` in that axis's direction. Where a type's two axes are the same, the target range itself advances. This is §29 unchanged for `weight_reps` — target reps, advance load. `increment` stays in the exercise's own unit. | DEC-F, §29, REQ-102 | AC-129, AC-130, AC-131 |
| REQ-120 | For `assisted_bodyweight`, advancing means *reducing* assistance by `increment`, floored at zero. | DEC-F, REQ-103 | AC-131 |
| REQ-121 | `suggestLoad` and `projectNextLoad` continue to share one rule function, so the two cannot disagree about what a met target is. | audit `progression/index.ts` | AC-132 |
| REQ-122 | All 96 catalog rows declare a `measurement`. Rows are added **only** where the catalog cannot declare a movement's measurement at all — the isometric holds (`duration`) and the jumps (`distance`). A missing `weight_reps` or `bodyweight_reps` movement is a catalog gap, not a measurement gap, and `createUserExercise` already covers it; no such row is added here. Every added slug is new, and no existing slug is renamed or removed. | DEC-S, DEC-L, REQ-023 | AC-133, AC-134, AC-135, AC-169 |
| REQ-140 | Added rows reuse the existing `Category` and `Equipment` vocabularies unchanged. A movement that names no muscle group is not added, because `groupExercises` groups by `category` and §39 item 8 depends on that vocabulary staying clean — the second reason no cardio row is added. | DEC-S, `catalog/index.ts:CATALOG_CATEGORIES` | AC-170 |
| REQ-123 | `dip`, `weighted-dip`, `pull-up`, `weighted-pull-up` and `plank` all survive with their slugs intact. `weighted-dip` and `weighted-pull-up` are typed `weighted_bodyweight` and continue to resolve, because the repository's own programme files reference them by `exercise_id`. | REQ-023, audit contradiction 4 | AC-134 |
| REQ-124 | `SCHEMA_VERSION` moves 2 → 3 in one upgrade adding no table and no index. It backfills `measurement` onto `exercises` rows and onto `exerciseSessions` rows. It reads no `completedSets` row and writes none. | DEC-L, DEC-M, audit `db/schema.ts:backfillPlannedUnit` | AC-136, AC-137, AC-138 |
| REQ-125 | User-created Exercises backfill to `weight_reps`. ExerciseSession rows backfill from their Exercise — the catalog first, then the `exercises` table, matching `getExercise`'s existing precedence — falling back to `weight_reps` when neither resolves. | DEC-M, DEC-007 | AC-137, AC-139 |
| REQ-126 | `Session.bodyweightKg` is `null` on every row written before this change. No backfill invents one. | DEC-I | AC-140 |
| REQ-127 | `BACKUP_VERSION` moves 1 → 2. A version-1 document still restores, with the same defaults REQ-125 and REQ-126 apply. A version-2 document is refused by an older build through the existing version gate. | ASM-3, `backup/document.ts` | AC-141, AC-142, AC-143 |
| REQ-128 | The backup validator accepts and refuses the new fields on the same terms as the existing ones: a `measurement` outside the closed union is refused; the new `CompletedSet` fields are nullable and optional so a v1 document is not refused for lacking them. | `backup/schema.ts:progression` | AC-142, AC-144 |
| REQ-129 | `CSV_HEADER` grows by **appending only**: `date,exercise,set,weight,unit,reps,rir,measurement,duration_s,distance,distance_unit`. Every existing column keeps its index. A field the row's type does not carry is written empty. | DEC-N, §19, audit contradiction 3 | AC-145, AC-146 |
| REQ-130 | The routine file accepts `version: 2`, which may declare a measurement per exercise and may omit `reps` for a type that has none. `version: 1` is still accepted and means every exercise is `weight_reps`. | DEC-K, `routine-file/schema.ts` | AC-147, AC-148, AC-149 |
| REQ-131 | A v2 file declaring a measurement for a name that resolves to an **existing** Exercise does not change that Exercise's type; the file's declaration applies only where the import mints the Exercise. | §26, DEC-O | AC-150 |
| REQ-132 | The create-Exercise form collects a measurement, defaulting to `weight_reps`. | DEC-B, `ExerciseCatalogScreen.tsx:301` | AC-151 |
| REQ-133 | A user Exercise's measurement may be corrected while it holds no logged sets, and the verb is refused once any set references it. Catalog Exercises are build-time and offer no such verb. | DEC-O | AC-152, AC-153, AC-154 |
| REQ-134 | The add-Planned-Exercise form offers the target fields the chosen Exercise's measurement asks for. Where a type has no rep range, none is collected and none is stored. | DEC-A·2, `AddToRoutine.tsx` | AC-155 |
| REQ-135 | `PlannedExercise.minReps`/`maxReps` widen to nullable for the types whose target axis is not reps. Stored rows keep their values; nothing rewrites them and neither field is renamed. | REQ-134, DEC-Q | AC-156 |
| REQ-138 | `PlannedExercise` gains `minTarget`/`maxTarget`, nullable, holding the target range for a type whose target axis is not reps — seconds for the duration types, metres for the distance types, both canonical, as `restSeconds` already is. `PlannedExerciseSession` gains `plannedMinTarget`/`plannedMaxTarget` and snapshots them. | DEC-Q | AC-162, AC-163 |
| REQ-139 | Exactly one target pair is populated per PlannedExercise, decided by the Exercise's measurement: `minReps`/`maxReps` for a rep-axis type, `minTarget`/`maxTarget` otherwise. Both pairs populated, or neither, is refused by the routine-file validator and by the backup validator. Every reader takes the live pair from the one accessor of REQ-102 and never by testing which field is non-null. | DEC-Q, REQ-102 | AC-164, AC-165, AC-166 |
| REQ-136 | §11.7, §14.8, §19, §11.11 and §39 are amended in the same commit that lands the behavior. §39 gains a group C row, numbered **16** so that 9–15 are not renumbered. | §39's own instruction, audit contradiction 6 | AC-157, AC-158 |
| REQ-137 | `CONTEXT.md` gains **Measurement** as a term and **Distance Unit** beside **Unit**, and `Unit`'s definition is left saying what it says today — weight only. | AGENTS.MD "Vocabulary is binding", `CONTEXT.md:96` | AC-159 |

## 4. Frozen Decisions

| Decision ID | Approved Decision | Authority / Source | Affected Requirements |
|---|---|---|---|
| DEC-A | All eight measurement types are in scope. **Extended by DEC-R.** | shaping, approved | REQ-101 |
| DEC-B | The discriminator lives on `Exercise`. **Its stated reason is void** — `unit` does not live on `Exercise`; it is declared on `PlannedExercise`, snapshotted as `plannedUnit` and copied onto `CompletedSet`. The conclusion stands on its own: a plank does not become a rep exercise on Tuesday. | shaping, corrected by audit against `domain/types.ts:54` | REQ-104, REQ-132 |
| DEC-C | Bodyweight is recorded over time as a dated value. | shaping, approved | REQ-108 |
| DEC-D | Volume is never summed across types. Four accumulators, never one figure. | shaping, approved | REQ-116, REQ-117 |
| DEC-E | `effort` is the cross-modal figure and already shipped. Validated: `effortOf` reads only `rir` and wall-clock minutes. **Not touched by this change.** | shaping; audit ASM-1 | — |
| DEC-F | Double progression generalizes by axis and sign, not by new rule types. §39 item 13 stays closed. | shaping, approved | REQ-119, REQ-120 |
| DEC-G | This change starts only once routine-authoring has landed. **Satisfied** — merged at `e974365`. | shaping; audit baseline | — |
| DEC-H | `measurement` is declared on `Exercise` and snapshotted onto `ExerciseSessionBase` — on the base, not among `planned*`. Not copied onto `CompletedSet`. Derivations read it from `SessionHistory`; `SetPill` and `format.ts` take it as a parameter. | approved after audit DEC-Q1 | REQ-105, REQ-113 |
| DEC-I | Bodyweight is a field on `Session`, not a tenth table. | approved after audit DEC-Q2 | REQ-108, REQ-126 |
| DEC-J | Distance carries its own unit axis, `DistanceUnit = 'm' \| 'km' \| 'mi'`, with a derived `distanceM`. | approved after audit DEC-Q3 | REQ-107 |
| DEC-K | The routine file format moves to v2; v1 stays accepted and means `weight_reps`. | approved after audit DEC-Q4 | REQ-130 |
| DEC-L | All 96 catalog rows are typed in this change, and no stored set is rewritten. One decision, not two. | approved after audit DEC-Q5 + DEC-Q7 | REQ-122, REQ-124 |
| DEC-M | User-created Exercises backfill to `weight_reps` — the only type provable from the data. | approved after audit DEC-Q5 | REQ-125 |
| DEC-N | `CSV_HEADER` grows by appending, never by inserting. | approved after audit DEC-Q6 | REQ-129 |
| DEC-O | A measurement may be corrected while the Exercise holds no logged sets; refused after. | approved after audit DEC-Q8 | REQ-133 |
| DEC-P | A record is the best value on the type's own axis in that axis's direction. Riegel rejected. | approved after audit DEC-Q9 | REQ-114, REQ-115 |
| DEC-R | A ninth type, `distance`, is added: a distance with nothing beside it. The eight carry `duration` alone but no `distance` alone, and that asymmetry blocks a real movement — a broad jump, a vertical jump, a throw. Evidence: `docs/bloque-a-acumulacion.yaml` programmes Broad Jump as `reps: 3–3` with the rule *"si la distancia cae respecto a la primera serie, para"* in `notes`, so the programme states a stopping rule the app cannot enforce. Cheap because REQ-107 already builds the distance axis: one union member, one row in the shape table, no new field and no extra migration. | approved, resolving this spec's own ninth-type stop condition | REQ-101, REQ-103 |
| DEC-S | Catalog additions are scoped to movements whose *measurement* the catalog cannot declare — isometric holds and jumps. No cardio row is added: the change owner's programme contains no running, cycling, rowing or swimming, so those rows would be speculative, and a movement with no muscle group would dirty the `category` vocabulary §39 item 8 depends on. | approved, resolving DER-3 | REQ-122, REQ-140 |
| DEC-Q | A non-rep target is a **new nullable pair beside** `minReps`/`maxReps`, not a rename of them. Renaming to an axis-neutral pair is the cleaner model and is rejected on repository evidence: `backup/schema.ts` requires `plannedExercise.minReps`, so restoring a version-1 document under a renamed field would need a field mapping in `parseBackup` — the translation layer `backup/document.ts` states does not exist and whose appearance would mean the database and the document have drifted. The additive pair needs no row rewrite, no rename, and no mapping. | approved, resolving DER-4 | REQ-135, REQ-138, REQ-139 |

### 4b. Derived design, not stakeholder-approved

These follow from the frozen decisions above but were **not** put to the change
owner. They are stated so an implementer does not have to re-derive them, and so
that challenging one is a planning conversation rather than a silent
substitution. Each names what it follows from.

| ID | Derived Design | Follows From | May Be Challenged Because |
|---|---|---|---|
| DER-1 | `reps` widens to nullable while `weight`, `unit`, `weightKg` and `rir` stay required and non-null. | DEC-H forbids a discriminator on the set; DEC-L forbids rewriting stored rows, and every stored row has all five non-null. | The alternative — nullable everywhere — is more honest about five of nine types but touches all 73 `weightKg` sites. This is the smaller diff, not the purer model. |
| DER-2 | For a type with no load axis, a met double-progression target advances the **target axis itself** (more reps, more seconds). | DEC-F states axis-and-sign generalization but does not name the degenerate one-axis case. | A reading where `double_progression` is simply unavailable to one-axis types is also consistent with DEC-F. |
| DER-3 | `§39` gains a row numbered **16**. | §39's own note explains that 15 was numbered last "para no renumerar 7–14". | Only the numbering is derived; that a row is needed is REQ-136. |

Two entries that stood here in earlier revisions have since been decided and
promoted: the non-rep target pair is now DEC-Q, and the catalog scope is now
DEC-S. DER-1 is the remaining one worth a second look.

## 5. Expected Change Areas

| Area / File | Expected Change | Audit Evidence | Confidence |
|---|---|---|---|
| `src/domain/measurement.ts` *(new)* | The `Measurement` union, the per-type field shape, the axis and its direction. The seam REQ-102 requires. | audit §"Actual Problem" — three layers restate the assumption independently | High |
| `src/domain/types.ts` | `Exercise.measurement`; `ExerciseSessionBase.measurement`; `Session.bodyweightKg`; `CompletedSet` new fields and nullable `reps`; `PlannedExercise` nullable rep range | read in full | High |
| `src/domain/units.ts` | `DistanceUnit`, `toMetres`, mirroring `toKg` | read in full | High |
| `src/domain/history.ts` | `better`, `estimateOneRepMaxKg`, `ExercisePoint`, `exerciseSeries`, the running-max record rule | read in full | High |
| `src/domain/progression/index.ts` | `doubleProgression` axis + sign; `targetOf` | read in full | High |
| `src/domain/session/index.ts` | `logSet`, `editSet` take the new values; `startPlannedExercise`/`startUnplannedExercise` snapshot `measurement` | read in full | High |
| `src/domain/session-summary.ts` | `volumeKg` skips null-rep sets; per-family accumulators. **`effortOf` untouched.** | `:113`, `:158` | High |
| `src/domain/catalog/data.ts` | a measurement per row; new rows for cardio/carry movements | 96 rows counted; `Equipment` has no cardio | High |
| `src/domain/backup/schema.ts`, `document.ts` | new fields; `BACKUP_VERSION` 2 | read in full | High |
| `src/domain/backup/csv.ts` | appended columns | read in full | High |
| `src/domain/routine-file/schema.ts`, `to-domain.ts`, `validate.ts`, `edit.ts`, `example.ts`, `fixtures.ts`, `planned-exercise-draft.ts` | v2 acceptance; measurement per exercise; optional `reps` | `schema.ts` read in full | High |
| `src/db/schema.ts` | `SCHEMA_VERSION = 3`, one upgrade function | `backfillPlannedUnit` precedent | High |
| `src/db/schema.test.ts` | still exactly nine tables — the assertion must keep passing unchanged | `:147`, `:160` | High |
| `src/db/migrations.test.ts` | v2→v3 tests, reusing the raw-IndexedDB harness | read header | High |
| `src/db/repositories/backup.ts` | CSV row assembly for the appended columns | read | High |
| `src/db/repositories/exercises.ts` | `createUserExercise` takes a measurement; the REQ-133 correction verb | read in full | High |
| `src/db/repositories/sessions.ts` | carry-forward of `bodyweightKg` | not read in full | Medium |
| `src/features/session/SetLogger.tsx` | `SetFields` becomes measurement-driven; the completion guard | read in full | High |
| `src/features/session/SetEditor.tsx`, `ExerciseView.tsx`, `SessionScreen.tsx` | the new values through the log/edit path; bodyweight entry | `ExerciseView` read to :140 | Medium |
| `src/features/ui/SetPill.tsx`, `format.ts` | per-type notation | read in full | High |
| `src/features/progress/ExerciseChart.tsx` | `Metric`, `METRICS`, `READING` per type | read in full | High |
| `src/features/history/*`, `src/features/exercises/ExerciseCatalogScreen.tsx`, `src/features/routines/AddToRoutine.tsx`, `src/features/import/*` | measurement in forms and readouts | grepped | Medium |
| `docs/PRD.md`, `CONTEXT.md`, `AGENTS.MD` | §11.7, §14.8, §19, §11.11, §39 item 16; vocabulary | read | High |

Measured blast radius at baseline: **31 non-test source files and 23 test files**
reference `weightKg`, `reps`, `minReps` or `maxReps`; 73 `weightKg` references
tree-wide.

## 6. Contracts

### Changed

- `Exercise` — gains `measurement`.
- `ExerciseSessionBase` — gains `measurement`; both union members inherit it.
- `Session` — gains `bodyweightKg: number | null`.
- `CompletedSet` — gains four nullable fields; `reps` widens to nullable.
- `PlannedExercise` — `minReps`/`maxReps` widen to nullable; gains nullable
  `minTarget`/`maxTarget`.
- `PlannedExerciseSession` — gains `plannedMinTarget`/`plannedMaxTarget`.
- `SCHEMA_VERSION` 2 → 3. No new table, no new index.
- `BACKUP_VERSION` 1 → 2.
- `CSV_HEADER` — four appended columns.
- Routine file — `version` accepts 1 or 2.
- `ExercisePoint` — `topSetKg`/`volumeKg` become type-aware; `estimatedOneRepMaxKg` nullable.

### Preserved

- **Exactly nine tables** (REQ-070, §17). `schema.test.ts:147` must pass unchanged.
- **No translation layer** between the database and the backup document.
- Catalog slug permanence (REQ-023). Additions only.
- ADR 0001 — Placement and Session never reference each other.
- ADR 0002 — no derivation reads a planned target back through `plannedExerciseId`.
- §11.9 "derived, never stored" — no stored suggestion, working weight, or per-axis best.
- `effortOf` and `estimateDuration` — byte-identical (ASM-1, ASM-2).
- `Unit` means weight, kg or lb, fixed per Exercise. Not widened.
- Offline-only: no network request, no sensor, catalog in the build.
- Every existing CSV column keeps its index.
- `minReps`/`maxReps` keep their names and their meaning. No stored planning row
  is renamed or rewritten, so `parseBackup` needs no field mapping and the
  "no translation layer" property of `backup/document.ts` holds.

## 7. Security, Tenant, Permission, and Compatibility

No security, tenant or permission surface exists: one local user, one database,
no network, no account (NFR-08).

Compatibility is the whole risk of this change, and it runs in three directions:

1. **Old data into this build.** REQ-124–REQ-126. A database written by any
   earlier build must open, backfill, and be fully usable, with no stored
   `CompletedSet` read or written.
2. **Old file into this build.** REQ-127, REQ-130. A version-1 backup and a
   version-1 routine file both still load.
3. **New file into an old build.** REQ-127. `BACKUP_VERSION = 2` is what makes
   the existing version gate refuse it loudly, rather than `z.object` silently
   stripping `measurement` and restoring a lifter's history as weight × reps.
   That gate is the *only* protection, which is why the version must move.

## 8. Migration, Rollout, and Recovery

Single forward migration, `SCHEMA_VERSION` 2 → 3, in `src/db/schema.ts`,
following `backfillPlannedUnit` exactly: both versions redeclare the same
stores, the new version adds `.upgrade()`.

What it writes:

- `exercises` rows — `measurement = 'weight_reps'` where absent (REQ-125).
- `exerciseSessions` rows — `measurement` resolved from the Exercise, catalog
  first then the `exercises` table, `weight_reps` where neither resolves.

What it must **not** touch:

- Any `completedSets` row. The lossless property of DEC-L depends on this: a
  stored `push-up` set holding `weight: 0` reads correctly under
  `bodyweight_reps` because that type does not read the field, and under
  `weighted_bodyweight` because 0 means "no added weight" — which is true. A
  migration that rewrote sets would be the rewrite this change excludes.
- Any row that already carries a `measurement`, for the reason
  `backfillPlannedUnit` leaves an existing `plannedUnit` alone: the stored value
  outranks a re-derivation.
- `sessions.bodyweightKg` — left absent, read as `null` (REQ-126).

**Recovery.** The migration is forward-only and irreversible, as every Dexie
version change here is. The lifter's own backup export is the only rollback, and
a version-1 document restores into this build unchanged (REQ-127). Implementation
must verify the export→restore round trip *before* the migration is considered
done, because `migrations.test.ts` exists precisely because a previous field
addition produced a database whose own validator refused its own export.

**Rollout.** One release. No flag, no staged enablement — there is no server to
stage against, and a half-typed catalog would be worse than either end state.

## 9. Test Requirements

| Test ID | Required Check | Covers | Required Evidence |
|---|---|---|---|
| TST-101 | Every one of the nine types has a field shape, both axes, and a direction; the union is exhaustive with no fallback branch. | REQ-101, REQ-102 | unit test over the module |
| TST-102 | Exactly two types report *lower is better*, and they are `assisted_bodyweight` and `distance_duration`. | REQ-103 | unit test asserting the set, not a spot check |
| TST-103 | `better()` prefers the **less** assisted set for `assisted_bodyweight`, and the **lower** pace for `distance_duration`. | REQ-113 | unit test per inverted type |
| TST-104 | A record is not awarded to a *worse* value on an inverted axis — the running-maximum defect stated in audit risk 7. | REQ-115 | unit test with a descending assistance series |
| TST-105 | For `weight_reps` and `weighted_bodyweight`, records and series match today's output exactly. | REQ-115 | existing `history.test.ts` cases pass unchanged |
| TST-106 | `estimateOneRepMaxKg` is `null` for the seven types without one, and no figure substitutes a value. | REQ-114 | unit test |
| TST-107 | No accumulator sums across families; a Session mixing kilogram-reps and seconds reports both separately and no combined total. | REQ-116, REQ-117 | unit test over `session-summary` |
| TST-108 | `volumeKg` over a Session whose sets carry `reps: null` is finite and excludes them. | REQ-117 | unit test — guards `NaN` |
| TST-109 | Double progression advances the load axis where one exists, the target axis where none does, across all nine types. | REQ-119 | table-driven unit test |
| TST-110 | For `assisted_bodyweight`, a met target **reduces** assistance and floors at zero. | REQ-120 | unit test |
| TST-111 | `suggestLoad` and `projectNextLoad` agree on every type. | REQ-121 | unit test over shared input |
| TST-112 | `toMetres` round-trips m/km/mi at the module's stated precision. | REQ-107 | unit test mirroring `units.test.ts` |
| TST-113 | **A real version-2 database, seeded through raw IndexedDB, upgrades to 3**, backfills both tables, and leaves every `completedSets` row byte-identical. | REQ-124, REQ-125 | extends `migrations.test.ts`; must assert set rows unchanged |
| TST-114 | After that upgrade, `exportBackup` produces a document `parseBackup` accepts. | REQ-124, REQ-127 | the existing migrations.test.ts assertion, re-run at v3 |
| TST-115 | A version-1 backup document restores into this build, with the REQ-125/REQ-126 defaults applied. | REQ-127 | fixture-based test |
| TST-116 | A version-2 document is refused by the version gate when `BACKUP_VERSION` is lower. | REQ-127 | existing gate test, extended |
| TST-117 | A `measurement` outside the union is refused by the backup validator, naming the field. | REQ-128 | extends `schema.test.ts` |
| TST-118 | The fuzz suite covers the new fields. | REQ-128 | `schema.fuzz.test.ts` |
| TST-119 | `CSV_HEADER`'s first seven columns are unchanged and in order; a duration row leaves weight and reps empty. | REQ-129 | unit test asserting column indices |
| TST-120 | A version-1 routine file parses and yields `weight_reps` throughout; a version-2 file omitting `reps` for a duration exercise parses. | REQ-130 | extends `parse.test.ts`, `to-domain.test.ts` |
| TST-121 | `docs/bloque-a-acumulacion.yaml` and `docs/bloque-b-intensificacion.yaml` still parse, validate and map, and `weighted-dip`/`weighted-pull-up` still resolve. | REQ-123, REQ-130 | fixture test over the repository's own files |
| TST-122 | All 96 original slugs are still present; every catalog row declares a measurement. | REQ-122, REQ-123 | extends `catalog/index.test.ts` |
| TST-123 | The correction verb is refused once any `CompletedSet` references the Exercise. | REQ-133 | repository test |
| TST-124 | The database still reports exactly nine tables. | §6 Preserved | `schema.test.ts:147`, unchanged |
| TST-127 | The module names a target axis and a progress axis for all nine types, and they differ for `weight_reps` (target reps, progress load). | REQ-102 | unit test |
| TST-128 | A PlannedExercise with both target pairs populated, or with neither, is refused by the routine-file validator and by the backup validator. | REQ-139 | unit test on both validators |
| TST-129 | A plank programmes as `3 × 45s` and a run as `1 × 5 km`, round-tripping through file → domain → snapshot → backup → restore. | REQ-138 | integration test |
| TST-130 | The three isometric holds and the jump of `docs/bloque-a-acumulacion.yaml` resolve to catalog rows of the right type, and their duration and distance targets are programmable without `notes`. | REQ-122, REQ-140 | fixture test over the repository's own programme |
| TST-126 | A stored weighted-bodyweight set estimates the same 1RM before and after the change, with a bodyweight recorded. | REQ-114 | regression test over a fixture set |
| TST-125 | Logging is refused when the type's primary axis is zero or absent, per type. | REQ-110 | unit test over the guard |

## 10. Acceptance Criteria

| Acceptance ID | Observable Pass/Fail Condition | Covers |
|---|---|---|
| AC-101 | The union has nine members and no other value type-checks. | REQ-101 |
| AC-102 | Field shape, axis and direction are each stated once in the tree; grep finds no second statement of any of the three. | REQ-102 |
| AC-103 | `assisted_bodyweight` and `distance_duration` report lower-is-better; the other seven report higher. | REQ-102, REQ-103 |
| AC-104 | An Exercise cannot be constructed without a measurement. | REQ-104 |
| AC-105 | Starting an exercise copies the Exercise's measurement onto the ExerciseSession. | REQ-105 |
| AC-106 | An **unplanned** ExerciseSession carries a measurement. | REQ-105 |
| AC-107 | A duration set stores `durationSeconds` and `reps: null`. | REQ-106 |
| AC-108 | Every stored set written before this change still reads with all five original fields non-null. | REQ-106 |
| AC-109 | A 5 km run stores `distance: 5`, `distanceUnit: 'km'`, `distanceM: 5000`. | REQ-107 |
| AC-110 | `Unit` still admits only `kg` and `lb`. | REQ-107 |
| AC-111 | A new Session opens on the most recent recorded bodyweight. | REQ-108 |
| AC-112 | With no bodyweight ever recorded, a Session reads `null` and nothing displays a zero. | REQ-108 |
| AC-113 | A plank offers a seconds field and no rep field. | REQ-109 |
| AC-114 | An assisted pull-up's weight field is labelled as assistance, not as load. | REQ-109 |
| AC-115 | A plank with 0 seconds cannot be logged; a plank with 30 seconds and 0 reps can. | REQ-110 |
| AC-116 | Correcting a logged duration set offers the seconds field, not weight and reps. | REQ-111 |
| AC-117 | A duration set renders as a duration; no screen shows it a rep count. | REQ-112 |
| AC-118 | Between two assisted pull-ups, the one with less assistance is the better set. | REQ-113 |
| AC-119 | For `weight_reps`, `better()` returns exactly what it returns today. | REQ-113 |
| AC-120 | A plank's history shows no estimated 1RM. | REQ-114 |
| AC-160 | A stored `weighted-dip` set's estimated 1RM is the same number before and after this change, whatever bodyweight is recorded. | REQ-114 |
| AC-121 | The e1RM chart metric is not offered for a type without one. | REQ-114, REQ-118 |
| AC-122 | Reducing assistance from 20 kg to 15 kg is a record. | REQ-115 |
| AC-123 | Repeating an identical best is not a record, and the first session never is. | REQ-115 |
| AC-124 | For `weight_reps`, the record series is identical to today's. | REQ-115 |
| AC-125 | A Session mixing a squat and a run reports kilogram-reps and metres separately. | REQ-116 |
| AC-126 | No screen or export shows one total spanning two families. | REQ-116, REQ-117 |
| AC-127 | The metric switch offers only metrics the selected type defines. | REQ-118 |
| AC-128 | The Y axis states the selected metric's own unit. | REQ-118 |
| AC-129 | A met target on a `weight_reps` exercise advances the load, exactly as today. | REQ-119 |
| AC-130 | A met target on a `bodyweight_reps` exercise advances the rep target. | REQ-119 |
| AC-131 | A met target on an `assisted_bodyweight` exercise reduces assistance, never below zero. | REQ-119, REQ-120 |
| AC-132 | `suggestLoad` and `projectNextLoad` return the same advance for the same input on every type. | REQ-121 |
| AC-133 | All 96 rows declare a measurement. | REQ-122 |
| AC-134 | All 96 original slugs resolve; `weighted-dip` and `weighted-pull-up` are `weighted_bodyweight`. | REQ-122, REQ-123 |
| AC-135 | Added rows use new slugs only. | REQ-122 |
| AC-136 | A version-2 database opens at version 3 with no data loss. | REQ-124 |
| AC-137 | After upgrade, every Exercise and every ExerciseSession carries a measurement. | REQ-124, REQ-125 |
| AC-138 | After upgrade, every `completedSets` row is byte-identical to before. | REQ-124 |
| AC-139 | An ExerciseSession referencing a catalog slug backfills to that slug's catalog type. | REQ-125 |
| AC-140 | Sessions written before this change read `bodyweightKg: null`. | REQ-126 |
| AC-141 | A version-1 backup restores into this build. | REQ-127 |
| AC-142 | A version-2 backup exported by this build re-imports into it. | REQ-127, REQ-128 |
| AC-143 | A build reading `BACKUP_VERSION = 1` refuses a version-2 document with the existing message. | REQ-127 |
| AC-144 | A document carrying an unknown `measurement` is refused, naming the field. | REQ-128 |
| AC-145 | The CSV's first seven columns are unchanged, in order. | REQ-129 |
| AC-146 | A duration row leaves `weight` and `reps` empty and fills `duration_s`. | REQ-129 |
| AC-147 | A version-1 routine file imports, every exercise `weight_reps`. | REQ-130 |
| AC-148 | A version-2 file declaring `duration` and omitting `reps` imports. | REQ-130 |
| AC-149 | `docs/bloque-a-acumulacion.yaml` and `docs/bloque-b-intensificacion.yaml` import unchanged. | REQ-130 |
| AC-150 | A v2 file naming an existing Exercise does not change that Exercise's type. | REQ-131 |
| AC-151 | The create-Exercise form collects a measurement, defaulting to `weight_reps`. | REQ-132 |
| AC-152 | A user Exercise with no sets can have its measurement corrected. | REQ-133 |
| AC-153 | The same verb is refused once one set references it, with a message saying why. | REQ-133 |
| AC-154 | No such verb is offered for a catalog Exercise. | REQ-133 |
| AC-155 | Adding a duration exercise to a Workout collects no rep range. | REQ-134 |
| AC-156 | Existing PlannedExercise rows keep their rep ranges, under their existing field names. | REQ-135 |
| AC-167 | A `distance` set stores a distance and no duration, no reps and no weight. | REQ-101 |
| AC-168 | A longer broad jump is the better set, and one longer than every earlier session is a record. | REQ-103 |
| AC-169 | No cardio row is added, and no `weight_reps` movement is added. | REQ-122 |
| AC-170 | `CATALOG_CATEGORIES` and `CATALOG_EQUIPMENT` hold exactly the values they hold today. | REQ-140 |
| AC-161 | For `weight_reps` the target axis is reps and the progress axis is load — today's §29 behavior, restated rather than changed. | REQ-102 |
| AC-162 | A plank can be programmed as `3 × 45s`, and the session screen states that target. | REQ-138 |
| AC-163 | A run can be programmed as `1 × 5 km`. | REQ-138 |
| AC-164 | A rep-axis exercise stores its range in `minReps`/`maxReps` and leaves `minTarget`/`maxTarget` null. | REQ-139 |
| AC-165 | A duration exercise stores its range in `minTarget`/`maxTarget` and leaves `minReps`/`maxReps` null. | REQ-139 |
| AC-166 | A row with both pairs populated is refused, naming the field. | REQ-139 |
| AC-157 | §11.7 and §14.8 no longer state the set shape as universal. | REQ-136 |
| AC-158 | §39 group C carries a row numbered 16, and 9–15 are unchanged. | REQ-136 |
| AC-159 | `CONTEXT.md` defines Measurement and Distance Unit; Unit's definition is unchanged. | REQ-137 |

## 11. Traceability

| Requirement | Acceptance | Tests |
|---|---|---|
| REQ-101 | AC-101, AC-167 | TST-101 |
| REQ-102 | AC-102, AC-103, AC-161 | TST-101, TST-127 |
| REQ-103 | AC-103, AC-168 | TST-102 |
| REQ-104 | AC-104 | TST-122 |
| REQ-105 | AC-105, AC-106 | TST-113 |
| REQ-106 | AC-107, AC-108 | TST-113 |
| REQ-107 | AC-109, AC-110 | TST-112 |
| REQ-108 | AC-111, AC-112 | TST-113 |
| REQ-109 | AC-113, AC-114 | TST-125 |
| REQ-110 | AC-115 | TST-125 |
| REQ-111 | AC-116 | TST-125 |
| REQ-112 | AC-117 | TST-101 |
| REQ-113 | AC-118, AC-119 | TST-103, TST-105 |
| REQ-114 | AC-120, AC-121, AC-160 | TST-106, TST-126 |
| REQ-115 | AC-122, AC-123, AC-124 | TST-104, TST-105 |
| REQ-116 | AC-125, AC-126 | TST-107 |
| REQ-117 | AC-126 | TST-107, TST-108 |
| REQ-118 | AC-127, AC-128 | TST-106 |
| REQ-119 | AC-129, AC-130, AC-131 | TST-109 |
| REQ-120 | AC-131 | TST-110 |
| REQ-121 | AC-132 | TST-111 |
| REQ-122 | AC-133, AC-134, AC-135, AC-169 | TST-122, TST-130 |
| REQ-123 | AC-134 | TST-121, TST-122 |
| REQ-140 | AC-170 | TST-122, TST-130 |
| REQ-124 | AC-136, AC-137, AC-138 | TST-113, TST-114, TST-124 |
| REQ-125 | AC-137, AC-139 | TST-113 |
| REQ-126 | AC-140 | TST-113 |
| REQ-127 | AC-141, AC-142, AC-143 | TST-114, TST-115, TST-116 |
| REQ-128 | AC-142, AC-144 | TST-117, TST-118 |
| REQ-129 | AC-145, AC-146 | TST-119 |
| REQ-130 | AC-147, AC-148, AC-149 | TST-120, TST-121 |
| REQ-131 | AC-150 | TST-120 |
| REQ-132 | AC-151 | TST-123 |
| REQ-133 | AC-152, AC-153, AC-154 | TST-123 |
| REQ-134 | AC-155 | TST-120 |
| REQ-135 | AC-156 | TST-113 |
| REQ-138 | AC-162, AC-163 | TST-129 |
| REQ-139 | AC-164, AC-165, AC-166 | TST-128 |
| REQ-136 | AC-157, AC-158 | review |
| REQ-137 | AC-159 | review |

## 12. Quality Obligations

**Reliability gates — critical.** All must pass before the change is called done:

- `pnpm test` — every test green. Baseline is 557; the count only grows.
- `pnpm typecheck` — both tsconfigs clean.
- `pnpm lint` — clean.
- `pnpm build` — clean.

**Required contract checks:**

- TST-113 and TST-114 together — the migration must not produce a database
  whose own export its own validator refuses. This exact failure has happened in
  this repository before; `migrations.test.ts` exists because of it.
- TST-124 — nine tables, unchanged assertion.
- TST-121 — the repository's own two programme files still import.

**Risk-specific:**

- Every inverted-axis path (TST-102, TST-103, TST-104, TST-110) is required, not
  optional. The audit recorded zero existing coverage for a downward-better
  axis, and the defect it produces looks like training rather than like an
  error.
- TST-108 guards `NaN` reaching a chart through a null rep count.

**Mutation:** `stryker.config.json` is configured. Run it over
`src/domain/measurement.ts`, `src/domain/history.ts` and
`src/domain/progression/index.ts` — the three modules where a surviving mutant
means a wrong-but-plausible number rather than a crash.

## 13. Explicit Assumptions

| Assumption | Provenance | Stop If False |
|---|---|---|
| ASM-1 — `effortOf` is measurement-agnostic and needs no change. | Audit: reads only `set.rir` and wall-clock minutes (`session-summary.ts:158`). Validated. | DEC-E collapses; the cross-modal figure needs its own design and this spec is incomplete. |
| ASM-2 — `estimateDuration` is measurement-agnostic. | Audit: reads only `sets` and `restSeconds` (`scheduling/index.ts:270`). Validated. | Today's estimate needs a per-type work model; add a requirement. |
| ASM-3 — `z.object` strips unknown keys, so the version gate is the only protection against silent loss. | Audit: `backup/schema.ts` reaches for `looseObject` precisely because `object` strips before checks run. Validated. | `BACKUP_VERSION` need not move; REQ-127 is over-scoped. |
| ASM-4 — the v1→v2 backfill pattern extends to v2→v3 unchanged. | Audit: `backfillPlannedUnit` plus the raw-IndexedDB harness in `migrations.test.ts`. Validated. | The migration needs its own design; re-plan §8. |
| ASM-5 — `AddToRoutine` binds an Exercise before rendering target fields, so conditional fields need no form restructure. | Grepped (`AddToRoutine.tsx:439–493`), **not traced through every branch**. Medium confidence. | REQ-134 grows a form restructure; re-estimate that workstream. |
| ASM-6 — no new dependency is required. | `package.json` read; Zod discriminated unions and Dexie upgrades cover it. | Scope grows and `pnpm-lock.yaml` enters the diff, which §5 says it should not. |

## 14. Implementation Stop Conditions

Implementation must stop and escalate rather than invent behavior if:

- a stored `CompletedSet` appears to need rewriting to satisfy any requirement —
  DEC-L's lossless property is the foundation of §8 and cannot be traded;
- the nine-table assertion (`schema.test.ts:147`) cannot be kept passing;
- a catalog slug appears to need renaming or removal (REQ-023);
- `effortOf` or `estimateDuration` appear to need changing — ASM-1 or ASM-2 is
  false and DEC-E is in question;
- a requirement needs a measurement discriminator on `CompletedSet` — that
  contradicts DEC-H and reopens audit DEC-Q1;
- a **tenth** measurement type is needed, or one of the nine cannot be expressed;
- an axis is needed that is neither higher-better nor lower-better;
- the migration cannot be made forward-only, or export→restore cannot be shown
  green after it;
- `Unit` appears to need widening to carry distance — that contradicts DEC-J and
  a binding `CONTEXT.md` definition;
- ASM-5 proves false and REQ-134 requires restructuring `AddToRoutine`'s form;
- a new dependency appears necessary (ASM-6);
- excluded scope is required to finish — in particular renaming or deleting an
  Exercise, or correcting the measurement of one that holds sets (DEC-O);
- unrelated user changes overlap the required write set.

## 15. Planning

`plan.md` is **required**. Nine candidate workstreams were identified in the
audit and their write sets are only disjoint behind a Gate 0 that freezes
`src/domain/types.ts` and the new `src/domain/measurement.ts` before anything
else is written. Four workstreams read the same union; without the gate they
will invent four incompatible shapes for it.

The plan must name:

- **Gate 0** — the frozen contract: the `Measurement` union, the field shape,
  the axis and direction accessors, and every changed type in
  `src/domain/types.ts`. Single writer. Nothing else starts until it lands.
- **A migration owner** — sole writer of `SCHEMA_VERSION`, `db/schema.ts` and
  `db/migrations.test.ts`.
- **A backup owner** — sole writer of `BACKUP_VERSION`.
- **An integration owner** for `src/domain/types.ts`, `CONTEXT.md` and
  `docs/PRD.md`, which every workstream otherwise wants to touch.
