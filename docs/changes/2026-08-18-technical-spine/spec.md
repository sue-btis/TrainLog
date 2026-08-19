# TrainLog Technical Spine — Spec

Status: Ready for planning
Size: large
Reliability: critical
Audit baseline: `da7a3daa52999e9fbc76110097d9e9460b74ca35` (`master`, clean)

## 1. Goal

The two core flows of PRD §47 execute end to end against IndexedDB, and are provable by automated tests plus a minimal harness UI:

```text
routine.yaml → parse → validate → domain objects → Dexie → Placements → query Routine
PlannedExercise → start Session → snapshot targets → ExerciseSession → CompletedSet → Dexie → history → derived progression
```

An implementation is done when a routine file can be imported into IndexedDB, a Session can be performed against it, that Session survives a page reload, its history reads back, and `double_progression` derives the next load from that history — with no network request at any point.

## 2. Scope

### Included

- Project bootstrap: pnpm, Vite, React, TypeScript, Vitest, ESLint, `.gitignore`, dev-server entry.
- `src/domain/` — types, id generation, unit conversion, YAML schema and parsing, structural and semantic validation, exercise resolution, routine-file-to-domain mapping, placement generation, next-in-rotation, missed derivation, target snapshot, session status derivation, progression engine (`manual`, `double_progression`).
- `src/domain/catalog/` — an authored starter Exercise catalog of 60–100 lifts with stable slug ids, shipped inside the build.
- `src/db/` — Dexie schema version 1 and the repository layer, the only IndexedDB access in the tree.
- `src/styles/theme.css`, `src/assets/fonts/`, `src/lib/utils.ts` — the token and font foundation prescribed by `DESIGN.md:538-600`.
- A minimal harness UI that drives both §47 flows in a browser.
- Domain unit tests, and repository tests against `fake-indexeddb`.

### Excluded

- Import wizard UI, calendar UI, Today screen, gym-mode execution screen (the harness UI is not any of these and must not be mistaken for them).
- Rest timer, in domain and in UI.
- Backup, restore, CSV export.
- PWA manifest and service worker; `vite-plugin-pwa` is **not** installed in this change.
- Progress dashboard and any charting library.
- shadcn/ui components and the shadcn CLI.
- Routine editing after accept, routine archival and deletion UI, exercise creation UI.

## 3. Required Behavior

### Bootstrap and tooling

| Requirement ID | Requirement | Provenance | Acceptance IDs |
|---|---|---|---|
| REQ-001 | The project builds and runs from `package.json` scripts `dev`, `build`, `preview`, `test`, `typecheck`, `lint`, all executed with pnpm. | DEC-1; audit "Tests and Validation" | AC-001 |
| REQ-002 | Dependencies are pinned to the versions verified in audit ASM-1. No dependency outside that list is added, and `vite-plugin-pwa` is not installed. | ASM-1, ASM-4 | AC-002 |
| REQ-003 | `tsc --noEmit` passes under TypeScript 7 in `strict` mode with `noUncheckedIndexedAccess` enabled. | DEC-5; §24 identity rigor | AC-003 |
| REQ-004 | ESLint fails the build when `src/domain/**` imports `dexie`, `dexie-react-hooks`, `react` or `react-dom`, or when `src/db/**` imports `react` or `react-dom`. | DEC-4; AGENTS.MD layering | AC-004 |
| REQ-005 | `.claude/launch.json` gains an app dev-server entry; the existing `design-preview` entry is byte-for-byte unchanged. | ASM-6; audit "Do Not Touch" | AC-005 |
| REQ-006 | `.gitignore` excludes `node_modules/`, `dist/`, and Vite/Vitest caches. The pnpm lockfile is committed. | DEC-1 | AC-006 |

### Domain contracts

| Requirement ID | Requirement | Provenance | Acceptance IDs |
|---|---|---|---|
| REQ-010 | `src/domain/types.ts` declares the nine entities of §14.1–14.9 — `Exercise`, `Routine`, `Workout`, `PlannedExercise`, `Session`, `ExerciseSession`, `CompletedSet`, `Placement` — plus `ProgressionRule` as an embedded value type (DEC-006). Field names follow CONTEXT.md vocabulary exactly. | §14.1–14.9; CONTEXT.md | AC-010 |
| REQ-011 | Every entity id is produced by a single `newId()` wrapping `crypto.randomUUID()`. No entity is keyed by a name. | DEC-2; §24 | AC-011, AC-012 |
| REQ-012 | `toKg(weight, unit)` converts using the exact factor `0.45359237` and rounds to 3 decimal places; `kg` input is rounded to the same precision and otherwise unchanged. | ASM-7; §11.7 | AC-013 |
| REQ-013 | Dates that identify a calendar day (`Placement.date`) are stored as `YYYY-MM-DD` local-date strings, never as timestamps, so a Placement cannot drift across a day boundary by timezone. Instants (`createdAt`, `startedAt`, `completedAt`) are stored as epoch milliseconds. | §14.9; §11.3 derived `missed` | AC-014 |

