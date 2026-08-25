# Exercise Measurement Implementation Plan

Status: Ready
Size: large
Reliability: critical
Base: `master@e974365f4b86b84866790a973c5cf74c41d38694`

## Preflight Baseline

- **Working tree:** clean of source changes. The only modified or untracked
  paths are this change's own documents — `shaping.md` (modified),
  `audit.md` and `spec.md` (untracked). **No source file has moved since the
  audit baseline**, so the spec's `path:symbol` citations still hold and this
  plan is not stale.
- **Spec:** `spec.md`, status `Ready for planning`, 40 `REQ-*`, 70 `AC-*`,
  30 `TST-*`, 19 frozen decisions `DEC-A`…`DEC-S`.
- **Audit:** `audit.md`, baseline `e974365`.
- **Required commands:** `pnpm test`, `pnpm typecheck`, `pnpm lint`,
  `pnpm build`. All four green at baseline; `pnpm test` is 557 tests / 35 files.
  Mutation testing via `stryker.config.json` is available and used once, in
  Wave 5.
- **Relevant overlaps:** none. No user work is in flight.

## Dependency Graph

### True Dependencies

| ID | Dependency | Why It Must Precede | Unlocks |
|---|---|---|---|
| D-001 | The `Measurement` union and its shape/axis/direction table | Four separate areas read it. Without it each invents its own shape and they cannot be reconciled afterwards. | everything |
| D-002 | The widened types in `src/domain/types.ts` | `reps` and `minReps`/`maxReps` becoming nullable is what makes the compiler enumerate every read site. Deferring it hides the worklist. | Waves 1–4 |
| D-003 | Behavior-preserving adaptation of every call site (Wave 1) | A measurement-aware derivation cannot be reviewed against a tree that does not compile. | Waves 2–5 |
| D-004 | Derivation correct (Wave 2) | The migration writes `measurement` values whose meaning the axis module defines. Proving the model before the irreversible write is the point. | Wave 3 |
| D-005 | `routine-file` v2 and the persisted shape (Wave 3) | The authoring forms write through them. | Wave 4 |
| D-006 | `duration` and `distance` actually loggable (Wave 4) | New catalog rows for holds and jumps are only demonstrable once their types work. | Wave 4 tail |

### Artificial Dependencies Removable by Gate 0

| ID | Coupling | Frozen Artifact | Unlocks |
|---|---|---|---|
| A-001 | Derivation, persistence, backup and UI each need to name the nine types | `src/domain/measurement.ts` | Waves 2–4 |
| A-002 | Four areas each need to know which fields a set of a given type carries | the shape table inside that module | Waves 2–4 |
| A-003 | Progression and records each need "which axis, which direction" | the two-axis accessors inside that module | Waves 2–4 |

## Execution Strategy

**Topology: single-agent sequential.**

Reason. Concurrent writers are rejected on three grounds, in order of weight:

1. **The write sets are not provably disjoint.** `src/db/repositories/backup.ts`
   is wanted by both a persistence and a backup workstream, and
   `src/domain/types.ts` is wanted by all of them. Gate 0 removes the second
   collision; it does not remove the first.
2. **The change carries an irreversible migration** against the only copy of a
   lifter's training history. Reliability is `critical`. One reviewer over one
   diff is the control that matters here, and parallelism buys speed against a
   bottleneck — understanding — that it cannot relieve.
3. **This is a single-developer repository.** An eight-worktree fan-out would be
   ceremony, and the skill's required sequential fallback would be the thing
   actually executed.

The ownership map below therefore governs **which files a wave may touch**, not
which agent may touch them. It still earns its place: it is what keeps a
31-file change reviewable one wave at a time, and it is what makes the two
version numbers single-writer facts.

## Gate 0

Required: **Yes.**

Goal: materialize the contract the spec already froze. Nothing here is designed;
every shape below is stated in a `REQ-*`. **The build ends Gate 0 red by
construction** — widening `reps` and the planned rep range is what turns the
type checker into the worklist Wave 1 works through. That is deliberate, and it
is the only point in the plan where a red tree is acceptable.

