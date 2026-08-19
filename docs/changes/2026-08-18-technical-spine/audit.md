# TrainLog Technical Spine — Audit

Status: Ready for specification
Size: large
Reliability: critical

## Baseline

| Field | Value |
|---|---|
| Repository root | `C:\Users\Josue Escobar\Documents\projects\mine\TrainLog` |
| Branch | `master` |
| Commit SHA | `da7a3daa52999e9fbc76110097d9e9460b74ca35` |
| Working tree | Clean (`git status --porcelain` empty) |
| Relevant pre-existing changes | None |
| Audit date | 2026-08-18 |

Toolchain observed on this machine: Node `v24.14.0`, npm `11.9.0`, pnpm `11.5.0`. No `.gitignore` exists.

## Desired Outcome and Constraints

- **Outcome:** the two core flows of PRD §47 run end to end against a real IndexedDB: `routine.yaml → parse → validate → domain objects → Dexie → Placements → query`, and `PlannedExercise → start Session → snapshot targets → ExerciseSession → CompletedSet → Dexie → history → derived progression`.
- **Included:** project bootstrap and tooling; `src/domain` (types, YAML schema + parse, structural and semantic validation, exercise resolution, placement generation, target snapshot, unit conversion, next-in-rotation, missed derivation, progression engine); `src/db` (Dexie schema v1 + repositories); bundled exercise catalog; a minimal harness UI that exercises the flows; domain unit tests and repository tests against `fake-indexeddb`.
- **Excluded:** import wizard UI, calendar UI, Today screen, gym-mode execution screen, rest timer UI/behaviour, backup/restore/CSV, PWA offline hardening and service worker, Progress dashboard, any charting library.

## Current Behavior Trace

There is no current behavior to trace. The repository contains documentation and design assets only:

1. `docs/PRD.md` — 2761 lines, the product specification; sections cited as `§n`.
2. `AGENTS.MD` — binding layering, stack, invariants, validation tiers, test policy.
3. `CONTEXT.md` — binding glossary; identifier names, not just prose.
4. `docs/adr/0001-dateless-workouts-with-user-owned-placements.md`, `docs/adr/0002-snapshot-planned-targets-on-session-start.md` — the two load-bearing decisions.
5. `DESIGN.md` — 966 lines; frontmatter tokens plus the section "Implementation — Tailwind v4 & shadcn" (line 538) prescribing exact file locations.
6. `design/preview.html` (646 lines) and `design/fonts/*.woff2` (4 files) — the rendered design reference and the self-hosted font subsets.
7. `.claude/launch.json` — one entry, `design-preview`, serving `design/` on port 4713 via `npx http-server`. Not an app dev server.

Observable current result: no `package.json`, no `src/`, no lockfile, no build. Nothing executes.

## Relevant Surface

| Path / Area | Role | Evidence | Confidence |
|---|---|---|---|
| `docs/PRD.md` §12, §26 | YAML routine format, field semantics, exercise resolution order | Read in full | High |
| `docs/PRD.md` §14.1–14.9 | The nine entities and their fields — the domain type set | Read in full | High |
| `docs/PRD.md` §11.1 | Two validation tiers and the exact semantic checks | Read in full | High |
| `docs/PRD.md` §29 | `double_progression` rule, including the first-N-sets rule | Read in full | High |
| `docs/PRD.md` §24, §35, §36 | ID policy, session recovery, session states | Read in full | High |
| `AGENTS.MD` | Layering, stack, invariants, test policy, English identifiers | Read in full | High |
| `CONTEXT.md` | Binding vocabulary for every domain identifier | Read in full | High |
| `DESIGN.md:538-600` | Prescribed file layout: `src/styles/theme.css`, `src/lib/utils.ts`, `src/components/ui/`, `src/assets/fonts/` | Read | High |
| `design/fonts/*.woff2` | The four font subsets to copy into `src/assets/fonts/` when styling lands | `ls` | High |
| `.claude/launch.json` | Shared config; gains an app entry, keeps `design-preview` | Read in full | High |
| `public/` | Exists, empty. Vite's static directory | `find` | High |

## Actual Problem / Change Location

Greenfield. The whole change is new files under a new `src/` tree plus root tooling. The only pre-existing file this change modifies is `.claude/launch.json` (append one configuration). `docs/`, `DESIGN.md`, `CONTEXT.md`, `AGENTS.MD`, `design/` and `README.MD` are read-only inputs, except that `CONTEXT.md` must be extended if a new term is settled during the work (AGENTS.MD, "Vocabulary is binding").

## Contracts and Boundaries