### Exercise catalog and identity

| Requirement ID | Requirement | Provenance | Acceptance IDs |
|---|---|---|---|
| REQ-020 | A starter catalog of 60–100 Exercises ships as a module inside the build, each with a stable kebab-case slug `id`, `name`, `category` and `equipment`. It includes `front-squat`, `weighted-pull-up` and `romanian-deadlift` verbatim. | §11.12; ASM-8 | AC-020 |
| REQ-021 | The catalog is loaded from the build, never fetched, and is never written into the `exercises` table (DEC-007). Exercise lookup resolves a catalog id first, then the `exercises` table. | §11.12, §17, §18; DEC-007 | AC-021, AC-022 |
| REQ-022 | Import resolves each file exercise in this order: `exercise_id` against the catalog → normalized name (trim, lowercase, collapsed inner whitespace) against catalog then user exercises → otherwise create a user Exercise with a generated id. | §26 | AC-023, AC-024, AC-025 |
| REQ-023 | A catalog slug is permanent. Removing or renaming a slug id in a later release is prohibited, because stored history references it. | §24, §26 | AC-021 |

### YAML pipeline

| Requirement ID | Requirement | Provenance | Acceptance IDs |
|---|---|---|---|
| REQ-030 | `parseRoutineFile(text)` parses YAML with `yaml@2` and validates it with a Zod schema for `version: 1`, returning either a typed routine file or a list of structural errors. It performs no I/O. | §11.1, §12; ASM-3; AGENTS.MD | AC-030 |
| REQ-031 | Structural failures reject the file and produce no partial result: malformed YAML, missing or unknown `version`, routine without a name, workout without a name, exercise without a name, or any missing required field. | §11.1 "Structural" | AC-031 |
| REQ-032 | `validateRoutineFile(file)` returns semantic issues, each carrying a machine-readable path to the offending field so the wizard can mark it: `min_reps > max_reps`, RIR outside 0–10, `rest_seconds < 0`, `sets <= 0`, unrecognized progression type, and two Workouts sharing a `suggested_day`. Semantic issues never reject the file. | §11.1 "Semantic" | AC-032, AC-033 |
| REQ-033 | `routineFileToDomain(file, resolution)` produces a `Routine`, its ordered `Workout`s and their ordered `PlannedExercise`s, with ids generated and `order` assigned from list position. It is pure and performs no persistence. | §12, §14; AGENTS.MD | AC-034 |
| REQ-034 | An absent `unit` on an exercise resolves to the user's default unit; an absent `exercise_id` triggers name resolution per REQ-022. `increment` is expressed in the exercise's own unit. | §12 "Field Notes" | AC-035 |

### Scheduling

| Requirement ID | Requirement | Provenance | Acceptance IDs |
|---|---|---|---|
| REQ-040 | `generatePlacements({ workouts, weeks, anchorDate })` returns one `Placement` per suggested day per week, for `weeks` weeks. `anchorDate` is a required explicit parameter — no default and no reading of the clock inside the function (DEC-008). | §12 `weeks`, §11.1 step 2; DEC-008 | AC-040, AC-041 |
| REQ-041 | Week 1 is the seven days beginning on the Monday of the week containing `anchorDate`. Generated dates strictly before `anchorDate` are omitted, so importing mid-week does not create placements in the past. | DEC-008 | AC-042 |
| REQ-042 | Placement generation does not enforce the wizard's one-workout-per-suggested-day rule; if two Workouts resolve to the same date it emits both. | §14.9; §11.1 contradiction resolved in audit | AC-043 |
| REQ-043 | `nextWorkoutInRotation(workouts, lastPerformedWorkoutId)` returns the next Workout by `order`, wrapping at the end, and the first Workout when nothing has been performed. | §11.4 | AC-044 |
| REQ-044 | `isMissed(placement, sessions, today)` derives a missed day as a Placement whose date is before `today` with no Session recorded for that Workout on that date. Nothing is written. | §11.3; ADR 0001 | AC-045 |

### Session execution

