# Weighted twins for the bodyweight movements that get loaded

Status: Ready for implementation
Size: quick
Reliability: lean

Goal: a lifter whose bodyweight movement has progressed to carrying a disc finds
the loaded version already in the catalog, with a permanent slug and the right
category, instead of having to mint it themselves.

## Evidence

- `src/domain/catalog/data.ts` — 100 rows, `[slug, name, category, equipment, measurement]`.
  Twelve are `bodyweight_reps`; exactly two loaded twins exist today,
  `weighted-dip` and `weighted-pull-up`, both `weighted_bodyweight` with
  `equipment: 'bodyweight'`. Both are among the 96 frozen original slugs, so they
  predate DEC-S and are not a precedent DEC-S left standing.
- `src/domain/catalog/index.test.ts:359` (AC-169) — asserts every row **not** in
  `ORIGINAL_SLUGS` measures `duration` or `bodyweight_reps`. A
  `weighted_bodyweight` addition fails this assertion. This is the guard that
  must be re-scoped, and the only test that blocks the change.
- `docs/changes/2026-08-24-exercise-measurement/spec.md:109` (REQ-122, DEC-S) —
  "A missing `weight_reps` or `bodyweight_reps` movement is a catalog gap, not a
  measurement gap, and `createUserExercise` already covers it; no such row is
  added here." DEC-S is revoked by this change; see Decisions.
- `src/features/exercises/ExerciseCatalogScreen.tsx:298` (REQ-132) — the create
  form already collects a measurement, so this change adds convenience, not
  capability. That is the whole of its value and the spec claims nothing more.
- `src/db/repositories/exercises.ts:195` (`correctExerciseMeasurement`, REQ-133,
  DEC-O) — untouched. The transition sin-peso → con-peso is two movements, not a
  measurement that mutates.
- `src/domain/catalog/index.test.ts:377` (AC-170) — `CATALOG_CATEGORIES` and
  `CATALOG_EQUIPMENT` are asserted exactly. Every added row must reuse an existing
  category and `equipment: 'bodyweight'`, or this test fails.

## Decisions

- **Revoked: DEC-S**, the clause forbidding a new rep-based catalog row. Authority:
  the change owner, this session, with the collision stated. REQ-023 permits
  additions; DEC-S was a scope boundary for a completed change, not an invariant.
  The revocation is recorded here and in the amended AC-169 comment — nothing
  rewrites `docs/changes/2026-08-24-exercise-measurement/`, which is a historical
  record.
- **Approved:** the loaded version of a bodyweight movement is a **separate row
  with its own permanent slug**, never a mutation of the unloaded one. History
  under the unloaded movement stays readable on its own axis.

## Scope

Include:
- Seven `weighted_bodyweight` rows, one per `bodyweight_reps` movement where added
  load is standard practice: `weighted-chin-up`, `weighted-push-up`,
  `weighted-inverted-row`, `weighted-back-extension`, `weighted-glute-ham-raise`,
  `weighted-hanging-leg-raise`, `weighted-russian-twist`.
- Re-scoping AC-169's assertion so it guards this change's boundary — still no
  cardio row — rather than the previous change's.

Exclude:
- `nordic-curl` (loading it is niche), `ab-wheel-rollout` (resistance is banded,
  not loaded), `broad-jump` (a jump carries no disc). No twin for these.
- `dip` and `pull-up` — twins already ship.
- Any `assisted_bodyweight`, `duration_weight`, `distance_duration` or `distance`
  row. All four types have zero catalog rows; that gap is real and is not this
  change's business.
- Renaming or removing any slug (REQ-023).
- Any change to `Measurement`, the shape table, the repositories, or the UI.
- Any change to the correction verb (DEC-O, REQ-133) or to PRD §39 — adding rows
  moves no item.

## Acceptance

- Each of the seven slugs resolves through `getCatalogExercise` and measures
  `weighted_bodyweight`.
- The 96 original slugs all still resolve, and no added slug collides with one
  (AC-134, AC-135 stay green unchanged).
- `CATALOG_CATEGORIES` and `CATALOG_EQUIPMENT` are byte-identical to today
  (AC-170): every added row reuses an existing category and `equipment: 'bodyweight'`.
- No catalog row measures `distance_duration` — the cardio exclusion survives the
  re-scope.
- Every added row measures `duration`, `bodyweight_reps` or `weighted_bodyweight`,
  and nothing else.
- Each added slug is `weighted-<slug of its unloaded twin>`, and that twin exists.
- `docs/bloque-a-acumulacion.yaml` and `docs/bloque-b-intensificacion.yaml` still
  parse, validate and map unchanged — no programmed movement's resolution moves,
  because `findExerciseByName` matches on the full normalized name and no added
  name equals an existing one.

## Change surface

- Expected: `src/domain/catalog/data.ts`, `src/domain/catalog/index.test.ts`.
- Do not touch: `src/domain/measurement.ts`, `src/db/`, `src/features/`,
  `docs/PRD.md`, `docs/changes/2026-08-24-exercise-measurement/`, the two
  programme YAML files.

## Quality

- Tests: extend the existing `catalog measurement` describe — the parametrised
  `weighted_bodyweight` case grows to cover all nine twins; a new case asserts the
  `weighted-<twin>` naming rule and that each twin exists; AC-169's loop is
  re-scoped.
- Static/build: `npm run typecheck`, `npm run lint`.
- Full suite: `npm test` — 869 tests pass on `change/broad-jump-reps` today; the
  count grows, none regress.

## Implementation

1. Amend `index.test.ts` first: re-scope AC-169's loop, widen the parametrised
   `weighted_bodyweight` case to the nine slugs, add the naming-rule case. Run
   `npm test` and watch it fail on the seven missing rows.
2. Add the seven rows to `data.ts`, each beside its unloaded twin, with a comment
   naming the revoked DEC-S and why.
3. `npm run typecheck && npm run lint && npm test`.

## Stop if

- A chosen slug collides with one of the 96 frozen slugs.
- Adding a row moves `CATALOG_CATEGORIES` or `CATALOG_EQUIPMENT` (AC-170 fails) —
  that means a category was invented and the row is wrong, not the test.
- Either programme YAML changes resolution, which would mean a name collision the
  spec ruled out.
- Any change appears to need `src/domain/measurement.ts`, a repository, or the UI.