| Artifact | Frozen Shape | Requirement IDs | Owner | May Edit | Check |
|---|---|---|---|---|---|
| `src/domain/measurement.ts` *(new)* | the nine-member union; per type the field shape, the weight field's meaning, the target axis, the progress axis, the direction | REQ-101, REQ-102, REQ-103 | Gate 0 | the new file only | `pnpm typecheck` on the file; TST-101, TST-102, TST-127 authored here |
| `Exercise.measurement` | required | REQ-104 | Gate 0 | `src/domain/types.ts` | typecheck |
| `ExerciseSessionBase.measurement` | required, on the base — **not** among `planned*` | REQ-105 | Gate 0 | `src/domain/types.ts` | typecheck |
| `CompletedSet` | `+durationSeconds`, `+distance`, `+distanceUnit`, `+distanceM`, all nullable; `reps` → `number \| null`; `weight`/`unit`/`weightKg`/`rir` unchanged | REQ-106 | Gate 0 | `src/domain/types.ts` | typecheck |
| `DistanceUnit`, `toMetres` | `'m' \| 'km' \| 'mi'`, canonical metres, mirroring `toKg` | REQ-107 | Gate 0 | `src/domain/units.ts` | TST-112 |
| `Session.bodyweightKg` | `number \| null` | REQ-108 | Gate 0 | `src/domain/types.ts` | typecheck |
| `PlannedExercise` / `PlannedExerciseSession` targets | `minReps`/`maxReps` → nullable, names unchanged; `+minTarget`/`maxTarget` and `+plannedMinTarget`/`plannedMaxTarget`, nullable, canonical units | REQ-135, REQ-138, REQ-139 | Gate 0 | `src/domain/types.ts` | typecheck |

Stop if:

- materialization would require a new design decision;
- a shape here cannot be expressed without also changing a stored row — that
  contradicts DEC-L and DEC-Q and reopens the decision.

## Ownership Map

| Workstream | Mode | REQ IDs | May Read | May Edit | Integration-Reserved | Must Not Edit | Depends On |
|---|---|---|---|---|---|---|---|
| Gate 0 | write | 101–108, 135, 138, 139 | all | `domain/measurement.ts`, `domain/types.ts`, `domain/units.ts` | — | everything else | — |
| WS-1 Green | write | 123 (part), 122 (typing) | all | every file the compiler names; `domain/catalog/data.ts` | `docs/**` | version numbers | Gate 0 |
| WS-2 Derivation | write | 113–117, 119–121 | all | `domain/history.ts`, `domain/progression/index.ts`, `domain/session-summary.ts` + their tests | `docs/**` | `db/**`, `features/**` | WS-1 |
| WS-3 Persistence | write | 124–126 | all | `db/schema.ts`, `db/migrations.test.ts`, `db/schema.test.ts`, `db/repositories/*.ts` except `backup.ts` | `docs/**` | `BACKUP_VERSION` | WS-2 |
| WS-4 Compatibility | write | 127–131, 139 (validators) | all | `domain/backup/**`, `db/repositories/backup.ts`, `domain/routine-file/**` | `docs/**` | `SCHEMA_VERSION` | WS-3 |
| WS-5 UI | write | 109–112, 118, 132–134, 140, 122 (rows), 108 (carry-forward) | all | `features/**`, `domain/catalog/data.ts` | `docs/**` | `domain/**` except catalog data, `db/schema.ts` | WS-4 |
| WS-6 Docs | integration | 136, 137 | all | `docs/PRD.md`, `CONTEXT.md`, `AGENTS.MD`, `docs/changes/**` | — | `src/**` | WS-5 |

`src/domain/types.ts` is **integration-reserved after Gate 0**. If a later wave
believes it needs to change, that is a stop condition, not an edit: the contract
was frozen precisely so that four waves could not each bend it.

## Generated / Migration / Project / Lockfile Ownership

| File / Pattern | Owner | When It May Change | Validation |
|---|---|---|---|
| `src/db/schema.ts` — `SCHEMA_VERSION`, the v3 `upgrade()` | WS-3, sole writer | Wave 3 only | TST-113, TST-114, TST-124 |
| `src/domain/backup/document.ts` — `BACKUP_VERSION` | WS-4, sole writer | Wave 4 only | TST-115, TST-116 |
| `src/domain/backup/csv.ts` — `CSV_HEADER` | WS-4, sole writer | Wave 4 only | TST-119 |
| `pnpm-lock.yaml` | nobody | never — ASM-6 says no dependency is added | its absence from the final diff is the check |
| `docs/PRD.md`, `CONTEXT.md` | WS-6, sole writer | Wave 5 only | review against AC-157…AC-159 |

No codegen and no migrations directory exist: the Dexie upgrade is hand-written
in `db/schema.ts`.

## Wave 1 — The tree compiles and behaves exactly as it did

Goal: absorb the widened contract with **zero behavior change**, so that the
557 existing tests pass untouched. This is the safety checkpoint the rest of the
plan rests on: after it, every later diff is behavior, not adaptation.

- Requirements: REQ-122 (typing the 96 existing rows), REQ-123.
- Acceptance: AC-133, AC-134.