| Requirement ID | Requirement | Provenance | Acceptance IDs |
|---|---|---|---|
| REQ-050 | Starting a Session creates a `Session` with `status: 'in_progress'`, `startedAt`, `routineId` and `workoutId`, and no reference to any Placement. | §14.6; ADR 0001 | AC-050, AC-051 |
| REQ-051 | Starting an exercise creates an `ExerciseSession` that copies the `PlannedExercise` targets into itself: `plannedSets`, `plannedMinReps`, `plannedMaxReps`, `plannedMinRir`, `plannedMaxRir`, `plannedRestSeconds`, and the progression rule. It stores `plannedExerciseId` for provenance but never reads targets back through it. | §14.7; §16; ADR 0002 | AC-052, AC-053 |
| REQ-052 | An unplanned exercise creates an `ExerciseSession` with `plannedExerciseId: null` and no planned targets. | §11.5, §14.7 | AC-054 |
| REQ-053 | Editing a `PlannedExercise` after a Session started does not alter that Session's snapshot. | §16; ADR 0002 | AC-053 |
| REQ-054 | Logging a set stores `weight` and `unit` as entered plus derived `weightKg`, with `reps`, `rir`, `setNumber` and `completedAt`. Every set persists at the moment it is logged, not at session end. | §11.7; NFR-03 | AC-055, AC-056 |
| REQ-055 | A Session may deviate freely: more sets than planned, fewer sets, a skipped exercise, reordered exercises, an unplanned exercise. No deviation produces an error or blocks the flow. | §11.5 | AC-057 |
| REQ-056 | `ExerciseSession.status` is one of `pending`, `performed`, `skipped`. It becomes `performed` on the first logged set and `skipped` only by explicit user action. | §14.7; DEC-009 | AC-058 |
| REQ-057 | Finishing a Session sets `completedAt` and derives `status`: `completed` when no `ExerciseSession` is still `pending`, otherwise `partial` (DEC-009). | §36; DEC-009 | AC-059, AC-060 |
| REQ-058 | At most one Session is `in_progress` at a time, and it is recoverable after reload: reopening the app finds it by status and resumes with all sets already logged. | §35, §36 | AC-061 |

### Progression

| Requirement ID | Requirement | Provenance | Acceptance IDs |
|---|---|---|---|
| REQ-060 | The progression engine is a pure function over history and a rule. No suggested or current working weight is stored anywhere. | §11.9 "Derived, never stored"; AGENTS.MD | AC-062 |
| REQ-061 | History is queried by `exerciseId`, never by `plannedExerciseId`. | §11.9 "Scope"; ADR 0002 | AC-063 |
| REQ-062 | Only Sessions with `status: 'completed'` feed the engine. `partial` and `in_progress` Sessions are visible in history and ignored by progression. | §11.9 | AC-064 |
| REQ-063 | `manual` returns the previous session's weight for that exercise and never advances it. | §28 | AC-065 |
| REQ-064 | `double_progression` evaluates the **first N** sets of the most recent completed session, where N is the planned set count. It suggests `previous weight + increment` when every one of those N sets reached `max_reps`; if fewer than N sets exist the target is not met. Sets beyond N are ignored. | §29 | AC-066, AC-067, AC-068 |
| REQ-065 | An exercise with no completed history, and any unplanned exercise, receives no suggestion. | §11.9 | AC-069 |
| REQ-066 | All progression arithmetic uses `weightKg`; the suggestion is returned in the exercise's own unit alongside its kilogram value. | §11.7; AGENTS.MD "Weight carries its unit" | AC-070 |

### Persistence

| Requirement ID | Requirement | Provenance | Acceptance IDs |
|---|---|---|---|
| REQ-070 | Dexie schema **version 1** declares exactly these tables: `routines`, `workouts`, `plannedExercises`, `placements`, `exercises`, `sessions`, `exerciseSessions`, `completedSets`, `settings`. No other store is created. | §17, §34; audit "Contracts" | AC-071 |
| REQ-071 | The `exercises` table holds user-created Exercises only; catalog Exercises are never inserted into it (DEC-007). | §17, §18; DEC-007 | AC-022, AC-072 |
| REQ-072 | Indexes support the queries this change requires: sessions by `status` and by `startedAt`, exerciseSessions by `sessionId` and by `exerciseId`, completedSets by `exerciseSessionId`, placements by `date` and by `routineId`, workouts by `routineId`, plannedExercises by `workoutId`, routines by `status`. | NFR-02; §35 | AC-073 |
| REQ-073 | All IndexedDB access lives in `src/db/`. No component, hook or domain function opens a database. | AGENTS.MD layering | AC-004, AC-074 |
| REQ-074 | Accepting an import writes the Routine, its Workouts, PlannedExercises, any newly created user Exercises and the generated Placements in a single Dexie transaction. A failure leaves no partial routine behind. | §11.1 "no se almacena hasta que el usuario acepta"; critical profile | AC-075 |
| REQ-075 | `deleteRoutine` is refused while any Session references the Routine, and reports that archival is the alternative. Archiving sets `status: 'archived'`. | §11.2, §37 | AC-076, AC-077 |
| REQ-076 | Activating a Routine leaves at most one Routine with `status: 'active'`. | §11.2 | AC-078 |
| REQ-077 | Settings persist the default unit, and are readable and writable through the repository layer. | §32 | AC-079 |

### Harness UI and styling

