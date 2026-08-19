# TrainLog Technical Spine — Implementation Plan

Status: Ready
Size: large
Reliability: critical
Base: `master@da7a3daa52999e9fbc76110097d9e9460b74ca35`

## Preflight Baseline

- **Working tree:** clean apart from `docs/changes/` (this change's own artifacts, untracked). Baseline re-verified at planning time and unchanged since the audit.
- **Spec:** `docs/changes/2026-08-18-technical-spine/spec.md` — `Ready for planning`.
- **Audit:** `docs/changes/2026-08-18-technical-spine/audit.md` — `Ready for specification`.
- **Required commands/tools:** `pnpm` 11.5.0, Node 24.14.0, `git`. All present on the machine. Post-bootstrap: `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm dev`.
- **Relevant overlaps:** none. Every file in the write set is new except `.claude/launch.json`, which is append-only.
- **Branch:** implementation branches off `master` before the first write (ASM-9). All work lands on that branch; `master` is not written to.

## Dependency Graph

### True Dependencies

| ID | Dependency | Why It Must Precede | Unlocks |
|---|---|---|---|
| D-001 | Bootstrap (`package.json`, lockfile, tsconfig, vite/vitest/eslint config) | Nothing compiles, type-checks or runs before it; every later check command is defined here | Everything |
| D-002 | Domain types, ids, units, dates (`src/domain/types.ts`, `ids.ts`, `units.ts`, `dates.ts`) | Every other module imports these types; changing them later invalidates written code and tests | WS-2 … WS-9 |
| D-003 | Catalog loader signature | Exercise resolution (REQ-022) calls it | WS-3 |
| D-004 | Domain mapping output (`routineFileToDomain`) | The import repository persists exactly those objects | WS-5 |
| D-005 | Placement generation | The import transaction writes generated Placements atomically with the Routine (REQ-074) | WS-5 |
| D-006 | Dexie schema v1 (`src/db/schema.ts`) | Every repository, in both waves, opens tables declared there | WS-5, WS-7 |
| D-007 | Snapshot and session-status domain functions | Session repositories persist their output | WS-7 |
| D-008 | Repository surface (`src/db/`) | The harness UI calls repositories, never Dexie directly (REQ-073) | WS-9 |
| D-009 | `theme.css` and `cn()` | The harness UI must not introduce style literals (REQ-083) | WS-9 |

### Artificial Dependencies Removable by Gate 0

| ID | Coupling | Frozen Artifact | Unlocks |
|---|---|---|---|
| A-001 | WS-3, WS-4, WS-6 each wait on entity shapes discovered while writing their own module | `src/domain/types.ts`, frozen in Gate 0 with every §14 entity and `ProgressionRule` per DEC-006 | Wave 1 and Wave 2 workstreams start against a fixed contract |
| A-002 | WS-3's resolution waits on WS-2's catalog data being authored | The catalog *loader interface* (`getCatalogExercise(id)`, `findCatalogExerciseByNormalizedName(name)`) is declared in Gate 0; the data file lands in Wave 1 | WS-3 proceeds against the interface, not the data |
| A-003 | Repositories wait on domain functions being finished | Not removable — D-004, D-005, D-007 are real data dependencies, not signature guesses | — |

## Execution Strategy

**Topology: Sequential (single writer).**

Reason: two hard gates (D-001, D-002) dominate the critical path, and the parallelizable window — four small pure-TypeScript modules in Wave 1 — is not worth the coordination cost. More decisively, the `critical` profile makes `src/db/schema.ts` a file where a merge artifact is unrecoverable for any user who later stores data, and `pnpm-lock.yaml` regenerates on any install. One writer owning both removes the entire class of problem. Worktree isolation would additionally require a separate `pnpm install` per worktree for modules that share one type contract and one test runner, which buys nothing here.

Wave 1's four workstreams do have provably disjoint write sets (four distinct directories plus their own tests), so they may be *reordered* freely within the wave. They are not to be written concurrently.

## Gate 0

Required: **Yes**

Goal: materialize the bootstrap and the frozen type contract, so that every downstream workstream compiles, tests and lints against fixed shapes. Gate 0 writes no product behavior beyond what the spec already froze.

| Artifact | Frozen Shape | Requirement IDs | Owner | May Edit | Check |
|---|---|---|---|---|---|
| Project bootstrap | pnpm project, ASM-1 versions exactly, scripts `dev`/`build`/`preview`/`test`/`typecheck`/`lint` | REQ-001, REQ-002, REQ-003, REQ-006 | WS-0 | `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `.gitignore` | `pnpm install` clean, `pnpm typecheck`, `pnpm build` |
| Layering lint rule | `no-restricted-imports`: `dexie`/`dexie-react-hooks`/`react`/`react-dom` forbidden in `src/domain/**`; `react`/`react-dom` forbidden in `src/db/**` | REQ-004 | WS-0 | `eslint.config.js` | `pnpm lint` passes clean and fails on a deliberate violating fixture |
| Dev-server entry | One appended configuration; `design-preview` untouched | REQ-005 | WS-0 | `.claude/launch.json` | `git diff` shows an addition only |
| Domain type contract | Every §14 entity under CONTEXT.md names; `ProgressionRule` embedded as a discriminated union (DEC-006); `ExerciseSession.status` ∈ `pending`/`performed`/`skipped` (DEC-009) | REQ-010 | WS-1 | `src/domain/types.ts` | `pnpm typecheck` |
| Id generation | `newId()` over `crypto.randomUUID()` | REQ-011 | WS-1 | `src/domain/ids.ts` | `pnpm test` |
| Unit conversion | `toKg(weight, unit)`, factor `0.45359237`, 3-decimal rounding | REQ-012 | WS-1 | `src/domain/units.ts`, `units.test.ts` | TST-005 |
| Date representation | `YYYY-MM-DD` local-date helpers; instants as epoch ms; no ambient clock reads | REQ-013 | WS-1 | `src/domain/dates.ts`, `dates.test.ts` | TST-006 support |
| Catalog loader interface | `getCatalogExercise(id)`, `findCatalogExerciseByNormalizedName(name)` — signatures only, data lands in Wave 1 | A-002 | WS-1 | `src/domain/catalog/index.ts` | `pnpm typecheck` |

Stop if:

- materialization would require a new design decision — in particular, if a §14 field cannot be typed without inventing semantics the spec does not state;
- `pnpm install` reports a peer conflict (spec §13, audit ASM-2) — stop and re-pin rather than loosening a version;
- TypeScript 7 rejects a configuration the spec requires (`strict`, `noUncheckedIndexedAccess`).

## Ownership Map

| Workstream | Mode | REQ IDs | May Read | May Edit | Integration-Reserved | Must Not Edit | Depends On |
|---|---|---|---|---|---|---|---|
| WS-0 Bootstrap | write | REQ-001…006 | all docs | root config files, `.claude/launch.json`, `.gitignore` | `package.json`, `pnpm-lock.yaml` | `src/**`, `docs/**`, `DESIGN.md`, `design/**` | — |
| WS-1 Contracts | write | REQ-010…013 | spec §3, §14, CONTEXT.md | `src/domain/types.ts`, `ids.ts`, `units.ts`, `dates.ts`, `catalog/index.ts`, their tests | — | everything else | WS-0 |
| WS-2 Catalog | write | REQ-020, REQ-021, REQ-023 | §11.12, §26 | `src/domain/catalog/**` | — | `src/domain/types.ts` | Gate 0 |
| WS-3 YAML pipeline | write | REQ-022, REQ-030…034 | §11.1, §12, §26 | `src/domain/routine-file/**` | — | `src/domain/types.ts`, other domain dirs | Gate 0, WS-2 |
| WS-4 Scheduling | write | REQ-040…044 | §11.3, §11.4, ADR 0001 | `src/domain/scheduling/**` | — | `src/domain/types.ts`, other domain dirs | Gate 0 |
| WS-5 Persistence core | write | REQ-070…077 | §14, §17, §34, §37 | `src/db/database.ts`, `src/db/schema.ts`, `src/db/repositories/{routines,workouts,plannedExercises,placements,exercises,settings}.ts`, their tests | `src/db/schema.ts` | `src/domain/**` | WS-1, WS-3, WS-4 |
| WS-6 Session + progression | write | REQ-050…058, REQ-060…066 | §11.5, §11.7, §11.9, §29, §36, ADR 0002 | `src/domain/session/**`, `src/domain/progression/**` | — | `src/domain/types.ts`, `src/db/**` | Gate 0 |
| WS-7 Session persistence | write | (serves REQ-054, REQ-058, REQ-061) | §14.6–14.8, §35 | `src/db/repositories/{sessions,exerciseSessions,completedSets,history}.ts`, their tests | `src/db/schema.ts` (read-only) | `src/db/schema.ts`, `src/domain/**` | WS-5, WS-6 |
| WS-8 Styling foundation | write | REQ-082, REQ-083 | `DESIGN.md:538-600`, `design/preview.html` | `src/styles/theme.css`, `src/assets/fonts/**`, `src/lib/utils.ts` | — | `design/**`, `DESIGN.md` | WS-0 |
| WS-9 Harness UI | write | REQ-080, REQ-081 | spec §1, all of `src/db` and `src/domain` | `src/main.tsx`, `src/App.tsx`, `src/features/**` | — | `src/domain/**`, `src/db/**`, `src/styles/theme.css` | WS-5, WS-7, WS-8 |
| INT Integration | integration | — | everything | integration-reserved files, `CONTEXT.md` | — | — | per wave |

`CONTEXT.md` is integration-owned and append-only: a workstream that settles a new term reports it, and the integration gate writes it.

## Generated / Migration / Project / Lockfile Ownership

| File / Pattern | Owner | When It May Change | Validation |
|---|---|---|---|
| `pnpm-lock.yaml` | WS-0 only | Gate 0 install only. Any later dependency need is a stop condition, not an install | `git diff` shows no lockfile change after Gate 0; `pnpm install --frozen-lockfile` succeeds |
| `package.json` | WS-0 only | Gate 0 only | Dependency list matches ASM-1 exactly (AC-002) |
| `src/db/schema.ts` (Dexie version 1) | WS-5 only | Wave 1 only. WS-7 reads it and must not add a table or index | AC-071, AC-073; effectively irreversible per spec §8 |
| `dist/`, `node_modules/`, Vite and Vitest caches | Nobody | Never committed | `.gitignore` covers them (AC-006) |
| `.claude/launch.json` | WS-0 only | Gate 0 only, append-only | AC-005 — `design-preview` byte-for-byte unchanged |
| `src/assets/fonts/*.woff2` | WS-8 only | Wave 3. Copied from `design/fonts/`, originals untouched | AC-084 |
| `CONTEXT.md` | INT only | Any wave, append-only, only for a genuinely settled term | Reviewed at the integration gate |

## Wave 1 — A routine file becomes stored domain data

Goal: PRD §47 flow 1 is provable — `routine.yaml → parse → validate → domain objects → Dexie → Placements → query`.

- Requirements: REQ-020…023, REQ-030…034, REQ-040…044, REQ-070…077
- Acceptance: AC-020…025, AC-030…035, AC-040…045, AC-071…079

### Workstream WS-2 — Exercise catalog

- Assigned requirements: REQ-020, REQ-021, REQ-023
- May read: PRD §11.12, §26; `src/domain/types.ts`
- May edit: `src/domain/catalog/**`
- Must not edit: `src/domain/types.ts`, any other domain directory
- Steps:
  1. Write TST-023 first — asserts 60–100 entries, unique kebab-case ids, and the three §11.12 ids present.
  2. Author the catalog data module: 60–100 lifts with `id`, `name`, `category`, `equipment`, statically imported, no fetch.
  3. Implement the loader behind the Gate 0 interface, including name normalization (trim, lowercase, collapse inner whitespace).
- Checks: TST-023; `pnpm typecheck`; `pnpm lint`
- Evidence: passing TST-023 output; the entry count
- Stop conditions: a required category or equipment value cannot be assigned without inventing a taxonomy the PRD does not define — record the taxonomy used and continue only if it is internal to the catalog module

### Workstream WS-3 — YAML pipeline

- Assigned requirements: REQ-022, REQ-030…034
- May read: PRD §11.1, §12, §26; `src/domain/types.ts`; the catalog interface
- May edit: `src/domain/routine-file/**`
- Must not edit: `src/domain/types.ts`, `src/domain/catalog/**`
- Steps:
  1. Write TST-002 and TST-003 first — one case per structural class and one per semantic check, each asserting the error path.
  2. Implement the Zod schema for `version: 1` and `parseRoutineFile` over `yaml@2`; structural failure yields errors and no partial result.
  3. Implement `validateRoutineFile` returning semantic issues with machine-readable field paths, never rejecting.
  4. Implement exercise resolution per §26 (TST-004) and `routineFileToDomain` assigning ids and `order` (TST-001).
- Checks: TST-001…004; `pnpm typecheck`; `pnpm lint`
- Evidence: the §12 example parsing to the expected objects; the semantic-issue list for a deliberately broken file
- Stop conditions: the routine format needs a field absent from §12; the RIR range assumption (0–10, spec §13) proves wrong

### Workstream WS-4 — Scheduling

- Assigned requirements: REQ-040…044
- May read: PRD §11.3, §11.4, ADR 0001; `src/domain/types.ts`, `dates.ts`
- May edit: `src/domain/scheduling/**`
- Must not edit: `src/domain/types.ts`, other domain directories
- Steps:
  1. Write TST-006, TST-007 first with a fixed anchor date and an asserted date list.
  2. Implement `generatePlacements` per DEC-008 — required `anchorDate`, week 1 from the anchor's Monday, pre-anchor dates omitted, no clock read, no one-workout-per-day enforcement.
  3. Implement `nextWorkoutInRotation` (TST-008) and `isMissed` (TST-009), the latter asserting nothing is written.
- Checks: TST-006…009; `pnpm typecheck`; `pnpm lint`
- Evidence: the generated date list for `weeks: 4` with two suggested days
- Stop conditions: a placement rule would require reading the current date inside a domain function

### Workstream WS-5 — Persistence core

- Assigned requirements: REQ-070…077
- May read: PRD §14, §17, §34, §37; all of `src/domain/`
- May edit: `src/db/database.ts`, `src/db/schema.ts`, `src/db/repositories/{routines,workouts,plannedExercises,placements,exercises,settings}.ts` and their tests
- Integration-reserved: `src/db/schema.ts` — sole writer for the whole change
- Must not edit: `src/domain/**`
- Steps:
  1. Declare Dexie schema version 1 with exactly the nine tables of REQ-070 and the indexes of REQ-072, covering both waves' queries so WS-7 never needs to touch it.
  2. Write TST-017 per table, and TST-022 asserting no catalog Exercise reaches the `exercises` table.
  3. Implement the import repository as one transaction over Routine + Workouts + PlannedExercises + new user Exercises + Placements (REQ-074), with TST-018 injecting a mid-write failure.
  4. Implement activate (TST-020), archive, and the delete refusal while Sessions exist (TST-019), plus the settings repository.
- Checks: TST-017…020, TST-022; `pnpm typecheck`; `pnpm lint`
- Evidence: the table list reported by the opened database; the failure-injection test output showing zero residue
- Stop conditions: a query needs a table or index beyond REQ-070/REQ-072 — the schema is irreversible, so this stops rather than expands

### Wave 1 Integration Gate

- Owner: INT
- May edit: integration-reserved files, `CONTEXT.md`
- Must inspect: the actual combined diff for the wave; ownership compliance (no workstream wrote outside its paths; `schema.ts` has one author; the lockfile is unchanged since Gate 0); contract consistency (`types.ts` untouched since the freeze)
- Checks: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`
- Completion criteria: REQ-020…023, REQ-030…034, REQ-040…044, REQ-070…077 implemented; AC-020…025, AC-030…035, AC-040…045, AC-071…079 demonstrable; TST-001…009, TST-017…020, TST-022, TST-023 passing
- Stop conditions: `types.ts` changed during the wave — the freeze broke, and every dependent module needs re-checking before Wave 2

## Wave 2 — A session becomes history and a suggestion

Goal: PRD §47 flow 2 is provable — `PlannedExercise → Session → snapshot → ExerciseSession → CompletedSet → Dexie → history → derived progression`.

- Requirements: REQ-050…058, REQ-060…066
- Acceptance: AC-050…070

### Workstream WS-6 — Session and progression domain

- Assigned requirements: REQ-050…058, REQ-060…066
- May read: PRD §11.5, §11.7, §11.9, §29, §36, ADR 0002; `src/domain/types.ts`
- May edit: `src/domain/session/**`, `src/domain/progression/**`
- Must not edit: `src/domain/types.ts`, `src/db/**`
- Steps:
  1. Write TST-010 first — the ADR 0002 regression: snapshot copies every planned field, and mutating the PlannedExercise afterwards leaves the ExerciseSession unchanged.
  2. Implement session start, exercise start with snapshot including the progression rule, unplanned exercise with null `plannedExerciseId`, and set construction with `weightKg`.
  3. Implement `ExerciseSession.status` transitions and Session status derivation per DEC-009 (TST-011, including the skipped-exercise case yielding `completed`).
  4. Write TST-012 (the four §29 cases), then implement `double_progression` on the first N sets, plus `manual` (TST-015) and the no-suggestion cases (TST-016).
  5. Implement history-keyed-by-`exerciseId` (TST-014) and the `completed`-only filter (TST-013).
- Checks: TST-010…016; `pnpm typecheck`; `pnpm lint`
- Evidence: the four §29 progression cases with their inputs and outputs; the snapshot regression output
- Stop conditions: a progression rule needs history the schema does not record; the `partial`/`completed` rule cannot be applied from `ExerciseSession.status` alone

### Workstream WS-7 — Session persistence

- Assigned requirements: serves REQ-054, REQ-058, REQ-061
- May read: `src/db/schema.ts`, all of `src/domain/`
- May edit: `src/db/repositories/{sessions,exerciseSessions,completedSets,history}.ts` and their tests
- Must not edit: `src/db/schema.ts`, `src/domain/**`
- Steps:
  1. Implement set logging that persists at the moment of logging, not at session end (AC-056).
  2. Implement in-progress session recovery from a fresh database handle (TST-021).
  3. Implement the history query by `exerciseId` that feeds the progression engine.
- Checks: TST-021; the repository half of TST-013, TST-014; `pnpm typecheck`; `pnpm lint`
- Evidence: the recovery test output showing every set intact after a simulated reload
- Stop conditions: recovery needs an index `schema.ts` does not declare — report to INT rather than editing the schema

### Wave 2 Integration Gate

- Owner: INT
- May edit: integration-reserved files, `CONTEXT.md`
- Must inspect: combined diff; that `schema.ts` is unchanged since Wave 1; that no domain module imports Dexie
- Checks: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`
- Completion criteria: REQ-050…058, REQ-060…066 implemented; AC-050…070 demonstrable; TST-010…016, TST-021 passing
- Stop conditions: `schema.ts` changed in Wave 2; a progression path reads `plannedExerciseId`

## Wave 3 — Both flows run in a browser

Goal: the spine is observable end to end in a real browser against real IndexedDB, with no network request.

- Requirements: REQ-080…083
- Acceptance: AC-080…085

### Workstream WS-8 — Styling foundation

- Assigned requirements: REQ-082, REQ-083
- May read: `DESIGN.md:538-600`, `design/preview.html`, `design/fonts/`
- May edit: `src/styles/theme.css`, `src/assets/fonts/**`, `src/lib/utils.ts`
- Must not edit: `design/**`, `DESIGN.md`
- Steps:
  1. Copy the four woff2 files into `src/assets/fonts/`, leaving `design/fonts/` intact.
  2. Write `theme.css` at the prescribed path: `@font-face` blocks with the `font-stretch` ranges, one `@theme` block carrying the DESIGN.md tokens, the `@utility` type scale.
  3. Add `cn()` over `clsx` + `tailwind-merge`.
- Checks: `pnpm build` succeeds; AC-083, AC-084
- Evidence: the built CSS containing the tokens; `design/fonts/` still present
- Stop conditions: a DESIGN.md token has no valid Tailwind v4 representation — record it rather than inventing a substitute

### Workstream WS-9 — Harness UI

- Assigned requirements: REQ-080, REQ-081
- May read: everything under `src/`
- May edit: `src/main.tsx`, `src/App.tsx`, `src/features/**`
- Must not edit: `src/domain/**`, `src/db/**`, `src/styles/theme.css`
- Steps:
  1. Build a single-route harness: file input → parse and validation results → accept → generated Placements listed.
  2. Add: start a Session from a Workout → log sets → finish → exercise history → derived suggestion.
  3. Verify in the browser with the dev-server entry from Gate 0; record the Network panel showing zero requests after load.
- Checks: AC-080, AC-081, AC-082 manually; `pnpm typecheck`; `pnpm lint`; `pnpm build`
- Evidence: screenshots or a recorded walkthrough of both flows, plus the Network panel
- Stop conditions: the harness would need wizard, calendar, Today-screen or timer behavior to demonstrate a flow — that is excluded scope

### Wave 3 Integration Gate

- Owner: INT
- May edit: integration-reserved files, `CONTEXT.md`
- Must inspect: full combined diff against `master@da7a3da`; that no style literal appears outside `theme.css` (AC-085); that `dexie` is imported only under `src/db/` (AC-074)
- Checks: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, plus the manual browser checks
- Completion criteria: every REQ owned, every AC demonstrable, every TST passing; `verification.md` inputs collected
- Stop conditions: a manual check fails and the fix would cross into excluded scope

## Single-Agent Fallback

The chosen topology is already sequential; this is the execution order.

1. Branch off `master`.
2. Gate 0 — WS-0 bootstrap, then WS-1 contracts. Freeze `types.ts`.
3. Wave 1 — WS-2 catalog → WS-3 YAML → WS-4 scheduling → WS-5 persistence core. Wave 1 integration gate.
4. Wave 2 — WS-6 session and progression domain → WS-7 session persistence. Wave 2 integration gate.
5. Wave 3 — WS-8 styling → WS-9 harness UI. Wave 3 integration gate.

Reason: WS-5 needs the mapping output (D-004) and placement generation (D-005), so it follows WS-3 and WS-4. WS-7 needs both the schema (D-006) and the session domain functions (D-007). WS-9 needs the repository surface (D-008) and the token foundation (D-009). WS-2 precedes WS-3 so resolution is tested against real catalog data rather than a stub.

## Requirement Execution Matrix

| Requirement | Wave / Gate | Implementation Owner | Integration Owner | Acceptance | Tests |
|---|---|---|---|---|---|
| REQ-001 | Gate 0 | WS-0 | INT | AC-001 | — |
| REQ-002 | Gate 0 | WS-0 | INT | AC-002 | — |
| REQ-003 | Gate 0 | WS-0 | INT | AC-003 | — |
| REQ-004 | Gate 0 | WS-0 | INT | AC-004 | TST-024 |
| REQ-005 | Gate 0 | WS-0 | INT | AC-005 | — |
| REQ-006 | Gate 0 | WS-0 | INT | AC-006 | — |
| REQ-010 | Gate 0 | WS-1 | INT | AC-010 | TST-001 |
| REQ-011 | Gate 0 | WS-1 | INT | AC-011, AC-012 | TST-017 |
| REQ-012 | Gate 0 | WS-1 | INT | AC-013 | TST-005 |
| REQ-013 | Gate 0 | WS-1 | INT | AC-014 | TST-006 |
| REQ-020 | Wave 1 | WS-2 | INT | AC-020 | TST-023 |
| REQ-021 | Wave 1 | WS-2 | INT | AC-021, AC-022 | TST-022 |
| REQ-022 | Wave 1 | WS-3 | INT | AC-023, AC-024, AC-025 | TST-004 |
| REQ-023 | Wave 1 | WS-2 | INT | AC-021 | TST-023 |
| REQ-030 | Wave 1 | WS-3 | INT | AC-030 | TST-001 |
| REQ-031 | Wave 1 | WS-3 | INT | AC-031 | TST-002 |
| REQ-032 | Wave 1 | WS-3 | INT | AC-032, AC-033 | TST-003 |
| REQ-033 | Wave 1 | WS-3 | INT | AC-034 | TST-001 |
| REQ-034 | Wave 1 | WS-3 | INT | AC-035 | TST-004 |
| REQ-040 | Wave 1 | WS-4 | INT | AC-040, AC-041 | TST-006 |
| REQ-041 | Wave 1 | WS-4 | INT | AC-042 | TST-006, TST-007 |
| REQ-042 | Wave 1 | WS-4 | INT | AC-043 | TST-007 |
| REQ-043 | Wave 1 | WS-4 | INT | AC-044 | TST-008 |
| REQ-044 | Wave 1 | WS-4 | INT | AC-045 | TST-009 |
| REQ-050 | Wave 2 | WS-6 | INT | AC-050, AC-051 | TST-017 |
| REQ-051 | Wave 2 | WS-6 | INT | AC-052, AC-053 | TST-010 |
| REQ-052 | Wave 2 | WS-6 | INT | AC-054 | TST-010 |
| REQ-053 | Wave 2 | WS-6 | INT | AC-053 | TST-010 |
| REQ-054 | Wave 2 | WS-6, WS-7 | INT | AC-055, AC-056 | TST-017 |
| REQ-055 | Wave 2 | WS-6 | INT | AC-057 | TST-011 |
| REQ-056 | Wave 2 | WS-6 | INT | AC-058 | TST-011 |
| REQ-057 | Wave 2 | WS-6 | INT | AC-059, AC-060 | TST-011 |
| REQ-058 | Wave 2 | WS-7 | INT | AC-061 | TST-021 |
| REQ-060 | Wave 2 | WS-6 | INT | AC-062 | TST-012 |
| REQ-061 | Wave 2 | WS-6, WS-7 | INT | AC-063 | TST-014 |
| REQ-062 | Wave 2 | WS-6 | INT | AC-064 | TST-013 |
| REQ-063 | Wave 2 | WS-6 | INT | AC-065 | TST-015 |
| REQ-064 | Wave 2 | WS-6 | INT | AC-066, AC-067, AC-068 | TST-012 |
| REQ-065 | Wave 2 | WS-6 | INT | AC-069 | TST-016 |
| REQ-066 | Wave 2 | WS-6 | INT | AC-070 | TST-005, TST-012 |
| REQ-070 | Wave 1 | WS-5 | INT | AC-071 | TST-017 |
| REQ-071 | Wave 1 | WS-5 | INT | AC-022, AC-072 | TST-022 |
| REQ-072 | Wave 1 | WS-5 | INT | AC-073 | TST-017 |
| REQ-073 | Gate 0 + Wave 1 | WS-0 (rule), WS-5 (compliance) | INT | AC-004, AC-074 | TST-024 |
| REQ-074 | Wave 1 | WS-5 | INT | AC-075 | TST-018 |
| REQ-075 | Wave 1 | WS-5 | INT | AC-076, AC-077 | TST-019 |
| REQ-076 | Wave 1 | WS-5 | INT | AC-078 | TST-020 |
| REQ-077 | Wave 1 | WS-5 | INT | AC-079 | TST-017 |
| REQ-080 | Wave 3 | WS-9 | INT | AC-080, AC-081 | manual |
| REQ-081 | Wave 3 | WS-9 | INT | AC-082 | manual |
| REQ-082 | Wave 3 | WS-8 | INT | AC-083, AC-084 | — |
| REQ-083 | Wave 3 | WS-8, WS-9 | INT | AC-085 | — |

## Final Verification

| Command / Check | Covers | Environment | Required Evidence |
|---|---|---|---|
| `pnpm install --frozen-lockfile` | REQ-001, REQ-006 | Clean clone, Node 24 | Install succeeds with no peer warning |
| `pnpm typecheck` | REQ-003 and all typed contracts | Local | Zero errors |
| `pnpm lint` | REQ-004, REQ-073 | Local | Clean, plus a demonstrated failure on a violating fixture |
| `pnpm test` | TST-001…024 | Node, `fake-indexeddb` | Full pass list, mapped to TST ids |
| `pnpm build` | REQ-001, REQ-082 | Local | Build succeeds; tokens present in output CSS |
| Browser walkthrough, flow 1 | AC-080 | Dev server via `.claude/launch.json` | Import accepted, Placements listed |
| Browser walkthrough, flow 2 | AC-081 | Dev server | Session logged and finished, history and suggestion shown |
| DevTools Network panel | AC-082 | Dev server | Zero requests after load during both flows |
| `git diff master -- .claude/launch.json` | AC-005 | Local | Addition only; `design-preview` unchanged |
| Manual grep for style literals outside `theme.css` | AC-085 | Local | No hex, radius, shadow or font-family literal found |

## Global Stop Conditions

- The frozen spec and the repository contradict each other.
- The base commit or a relevant path changed enough to stale this plan.
- Existing user work overlaps a required write set.
- A workstream needs to write outside its ownership — in particular, any writer other than WS-5 needing `src/db/schema.ts`, or any writer other than WS-0 needing `package.json` or the lockfile.
- A generated file, project file or lockfile changes without its owner.
- `src/domain/types.ts` changes after the Gate 0 freeze.
- A required decision is missing, or a DEC-* would have to be reinterpreted.
- A requirement would need excluded scope — wizard, calendar, Today screen, timer, backup, CSV or PWA behavior — to be satisfied.
- A Dexie table or index is needed beyond REQ-070 and REQ-072.