### Workstream WS-1 — Green again

- May edit: every file the type checker names, plus `domain/catalog/data.ts`.
- Must not edit: `SCHEMA_VERSION`, `BACKUP_VERSION`, `docs/**`.
- Steps:
  1. Type all 96 catalog rows. Data only; `weighted-dip` and
     `weighted-pull-up` become `weighted_bodyweight`, `plank` becomes
     `duration`, the rest follow their movement. No slug added, renamed or
     removed.
  2. Work the compiler's list. Every adapted site keeps **today's** behavior:
     a null `reps` cannot occur yet in stored or newly written data, so each
     site takes the branch it takes today, and the null branch is written to be
     unreachable-but-honest rather than to guess at new behavior.
  3. `logSet`, `editSet` and the two `start*Exercise` constructors pass the new
     fields through as null / snapshot the measurement.
- Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- Evidence: **557 tests still pass, none edited.** A test that had to change is
  a behavior change and belongs in a later wave.
- Stop conditions: an existing test must be modified to pass; a call site cannot
  preserve today's behavior without a product decision.

### Wave 1 Integration Gate

- Must inspect: the combined diff. Every non-catalog hunk should be a type
  adaptation; any hunk that changes a comparison, a formula or a rendered string
  is out of scope for this wave.
- Checks: all four commands green; `git diff --stat` reviewed against the
  ownership map.
- Completion: AC-133, AC-134 met; TST-122 passing; 557 tests unmodified.

## Wave 2 — Derived figures read the right axis in the right direction

Goal: the behavior DEC-A·3 exists for. Pure functions only — no storage, no
screens, so every claim here is provable by a test with no database.

- Requirements: REQ-113…REQ-117, REQ-119…REQ-121.
- Acceptance: AC-118…AC-132, AC-160, AC-161, AC-168.

### Workstream WS-2 — Axis and sign

- May edit: `domain/history.ts`, `domain/progression/index.ts`,
  `domain/session-summary.ts`, and their tests.
- Must not edit: `db/**`, `features/**`, `domain/types.ts`.
- Steps:
  1. **Tests first**, and specifically the inverted ones: TST-103, TST-104,
     TST-110. The audit recorded zero existing coverage for a downward-better
     axis, and this is the wave that creates the defect if it creates one.
  2. TST-105 and AC-119/AC-124/AC-160 as regression: `weight_reps` output must
     be identical to today's, and a stored `weighted-dip` estimate must not move.
  3. `better`, `estimateOneRepMaxKg`, `ExercisePoint`, `exerciseSeries`,
     `doubleProgression`, the per-family accumulators.
  4. `effortOf` and `estimateDuration` are **not touched** (ASM-1, ASM-2).
- Checks: all four commands; TST-101…TST-111, TST-126, TST-127.
- Evidence: the inverted-axis tests fail before the change and pass after.
- Stop conditions: an axis is needed that is neither higher- nor lower-better; a
  type's two axes cannot be named; `effortOf` appears to need changing.

### Wave 2 Integration Gate

- Must inspect: that no `db/` or `features/` file appears in the diff.
- Completion: every Wave 2 `AC-*` met; TST-101…TST-111, TST-126, TST-127 green.

## Wave 3 — The database moves forward, once, and survives it

Goal: the irreversible step, taken with the axis model already proven.

- Requirements: REQ-124, REQ-125, REQ-126.
- Acceptance: AC-136…AC-140.

### Workstream WS-3 — Migration

- May edit: `db/schema.ts`, `db/migrations.test.ts`, `db/schema.test.ts`,
  `db/repositories/*.ts` **except** `backup.ts`.
- Must not edit: `BACKUP_VERSION`, `domain/**`, `features/**`.
- Steps:
  1. **TST-113 first**, seeding a real version-2 database through raw
     IndexedDB, following the existing harness. It must assert that every
     `completedSets` row is byte-identical after the upgrade — that assertion is
     DEC-L's guarantee made executable, and it is the single most important
     line in this wave.
  2. `SCHEMA_VERSION = 3`, both versions redeclaring the same stores, v3 adding
     `.upgrade()`. Backfill `exercises` and `exerciseSessions` only. Leave a row
     that already carries a measurement alone, for the reason
     `backfillPlannedUnit` leaves an existing `plannedUnit` alone.
  3. TST-114 — export after upgrade, and `parseBackup` accepts it. This repo has
     shipped a database whose own validator refused its own export; this is the
     check that prevents the repeat.
  4. TST-124 — nine tables, assertion unchanged.