| Requirement ID | Requirement | Provenance | Acceptance IDs |
|---|---|---|---|
| REQ-080 | A single-route harness UI drives both §47 flows in a browser: load a `.yaml` file, show structural and semantic validation results, accept the import, list generated Placements, start a Session from a Workout, log sets, finish the Session, show the exercise history, and show the derived progression suggestion. | §47 | AC-080, AC-081 |
| REQ-081 | The app issues no network request at runtime. Fonts, catalog and icons are part of the build. | AGENTS.MD "Offline is the normal case"; §9 | AC-082 |
| REQ-082 | `src/styles/theme.css` holds `@font-face`, a single `@theme` block carrying the DESIGN.md tokens, and the `@utility` type scale, at the exact paths `DESIGN.md:549` prescribes. Font files are copied into `src/assets/fonts/`; `design/fonts/` is left in place. | §8; `DESIGN.md:538-600`; DEC-3 | AC-083, AC-084 |
| REQ-083 | No color, radius, shadow or typography literal appears outside `theme.css`. | §8; DESIGN.md "Named Rules" | AC-085 |

## 4. Frozen Decisions

| Decision ID | Approved Decision | Authority / Source | Affected Requirements |
|---|---|---|---|
| DEC-001 | Scope is the §47 spine; the rest of MVP 0.1 is shaped as follow-on changes. | Change owner, 2026-08-18 | All |
| DEC-002 | Progress dashboard and charts excluded; no charting dependency. | Change owner, 2026-08-18 | REQ-002 |
| DEC-003 | A starter catalog of 60–100 lifts is authored in this change. | Change owner, 2026-08-18 | REQ-020 |
| DEC-1 | Package manager is pnpm; `pnpm-lock.yaml` is committed. | Change owner; audit DEC-1 | REQ-001, REQ-006 |
| DEC-2 | Ids are `crypto.randomUUID()`. | Change owner; audit DEC-2 | REQ-011 |
| DEC-3 | Tailwind v4, `theme.css`, fonts and `cn()` land in this change; shadcn components do not. | Change owner; audit DEC-3 | REQ-082, REQ-083 |
| DEC-4 | ESLint `no-restricted-imports` enforces the layering rule. | Change owner; audit DEC-4 | REQ-004 |
| DEC-5 | Latest toolchain across the board, pinned per ASM-1. | Change owner; audit DEC-5 | REQ-002, REQ-003 |
| DEC-006 | `ProgressionRule` is an **embedded value object** on `PlannedExercise`, not a table. It is 1:1 with its PlannedExercise, created and deleted with it, never queried independently, and §12 nests it inside the exercise. It is modelled as a discriminated union on `type` so §27's future strategies extend it without a schema change. §14.5's separate-entity sketch is satisfied conceptually. | Spec author, from §12/§14.5/§27; audit "Contradictions" item 2 | REQ-010, REQ-051 |
| DEC-007 | The bundled catalog is **not** seeded into the `exercises` table. The table holds user-created Exercises only; lookup consults the catalog module first, then the table. This makes §17 (export user exercises only) and §18 (restore does not replace the bundled catalog) fall out of the storage layout instead of requiring a provenance flag and re-seed migrations on every release. Catalog ids are kebab-case slugs and user ids are UUIDs, so the two id spaces cannot collide and provenance stays derivable. | Spec author, from §11.12/§17/§18; audit "Contradictions" item 3 | REQ-021, REQ-071 |
| DEC-008 | `generatePlacements` takes `anchorDate` as a required explicit parameter. Week 1 begins on the Monday of the week containing the anchor, and dates before the anchor are omitted. §12 deliberately removes `start_date`, so the anchor belongs to the caller — wizard step 2 in a later change, the harness UI here. The function reads no clock, which is what makes it testable. | Spec author, from §12/§11.1; audit "Contradictions" item 4 | REQ-040, REQ-041 |
| DEC-009 | A finished Session is `completed` when no `ExerciseSession` is still `pending`, and `partial` otherwise. Explicitly skipping an exercise is a legitimate deviation (§11.5) and does not make a Session partial; abandoning one mid-way does. The rule reads existing state (`ExerciseSession.status`, §14.7), needs no extra field, and is explainable in one sentence — the standard §29 sets for this product. | Spec author, from §36/§11.5/§14.7; audit "Contradictions" item 5 | REQ-056, REQ-057, REQ-062 |

## 5. Expected Change Areas