| Contract / Boundary | Current Shape | Consumers | Change Risk |
|---|---|---|---|
| Domain entity types (§14.1–14.9) | Prose only, not yet code | Everything: db, features, tests, all follow-on changes | High — must be frozen before parallel work |
| YAML routine format v1 (§12) | Prose + one example | Parser, Zod schema, semantic validator, user-authored files | High — user-facing file format; `version: 1` is the compatibility handle |
| Dexie schema v1 (table names, indexes) | Does not exist | Every repository, and every future migration | High — irreversible once a user has data; only forward migration is possible |
| Repository surface (`src/db`) | Does not exist | All feature hooks in follow-on changes | High — the seam AGENTS.MD draws at `features → db` |
| Layering `features → db → domain` | AGENTS.MD, binding | All code | Medium — enforceable by lint rule |
| Exercise catalog ids (slugs) | Does not exist; §11.12 names `front-squat`, `weighted-pull-up`, `romanian-deadlift` | User YAML files via `exercise_id`; all history rows | High — an id change orphans history (§26) |
| Backup JSON shape (§17) | Prose | Out of scope here, but the table set defined now determines it | Medium |
| `.claude/launch.json` | One entry | Local dev only | Low |

Invariants this change must not break (AGENTS.MD "Invariants"): no runtime network requests; planned targets snapshotted at exercise start; progression derived and never stored, keyed by `exerciseId`; `Placement` and `Session` mutually unreferencing; weight stored with unit plus derived `weightKg`; routines immutable after accept; generated IDs, never names.

## Tests and Validation

No test infrastructure exists. Everything below is to be created by this change.

| Test / Command | Covers | Gap | Prerequisite |
|---|---|---|---|
| `test` (Vitest, node env) | Domain functions: parse, structural + semantic validation, exercise resolution, placement generation, snapshot, unit conversion, rotation, missed derivation, progression | Everything — none exist | Vitest installed |
| Repository tests under `fake-indexeddb` | Dexie schema, write/read round-trips, delete-routine refusal while Sessions exist (§37), in-progress session recovery (§35) | Everything | `fake-indexeddb` installed |
| `typecheck` (`tsc --noEmit`) | Type integrity across layers | None exist | TypeScript installed |
| `lint` | Layering rule: `domain/` imports no Dexie and no React | Not decided — see DEC-4 | ESLint config |
| `build` | Production build succeeds | None exist | Vite configured |
| Manual run of the harness UI | The two §47 flows against real IndexedDB in a browser | None exist | Dev server entry in `.claude/launch.json` |

`critical` reliability, with no E2E layer, means the domain suite is the assurance. Every §11.1 semantic check and the §29 first-N-sets rule each need a named test.

## Candidate Ownership

| Workstream | May Read | Candidate Write Set | Coupling / Conflict Risk |
|---|---|---|---|
| W0 — Bootstrap (gate) | all docs | `package.json`, lockfile, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `.gitignore`, `eslint.config.js`, `.claude/launch.json` | Gate for everything. Single writer. |
| W1 — Domain contracts (gate) | §14, CONTEXT.md | `src/domain/types.ts`, `src/domain/ids.ts`, `src/domain/units.ts` | Gate. Frozen before W2–W5 start. |
| W2 — YAML pipeline | §11.1, §12, §26 | `src/domain/routine-file/*` (schema, parse, semantic validation, resolution, to-domain) | Reads W1 only |
| W3 — Scheduling | §11.3, §11.4, ADR 0001 | `src/domain/scheduling/*` (placement generation, rotation, missed derivation) | Reads W1 only |
| W4 — Session + progression | §11.5, §11.7, §29, ADR 0002 | `src/domain/session/*`, `src/domain/progression/*` | Reads W1 only |
| W5 — Catalog | §11.12, §26 | `src/domain/catalog/*` including the authored data file | Reads W1; W2 resolution depends on its loader signature |
| W6 — Persistence | §14, §34, §35, §37 | `src/db/*` (Dexie schema, repositories) | Depends on W1 frozen; single writer for the schema |
| W7 — Harness UI | §47 | `src/main.tsx`, `src/App.tsx`, `src/features/**` | Depends on the W6 surface |

Write sets are plausibly disjoint after W0 and W1 are frozen, but W0/W1 are strict gates and `package.json` plus the lockfile are single-writer throughout. Sequential execution is the safe default; parallelism is only defensible for W2/W3/W4/W5 after the W1 freeze.

## Integration and Generated-File Hotspots