- Checks: all four commands; TST-113, TST-114, TST-124.
- Evidence: the byte-identical assertion on `completedSets`, and a green
  export→restore round trip.
- Stop conditions: the migration cannot be made forward-only; a stored
  `CompletedSet` appears to need rewriting; the nine-table assertion cannot stay
  passing.

### Wave 3 Integration Gate

- Must inspect: that `completedSets` appears nowhere in the upgrade function.
- Completion: AC-136…AC-140 met.

## Wave 4 — Files and exports carry the new shape without breaking old ones

Goal: the three compatibility directions of spec §7.

- Requirements: REQ-127…REQ-131, REQ-139 (validator half).
- Acceptance: AC-141…AC-150, AC-164…AC-166.

### Workstream WS-4 — Backup, CSV, routine file

- May edit: `domain/backup/**`, `db/repositories/backup.ts`,
  `domain/routine-file/**`.
- Must not edit: `SCHEMA_VERSION`.
- Steps:
  1. `BACKUP_VERSION = 2`; the new fields nullable and optional so a v1
     document is not refused for lacking them; `measurement` closed like
     `progression` is closed.
  2. TST-115, TST-116 — v1 restores; a v2 document is refused by a build reading
     v1.
  3. `CSV_HEADER` appended, never inserted; TST-119 asserts column **indices**.
  4. Routine file `version` accepts 1 or 2; TST-120, TST-121. TST-121 runs over
     `docs/bloque-a-acumulacion.yaml` and `docs/bloque-b-intensificacion.yaml` —
     the repository's own programme must still import.
  5. TST-128 — both target pairs populated, or neither, is refused by both
     validators.
- Checks: all four commands; TST-115…TST-121, TST-128.
- Evidence: a v1 fixture document restoring green.
- Stop conditions: a v1 document needs a field mapping to restore — that is the
  translation layer DEC-Q rejected, and it means a rename crept in.

### Wave 4 Integration Gate

- Must inspect: the first seven CSV columns unchanged and in order; no field
  renamed anywhere in `domain/`.
- Completion: AC-141…AC-150, AC-164…AC-166 met.

## Wave 5 — A lifter can log and programme every kind of work

Goal: the goal of §1, reachable from the screen.

- Requirements: REQ-109…REQ-112, REQ-118, REQ-122 (new rows), REQ-132…REQ-134,
  REQ-140, REQ-108 (carry-forward).
- Acceptance: AC-107, AC-109, AC-111…AC-117, AC-121, AC-127, AC-128,
  AC-151…AC-156, AC-162, AC-163, AC-167, AC-169, AC-170.

### Workstream WS-5 — Screens, forms, and the rows that need them

- May edit: `features/**`, `domain/catalog/data.ts`.
- Must not edit: `domain/**` other than catalog data, `db/schema.ts`.
- Steps:
  1. `SetFields` becomes measurement-driven, one control shared by the logger
     and the editor (REQ-111). The per-type completion guard replaces
     `reps === 0`.
  2. `SetPill`, `format.ts`, the chart's metric switch.
  3. Bodyweight carry-forward and edit on the Session.
  4. Create-Exercise measurement; the correction verb, refused once any set
     references the Exercise; the add-Planned-Exercise target fields.
  5. **Last:** the new catalog rows — the isometric holds as `duration`, the
     jumps as `distance`. They are added here because this is the first point at
     which they can be demonstrated. Existing `Category` and `Equipment`
     vocabularies unchanged (REQ-140); no cardio row, no `weight_reps` row.
  6. TST-129, TST-130, TST-125, TST-123.
- Checks: all four commands; the Wave 5 tests.
- Evidence: a plank programmed `3 × 45s` and logged in seconds; a broad jump
  logged in metres; `CATALOG_CATEGORIES` and `CATALOG_EQUIPMENT` unchanged.
- Stop conditions: ASM-5 proves false and `AddToRoutine`'s form needs
  restructuring; a movement in the repository's own programme fits none of the
  nine types.

### Wave 5 Integration Gate

- Must inspect: the full combined diff against the ownership map; `pnpm-lock.yaml`
  absent.
- Completion: every remaining `AC-*` met.

## Wave 6 — The documents say what the code does

- Requirements: REQ-136, REQ-137.
- Acceptance: AC-157, AC-158, AC-159.

### Workstream WS-6 — Docs

- May edit: `docs/PRD.md`, `CONTEXT.md`, `AGENTS.MD`, `docs/changes/**`.
- Must not edit: `src/**`.
- Steps: amend §11.7 and §14.8 so neither states the set shape as universal;
  §19 for the appended columns; §11.11 for the per-type metrics; §39 gains group
  C row **16**, leaving 9–15 unrenumbered. `CONTEXT.md` gains **Measurement**
  and **Distance Unit**; **Unit**'s definition is left exactly as it stands.