| Area / File | Expected Change | Audit Evidence | Confidence |
|---|---|---|---|
| `package.json`, `pnpm-lock.yaml`, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `index.html`, `.gitignore` | Created | Audit W0 | High |
| `.claude/launch.json` | Append one app entry | Audit "Integration Hotspots" | High |
| `src/domain/types.ts`, `ids.ts`, `units.ts`, `dates.ts` | Created — the frozen contract | Audit W1 | High |
| `src/domain/routine-file/**` | Created — schema, parse, semantic validation, resolution, mapping | Audit W2 | High |
| `src/domain/scheduling/**` | Created — placements, rotation, missed | Audit W3 | High |
| `src/domain/session/**`, `src/domain/progression/**` | Created — snapshot, status derivation, engine | Audit W4 | High |
| `src/domain/catalog/**` | Created — data file plus loader and resolution | Audit W5 | High |
| `src/db/database.ts`, `src/db/schema.ts`, `src/db/repositories/**` | Created — Dexie v1 and repositories | Audit W6 | High |
| `src/styles/theme.css`, `src/assets/fonts/*.woff2`, `src/lib/utils.ts` | Created per `DESIGN.md:549` | DEC-3 | High |
| `src/main.tsx`, `src/App.tsx`, `src/features/**` | Created — harness UI | Audit W7 | Medium |
| `**/*.test.ts` | Created alongside the code under test | AGENTS.MD "Tests" | High |
| `CONTEXT.md` | Append-only, and only if a term genuinely settles | AGENTS.MD | Low |

## 6. Contracts

### Changed

- **Routine file format v1** — the YAML surface of §12 becomes executable: field names, types, optionality, and the `version: 1` handle. This is user-facing; a later format change needs a version bump.
- **Domain type set** — `src/domain/types.ts` becomes the contract every later change reads.
- **Dexie schema version 1** — table names and indexes per REQ-070 and REQ-072. Irreversible for any user who stores data.
- **Repository surface** — `src/db/`; the seam AGENTS.MD draws at `features → db`.
- **Catalog slug ids** — permanent once published (REQ-023).

### Preserved

- Every AGENTS.MD invariant: no runtime network, snapshot on start, derived progression keyed by `exerciseId`, Placement and Session mutually unreferencing, weight carrying its unit, routines immutable after accept, generated ids.
- CONTEXT.md vocabulary, in identifiers as well as prose.
- ADR 0001 and ADR 0002.
- The `design-preview` entry in `.claude/launch.json`, and `design/` as a whole.
- All documentation under `docs/`, plus `DESIGN.md`, `PRODUCT.md`, `README.MD`.

## 7. Security, Tenant, Permission, and Compatibility

- No account, no authentication, no tenancy, no telemetry. A single local user (§NFR-08).
- All data is local and unencrypted in IndexedDB, which is the product's stated model (§G5, §NFR-07). This change introduces no secret and no credential.
- `crypto.randomUUID()` requires a secure context; localhost and HTTPS both qualify, and the app has no other deployment mode.
- Forward compatibility rests on two version handles: the routine file's `version: 1` and the Dexie schema version. Both must be treated as public.
- No runtime network request is permitted, so no third-party origin is contacted and there is no CSP-relevant external surface (REQ-081).

## 8. Migration, Rollout, and Recovery

- No migration exists to write: the schema is created at version 1 against an empty database.
- Dexie schema version 1 is nonetheless irreversible in effect — any later change must be a forward migration, because a user's IndexedDB is the only copy of their history. Getting the table set right now is the point of the `critical` profile.
- Recovery within scope is session recovery only (REQ-058): an `in_progress` Session is found by status on load, and every set is already durable because it persisted when logged (REQ-054).
- Backup and restore, the actual disaster-recovery story of §17–§18, are explicitly out of scope. This change must leave the schema in a shape they can serialize — which REQ-070 and DEC-007 provide.

## 9. Test Requirements