| File / Area | Why Shared | Required Control |
|---|---|---|
| `package.json` | Every workstream may want a dependency or script | One owner; all dependencies declared in W0 |
| Lockfile (`pnpm-lock.yaml` or `package-lock.json`) | Regenerated by any install | One owner; single install pass, committed once |
| `src/domain/types.ts` | Read by every other workstream | Frozen at the end of W1; changes reopen the spec |
| `src/db/schema.ts` (Dexie version block) | Irreversible for users with data | Single writer; version 1 only in this change |
| `.claude/launch.json` | Pre-existing, user-owned `design-preview` entry | Append only; never rewrite the file wholesale |
| `tsconfig*.json`, `vite.config.ts` | Path aliases, plugins | W0 owner |
| `CONTEXT.md` | Binding glossary, extended when a term settles | Append only, in the same change |

## Supported Options

| Option | Evidence | Pros | Cons | Approval Status |
|---|---|---|---|---|
| Package manager: **pnpm** | `pnpm 11.5.0` installed locally; no lockfile exists to contradict either choice | Faster; strict `node_modules` catches undeclared imports | A second tool in the chain; CI must install it | Not approved |
| Package manager: **npm** | `npm 11.9.0` ships with Node | Zero extra tooling | Looser resolution | Not approved |
| ID: **`crypto.randomUUID()`** | §24 permits UUID or ULID; native in Node 24 and all PWA-capable browsers; the secure-context requirement is satisfied by localhost and HTTPS | Zero dependency, no custom code | Not time-sortable; ordering needs an explicit timestamp field | Not approved |
| ID: **ULID** | §24 permits it | Lexicographically time-sortable ids | A new dependency, or hand-rolled crypto — the latter is exactly what a `critical` profile should not hand-roll | Not approved |
| Styling now (Tailwind v4 + `src/styles/theme.css` + fonts, per `DESIGN.md:549`) | DESIGN.md prescribes the exact file layout; the tokens are already written out | Unblocks every follow-on UI change; a mechanical paste | Adds surface to a change whose UI is meant to be a harness | Not approved |
| Styling deferred to the first UI change | "Minimal UI only" is approved scope | Smallest diff; the harness needs no styling | The first UI change then carries a project-wide config task | Not approved |
| Layering enforced by **ESLint** (`no-restricted-imports`) | AGENTS.MD states the rule; no enforcement exists | Machine-checked invariant; cheap | ESLint config is surface not named in the AGENTS.MD stack | Not approved |
| Layering enforced by **review plus a test** | — | No new tooling | A human check, easy to erode | Not approved |

## Material Decisions — Resolved

Decided by the change owner on 2026-08-18. The spec author must treat these as frozen.

| ID | Decision | Resolution | Consequence |
|---|---|---|---|
| DEC-1 | Package manager and lockfile | **pnpm** | `pnpm-lock.yaml` is committed; every command in `spec.md` and `verification.md` is a `pnpm` command; strict `node_modules` surfaces undeclared imports |
| DEC-2 | ID generation strategy | **`crypto.randomUUID()`** | No dependency; ordering comes from the explicit timestamp fields the model already carries (`createdAt`, `startedAt`, `completedAt`, `completedAt` on sets) |
| DEC-3 | Tailwind v4 + `theme.css` + fonts in this change | **Include now** | `src/styles/theme.css`, `src/assets/fonts/*.woff2` (copied from `design/fonts/`), `src/lib/utils.ts` (`cn()`) join the write set; `tailwindcss`, `@tailwindcss/vite`, `clsx`, `tailwind-merge` join the dependency set. shadcn components are still out of scope |
| DEC-4 | Enforce layering with ESLint | **Yes** — `no-restricted-imports` blocking `dexie`/`react` inside `src/domain/**` and `react` inside `src/db/**` | `eslint.config.js` and a `pnpm lint` script are in the W0 write set |
| DEC-5 | Bleeding-edge toolchain | **Take latest across the board**, versions per ASM-1 | Peer ranges verified compatible (ASM-2); typecheck runs in W0 before any domain code is written, so a TypeScript 7 incompatibility surfaces at the cheapest point |

## Assumptions