- Checks: review against AC-157…AC-159.
- Stop conditions: an amendment would contradict a requirement rather than
  describe it.

## Single-Agent Fallback

This plan **is** the sequential path; there is nothing to fall back from. The
order is: Gate 0 → Wave 1 → gate → Wave 2 → gate → Wave 3 → gate → Wave 4 →
gate → Wave 5 → gate → Wave 6.

Reason: it follows D-001…D-006. Contract before consumers; adaptation before
behavior; pure logic before the irreversible write; storage before the screens
that read it; documents last, when there is something settled to describe.

Each wave is independently committable and each gate leaves all four commands
green, so the work can stop at any gate without leaving the tree broken — except
inside Gate 0, which must be completed into Wave 1 before the tree compiles
again.

## Requirement Execution Matrix

| Requirement | Wave / Gate | Owner | Acceptance | Tests |
|---|---|---|---|---|
| REQ-101, 102, 103 | Gate 0 | Gate 0 | AC-101, 102, 103, 167, 168 | TST-101, 102, 127 |
| REQ-104, 105, 106 | Gate 0 | Gate 0 | AC-104…108 | TST-113 |
| REQ-107 | Gate 0 | Gate 0 | AC-109, 110 | TST-112 |
| REQ-108 | Gate 0 + Wave 5 | Gate 0, WS-5 | AC-111, 112 | TST-113 |
| REQ-109…112 | Wave 5 | WS-5 | AC-113…117 | TST-125 |
| REQ-113…117 | Wave 2 | WS-2 | AC-118…126, 160 | TST-103…108, 126 |
| REQ-118 | Wave 5 | WS-5 | AC-127, 128 | TST-106 |
| REQ-119…121 | Wave 2 | WS-2 | AC-129…132 | TST-109, 110, 111 |
| REQ-122 | Wave 1 (typing) + Wave 5 (rows) | WS-1, WS-5 | AC-133…135, 169 | TST-122, 130 |
| REQ-123 | Wave 1 | WS-1 | AC-134 | TST-121, 122 |
| REQ-124…126 | Wave 3 | WS-3 | AC-136…140 | TST-113, 114, 124 |
| REQ-127…131 | Wave 4 | WS-4 | AC-141…150 | TST-115…121 |
| REQ-132…134 | Wave 5 | WS-5 | AC-151…155 | TST-123 |
| REQ-135, 138, 139 | Gate 0 + Wave 4 | Gate 0, WS-4 | AC-156, 162…166 | TST-128, 129 |
| REQ-136, 137 | Wave 6 | WS-6 | AC-157…159 | review |
| REQ-140 | Wave 5 | WS-5 | AC-170 | TST-122, 130 |

Every one of the 40 requirements has an owner; every one of the 30 tests is
scheduled.

## Final Verification

| Command / Check | Covers | Environment | Required Evidence |
|---|---|---|---|
| `pnpm test` | all `TST-*` | node + `fake-indexeddb` | ≥ 587 tests passing (557 baseline + the 30 new), zero baseline tests modified outside Wave 2's stated regressions |
| `pnpm typecheck` | both tsconfigs | node | clean |
| `pnpm lint` | flat config | node | clean |
| `pnpm build` | vite production build | node | clean |
| `pnpm exec stryker run` over `domain/measurement.ts`, `domain/history.ts`, `domain/progression/index.ts` | spec §12 | node | surviving mutants reviewed — these are the modules where a survivor is a wrong-but-plausible number rather than a crash |
| Manual: upgrade a real pre-change database, export, restore | REQ-124, REQ-127 | browser | the round trip completes and history is intact |
| `git diff --stat` vs the ownership map | plan compliance | — | no `pnpm-lock.yaml`; no file edited outside its wave's ownership |

## Global Stop Conditions

- The frozen spec and the repository contradict each other.
- The base commit or a cited path changes enough to stale this plan.
- A wave needs to write outside its ownership — in particular
  `src/domain/types.ts` after Gate 0, or a version number outside its wave.
- A stored `CompletedSet` appears to need rewriting (DEC-L).
- A v1 backup needs a field mapping to restore (DEC-Q).
- The nine-table assertion cannot be kept passing.
- A tenth measurement type is needed, or one of the nine cannot be expressed.
- `effortOf` or `estimateDuration` appears to need changing (ASM-1, ASM-2).
- A new dependency appears necessary (ASM-6).
- Wave 1 cannot reach green without modifying an existing test.