| Test ID | Required Check | Covers | Required Evidence |
|---|---|---|---|
| TST-001 | The §12 example file parses into the expected domain objects | REQ-030, REQ-033 | Passing test naming the example |
| TST-002 | Each structural failure class rejects the file and yields no partial result | REQ-031 | One case per class in §11.1 |
| TST-003 | Each semantic check fires on a violating file and stays silent on a valid one, with a field path | REQ-032 | One case per check in §11.1 |
| TST-004 | Exercise resolution: by `exercise_id`, by normalized name, and creating a user exercise on no match | REQ-022 | Three cases; normalization covers case, trim and inner whitespace |
| TST-005 | `toKg` round-trips kg unchanged and converts lb by `0.45359237` at the specified precision | REQ-012 | Table-driven cases |
| TST-006 | Placement generation for `weeks: n` and multiple suggested days yields the expected date set from a fixed anchor | REQ-040, REQ-041 | Fixed anchor, asserted date list |
| TST-007 | Dates before the anchor are omitted; two Workouts on one date both emit | REQ-041, REQ-042 | Two cases |
| TST-008 | Rotation wraps, and returns the first Workout when nothing was performed | REQ-043 | Two cases |
| TST-009 | `missed` is derived for a past Placement with no Session, and not for one with a Session, and writes nothing | REQ-044 | Assert no persistence call |
| TST-010 | Snapshot copies all planned fields; mutating the PlannedExercise afterwards leaves the ExerciseSession unchanged | REQ-051, REQ-053 | The ADR 0002 regression test |
| TST-011 | Session status derives `completed` with no pending exercise, and `partial` with one | REQ-057 | Two cases, plus a skipped-exercise case yielding `completed` |
| TST-012 | `double_progression` suggests an increment when the first N sets hit max reps; withholds when one falls short; ignores sets beyond N; withholds when fewer than N sets exist | REQ-064 | Four cases, per §29 |
| TST-013 | Progression ignores `partial` and `in_progress` sessions | REQ-062 | Passing test |
| TST-014 | Progression reads by `exerciseId` across two different Routines and continues the history | REQ-061 | The §26 continuity test |
| TST-015 | `manual` never advances load | REQ-063 | Passing test |
| TST-016 | No suggestion for an exercise with no completed history, and none for an unplanned exercise | REQ-065 | Two cases |
| TST-017 | Repository round-trip for every table under `fake-indexeddb` | REQ-070, REQ-072 | One test per table |
| TST-018 | Accepting an import is atomic: an induced failure mid-write leaves no Routine, Workout, PlannedExercise or Placement behind | REQ-074 | Failure-injection test |
| TST-019 | `deleteRoutine` is refused while a Session references the Routine, and permitted once none does | REQ-075 | Two cases |
| TST-020 | Activating a second Routine leaves exactly one active | REQ-076 | Passing test |
| TST-021 | An `in_progress` Session with logged sets is recovered from a fresh database handle with all sets intact | REQ-058 | Simulates reload |
| TST-022 | A catalog Exercise is never written to the `exercises` table during import | REQ-021, REQ-071 | Assert table contents after import |
| TST-023 | The catalog contains `front-squat`, `weighted-pull-up`, `romanian-deadlift`, has 60–100 entries, and every id is a unique kebab-case slug | REQ-020 | Passing test |
| TST-024 | ESLint rejects a `dexie` import inside `src/domain/` and a `react` import inside `src/db/` | REQ-004 | Lint run on a fixture, or a rule unit test |

## 10. Acceptance Criteria