| ID | Assumption | Validation | Stop If False |
|---|---|---|---|
| ASM-1 | Dependency versions verified live against the npm registry on 2026-08-18: `vite@8.2.1`, `react@19.2.8`, `react-dom@19.2.8`, `typescript@7.0.2`, `dexie@4.4.5`, `dexie-react-hooks@4.4.0`, `zod@4.4.3`, `react-router@8.3.0`, `vitest@4.1.11`, `fake-indexeddb@6.2.5`, `yaml@2.9.0`, `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`, `lucide-react@1.32.0`, `@vitejs/plugin-react@6.0.5`, `@types/react@19.2.18`, `@types/node@26.2.0` | Re-run `npm view <pkg> version` at install time | A version has moved — re-pin, do not guess |
| ASM-2 | Peer ranges are mutually satisfiable: `vitest@4` accepts `vite ^6 ‖ ^7 ‖ ^8`; `@vitejs/plugin-react@6` requires `vite ^8`; `@tailwindcss/vite@4.3` accepts `vite ^5.2 ‖ ^6 ‖ ^7 ‖ ^8`; `react-router@8` requires `react >=19.2.7` and Node `>=22.22.0`; `dexie-react-hooks@4.4` requires `dexie >=4.2 <5`. Node `24.14.0` satisfies every engines field | Install reports no peer warnings | A peer conflict — resolve by pinning before writing code |
| ASM-3 | `yaml@2.9.0` is the parser, feeding Zod for structural validation. AGENTS.MD names Zod but no YAML library | The parser reads the §12 example and rejects malformed input in tests | A different parser is mandated |
| ASM-4 | `vite-plugin-pwa` is **not** installed in this change — it belongs to the excluded PWA workstream. It stays in the AGENTS.MD stack list for later | Confirm `spec.md` excludes it | A manifest or service worker turns out to be needed to prove a §47 flow |
| ASM-5 | No E2E layer. Assurance is domain unit tests plus repository tests on `fake-indexeddb`, with the two §47 flows exercised manually through the harness UI | The verification stage accepts this | `critical` demands automated browser coverage |
| ASM-6 | `.claude/launch.json` gains an app dev-server entry alongside the untouched `design-preview` entry | The file after the change still contains both | — |
| ASM-7 | lb→kg conversion uses the exact factor `0.45359237`; `weightKg` is stored rounded to a fixed precision so equality comparisons stay stable. That precision is not specified anywhere in the PRD | Named in `spec.md`, covered by a unit test | — |
| ASM-8 | The authored starter catalog carries `id` (slug), `name`, `category`, `equipment` per §14.1, and must include the three ids §11.12 names verbatim: `front-squat`, `weighted-pull-up`, `romanian-deadlift` | A test asserts those three ids resolve | — |
| ASM-9 | Implementation branches off `master` before writing; `master` is the default branch and is currently clean | `git branch` before the first write | — |

## Contradictions and Risks

- **§11.11 vs §38.** §11.11 lists load/reps/volume/best-sets as MVP; §38's MVP list omits charts and §46 places them at step 22. Resolved by the approved decision: out of scope.
- **`ProgressionRule` (§14.5) as a table versus a field.** §14.5 models it as an entity with `plannedExerciseId`, but §12's YAML nests `progression` inside each exercise and it is always 1:1 with a `PlannedExercise`. A separate table follows the letter of §14.5; embedding follows the data. `spec.md` must state which, because the Dexie schema is effectively irreversible.
- **Catalog exercises and user exercises share one table.** §17 exports only user-created exercises, so an Exercise row must carry a provenance flag, or the catalog must live outside the table. The backup change depends on this, so the flag must exist in schema v1.
- **`weeks` → placement count.** §12 says `weeks` determines how many `Placements` are generated, but the anchor date for week 1 is nowhere specified (§12 explicitly removes `start_date`). Wizard step 2 supplies it. Since the wizard UI is excluded here, placement generation must take the anchor date as an explicit parameter.
- **`Session.status = partial`** (§36) has no defined transition rule — nothing states when a finished session is `completed` rather than `partial`. This matters because only `completed` sessions feed progression (AGENTS.MD). `spec.md` must define the rule.
- **Two `Placements` may share a date** (§14.9) while the import wizard forbids two Workouts sharing a `suggested_day` (§12). Both are true, at different times; placement generation must not enforce the wizard's rule.
- **Bleeding-edge toolchain** — see DEC-5.
- **TypeScript 7** is the native compiler; `tsc --noEmit` behaviour and third-party type-declaration compatibility are the risk surface. Mitigated by running typecheck in W0, before any domain code is written.

## Do Not Touch

- `docs/PRD.md`, `docs/adr/*`, `PRODUCT.md`, `README.MD`, `DESIGN.md` — read-only inputs to this change.
- `design/preview.html` and `design/fonts/*.woff2` — the design reference. Fonts are **copied** into `src/assets/fonts/`, never moved.
- The `design-preview` entry in `.claude/launch.json`.
- `CONTEXT.md` — append-only, and only when a new term is genuinely settled.
- `master` — branch before implementing.

## Recommended Next Step

Write `spec.md`. All five material decisions are resolved above. The spec must additionally resolve the four items flagged in "Contradictions and Risks" as "`spec.md` must state": the `ProgressionRule` shape, catalog/user exercise provenance, the placement anchor date, and the `partial` versus `completed` transition. These are modelling calls the spec author can make from PRD evidence — they are not stakeholder decisions.