| Acceptance ID | Observable Pass/Fail Condition | Covers |
|---|---|---|
| AC-001 | `pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint` all succeed from a clean clone | REQ-001 |
| AC-002 | `package.json` lists exactly the ASM-1 dependency set; `vite-plugin-pwa` and every charting library are absent | REQ-002 |
| AC-003 | `pnpm typecheck` reports zero errors with `strict` and `noUncheckedIndexedAccess` on | REQ-003 |
| AC-004 | `pnpm lint` fails on a `dexie` import added to `src/domain/` and on a `react` import added to `src/db/` | REQ-004, REQ-073 |
| AC-005 | `.claude/launch.json` contains both the original `design-preview` entry, unmodified, and a new app entry that starts the dev server | REQ-005 |
| AC-006 | `git status` is clean after a build and a test run; the lockfile is tracked | REQ-006 |
| AC-010 | Every §14 entity and field exists in `src/domain/types.ts` under its CONTEXT.md name | REQ-010 |
| AC-011 | No stored entity uses a name as its primary key | REQ-011 |
| AC-012 | Two entities created in the same tick receive different ids | REQ-011 |
| AC-013 | `toKg(100, 'lb')` returns `45.359`; `toKg(75, 'kg')` returns `75` | REQ-012 |
| AC-014 | A Placement created for a local date reads back as the same `YYYY-MM-DD` regardless of the machine's timezone offset | REQ-013 |
| AC-020 | The catalog module exports 60–100 entries including the three §11.12 ids | REQ-020 |
| AC-021 | No catalog id changes within this change, and the catalog is imported statically | REQ-021, REQ-023 |
| AC-022 | After importing a routine referencing only catalog exercises, the `exercises` table is empty | REQ-021, REQ-071 |
| AC-023 | An exercise with `exercise_id: front-squat` resolves to the catalog entry | REQ-022 |
| AC-024 | `"  front   squat "` with no `exercise_id` resolves to `front-squat` | REQ-022 |
| AC-025 | An unknown name creates one user Exercise, and importing the same name again reuses it | REQ-022 |
| AC-030 | The §12 example yields one Routine, one Workout and one PlannedExercise with the file's values | REQ-030 |
| AC-031 | Malformed YAML, absent `version`, `version: 2`, and a nameless routine, workout or exercise each reject with a structural error and no domain object | REQ-031 |
| AC-032 | A file with `min_reps: 8, max_reps: 6` loads, and reports a semantic issue whose path points at that exercise's reps | REQ-032 |
| AC-033 | Two Workouts declaring `monday` produce a semantic issue naming both | REQ-032 |
| AC-034 | `order` on Workouts and PlannedExercises matches file order | REQ-033 |
| AC-035 | An exercise without `unit` adopts the default unit from settings | REQ-034 |
| AC-040 | `weeks: 4` with two suggested days yields 8 Placements from a Monday anchor | REQ-040 |
| AC-041 | Calling `generatePlacements` twice with the same arguments yields the same dates | REQ-040 |
| AC-042 | With a Wednesday anchor, that week's Monday placement is omitted and the remaining weeks are intact | REQ-041 |
| AC-043 | Two Workouts sharing a suggested day produce two Placements on that date | REQ-042 |
| AC-044 | Rotation after the last Workout returns the first | REQ-043 |
| AC-045 | A past Placement with no Session reads as missed; the database is unchanged after the query | REQ-044 |
| AC-050 | A started Session carries `status: 'in_progress'` and a `startedAt` | REQ-050 |
| AC-051 | No Session row references a Placement, and no Placement row references a Session | REQ-050 |
| AC-052 | A started ExerciseSession carries every planned field copied from its PlannedExercise | REQ-051 |
| AC-053 | Editing the PlannedExercise afterwards leaves the ExerciseSession's planned fields unchanged | REQ-051, REQ-053 |
| AC-054 | An unplanned ExerciseSession has `plannedExerciseId: null` and no planned targets | REQ-052 |
| AC-055 | A logged set stores entered `weight` with its `unit` plus `weightKg` | REQ-054 |
| AC-056 | The set is readable from a fresh database handle immediately after logging, before the Session finishes | REQ-054 |
| AC-057 | Logging more sets than planned, fewer than planned, and skipping an exercise all succeed without error | REQ-055 |
| AC-058 | An ExerciseSession is `performed` after its first set and `skipped` only when explicitly skipped | REQ-056 |
| AC-059 | Finishing with every exercise performed or skipped yields `completed` | REQ-057 |
| AC-060 | Finishing with one exercise still `pending` yields `partial` | REQ-057 |
| AC-061 | After reload, the `in_progress` Session is found and every previously logged set is present | REQ-058 |
| AC-062 | No table and no row holds a suggested or current working weight | REQ-060 |
| AC-063 | Progression queries pass `exerciseId`; no call path passes `plannedExerciseId` | REQ-061 |
| AC-064 | A `partial` session containing max-rep sets produces no suggestion | REQ-062 |
| AC-065 | `manual` returns the previous weight and never a higher one | REQ-063 |
| AC-066 | Four planned sets logged at `75 × 6` with `max_reps: 6, increment: 2.5` suggest `77.5` | REQ-064 |
| AC-067 | The same with one set at 5 reps suggests no increase | REQ-064 |
| AC-068 | A fifth set at 6 reps does not change the outcome of AC-067 | REQ-064 |
| AC-069 | A first-ever exercise and an unplanned exercise both return no suggestion | REQ-065 |
| AC-070 | For a `lb` exercise the suggestion is returned in lb, with its kilogram value alongside | REQ-066 |
| AC-071 | The opened database reports exactly the nine tables of REQ-070 | REQ-070 |
| AC-072 | After importing a routine with one unknown exercise name, `exercises` holds exactly that one row | REQ-071 |
| AC-073 | Every query in the repository layer is served by a declared index | REQ-072 |
| AC-074 | `dexie` is imported only under `src/db/` | REQ-073 |
| AC-075 | A failure injected mid-import leaves zero Routines, Workouts, PlannedExercises and Placements | REQ-074 |
| AC-076 | `deleteRoutine` on a Routine with a Session is refused and names archiving | REQ-075 |
| AC-077 | Archiving sets `status: 'archived'` and leaves Sessions untouched | REQ-075 |
| AC-078 | Activating a second Routine leaves exactly one `active` | REQ-076 |
| AC-079 | The default unit written through the repository reads back after reload | REQ-077 |
| AC-080 | In the browser: load the §12 example, accept it, and see the generated Placements listed | REQ-080 |
| AC-081 | In the browser: start a Session, log sets, finish, see the history and the derived suggestion | REQ-080 |
| AC-082 | DevTools Network records zero requests after load while both flows are exercised | REQ-081 |
| AC-083 | `src/styles/theme.css` exists at that path with `@font-face`, one `@theme` block and the `@utility` type scale | REQ-082 |
| AC-084 | The four woff2 files exist under `src/assets/fonts/` and `design/fonts/` still holds its originals | REQ-082 |
| AC-085 | No hex color, radius, shadow or font-family literal appears in any file outside `theme.css` | REQ-083 |

## 11. Traceability

| Requirement | Acceptance | Tests |
|---|---|---|
| REQ-001 | AC-001 | — |
| REQ-002 | AC-002 | — |
| REQ-003 | AC-003 | — |
| REQ-004 | AC-004 | TST-024 |
| REQ-005 | AC-005 | — |
| REQ-006 | AC-006 | — |
| REQ-010 | AC-010 | TST-001 |
| REQ-011 | AC-011, AC-012 | TST-017 |
| REQ-012 | AC-013 | TST-005 |
| REQ-013 | AC-014 | TST-006 |
| REQ-020 | AC-020 | TST-023 |
| REQ-021 | AC-021, AC-022 | TST-022 |
| REQ-022 | AC-023, AC-024, AC-025 | TST-004 |
| REQ-023 | AC-021 | TST-023 |
| REQ-030 | AC-030 | TST-001 |
| REQ-031 | AC-031 | TST-002 |
| REQ-032 | AC-032, AC-033 | TST-003 |
| REQ-033 | AC-034 | TST-001 |
| REQ-034 | AC-035 | TST-004 |
| REQ-040 | AC-040, AC-041 | TST-006 |
| REQ-041 | AC-042 | TST-006, TST-007 |
| REQ-042 | AC-043 | TST-007 |
| REQ-043 | AC-044 | TST-008 |
| REQ-044 | AC-045 | TST-009 |
| REQ-050 | AC-050, AC-051 | TST-017 |
| REQ-051 | AC-052, AC-053 | TST-010 |
| REQ-052 | AC-054 | TST-010 |
| REQ-053 | AC-053 | TST-010 |
| REQ-054 | AC-055, AC-056 | TST-017 |
| REQ-055 | AC-057 | TST-011 |
| REQ-056 | AC-058 | TST-011 |
| REQ-057 | AC-059, AC-060 | TST-011 |
| REQ-058 | AC-061 | TST-021 |
| REQ-060 | AC-062 | TST-012 |
| REQ-061 | AC-063 | TST-014 |
| REQ-062 | AC-064 | TST-013 |
| REQ-063 | AC-065 | TST-015 |
| REQ-064 | AC-066, AC-067, AC-068 | TST-012 |
| REQ-065 | AC-069 | TST-016 |
| REQ-066 | AC-070 | TST-005, TST-012 |
| REQ-070 | AC-071 | TST-017 |
| REQ-071 | AC-022, AC-072 | TST-022 |
| REQ-072 | AC-073 | TST-017 |
| REQ-073 | AC-004, AC-074 | TST-024 |
| REQ-074 | AC-075 | TST-018 |
| REQ-075 | AC-076, AC-077 | TST-019 |
| REQ-076 | AC-078 | TST-020 |
| REQ-077 | AC-079 | TST-017 |
| REQ-080 | AC-080, AC-081 | — (manual) |
| REQ-081 | AC-082 | — (manual) |
| REQ-082 | AC-083, AC-084 | — |
| REQ-083 | AC-085 | — |

## 12. Quality Obligations

- **Reliability gates (critical):** `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` all pass before the change is offered for verification. Every TST-* exists and passes.
- **Required contract checks:** the Dexie table set (TST-017), import atomicity (TST-018), the snapshot regression (TST-010), and the §29 progression cases (TST-012) are non-negotiable — they are the four places where a defect is either irreversible for a user or silently wrong.
- **Coverage:** every exported function in `src/domain/` carries at least one test. No coverage percentage is imposed; the TST table is the obligation.
- **Risk-specific:** no test may write to a real IndexedDB outside `fake-indexeddb`; no domain test may read the system clock — dates and instants are injected.
- **Manual QA:** AC-080, AC-081 and AC-082 are performed in the browser and recorded in `verification.md`, because no E2E layer exists (ASM-5).

## 13. Explicit Assumptions

| Assumption | Provenance | Stop If False |
|---|---|---|
| Dependency versions per audit ASM-1, re-checked at install time | Audit ASM-1 | A version moved — re-pin, do not guess |
| Peer ranges are mutually satisfiable per audit ASM-2 | Audit ASM-2 | Install reports a peer conflict — resolve before writing code |
| `yaml@2` is the parser feeding Zod | Audit ASM-3 | A different parser is mandated |
| `vite-plugin-pwa` is not needed to prove a §47 flow | Audit ASM-4 | A manifest or service worker turns out to be required |
| Domain unit tests plus `fake-indexeddb` repository tests are sufficient assurance, with the two flows checked manually | Audit ASM-5 | Verification demands automated browser coverage |
| RIR is bounded 0–10 for the semantic check; the PRD says "fuera del rango permitido" without naming it | §11.1; spec author | A different range is specified |
| `weightKg` rounds to 3 decimals | Audit ASM-7 | Comparison instability appears in tests |
| Implementation branches off `master` before any write | Audit ASM-9 | — |

## 14. Implementation Stop Conditions

Implementation must stop and report rather than invent behavior if:

- repository evidence contradicts a frozen requirement or a DEC-* above;
- a requirement needs a file, flow or contract that does not exist and is not created by this spec;
- satisfying a requirement would require excluded scope — in particular any wizard, calendar, timer, backup or PWA behavior;
- a Dexie table or index is needed beyond REQ-070 and REQ-072, since the schema is effectively irreversible;
- the routine file format needs a field not present in §12, since the format is user-facing;
- a CONTEXT.md term would have to be renamed or a new one coined without recording it;
- an AGENTS.MD invariant cannot be satisfied as written;
- unrelated user changes appear in the working tree overlapping the required write set.
