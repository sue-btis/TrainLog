# TrainLog Technical Spine — Execution

Status: **Completed**

## Baseline

| Field | Value |
|---|---|
| Repository | `C:\Users\Josue Escobar\Documents\projects\mine\TrainLog` |
| Branch | `change/technical-spine` (created from `master`) |
| Planned base | `da7a3daa52999e9fbc76110097d9e9460b74ca35` |
| Current start commit | `da7a3daa52999e9fbc76110097d9e9460b74ca35` |
| Working tree before edits | Clean apart from untracked `docs/changes/` (this change's own artifacts) |
| Pre-existing relevant changes | None |

## Preflight Verdict

**Safe sequentially only**

The planned base and the current commit matched exactly; no `src/` existed, so nothing overlapped the write set. The only pre-existing file in scope was `.claude/launch.json`, which is append-only. Sequential-only because `package.json`, `pnpm-lock.yaml` and `src/db/schema.ts` are single-writer files under a `critical` profile.

## Execution Topology

**Sequential.** One subagent per workstream, dispatched in plan order, never two writers concurrently. The operator asked for subagents; the plan's single-writer constraints were preserved by serializing them rather than switching to worktrees. Nine writer agents ran; every integration gate was executed by the coordinator against the actual tree, not against agent summaries.

## Executed Work

| Workstream / Task | REQ IDs | Status | Files Changed | Checks | Evidence |
|---|---|---|---|---|---|
| Branch creation | — | Completed | — | `git branch --show-current` | Base `da7a3da` unchanged |
| WS-0 Bootstrap | REQ-001…006 | Completed | `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `index.html`, `.gitignore`, `.claude/launch.json`, placeholder `src/main.tsx` + `src/App.tsx` | install, typecheck, lint, build | Blocked once on the TS 7 / typescript-eslint conflict; resolved by DEC-010 and re-run green |
| WS-1 Contracts | REQ-010…013 | Completed | `src/domain/types.ts`, `ids.ts`, `units.ts`, `dates.ts`, `catalog/index.ts` (stub) + tests | typecheck, lint, test | 26 tests; AC-014 re-run under three timezones (Kiritimati +14, Midway −11, UTC) |
| WS-2 Catalog | REQ-020, 021, 023 | Completed | `src/domain/catalog/data.ts`, `index.ts`, `index.test.ts` | test, typecheck, lint | 96 entries, unique kebab-case slugs, the three §11.12 ids present |
| WS-3 YAML pipeline | REQ-022, 030…034 | Completed | `src/domain/routine-file/**` | test, typecheck, lint | 31 tests; §12 example parses to the expected domain objects with zero semantic issues |
| WS-4 Scheduling | REQ-040…044 | Completed | `src/domain/scheduling/**` | test, typecheck, lint | AC-040 → 8 dates from a Monday anchor; AC-042 → 7 from a Wednesday anchor, week-1 Monday omitted |
| WS-5 Persistence core | REQ-070…077 | Completed | `src/db/schema.ts`, `database.ts`, `index.ts`, `repositories/{routines,workouts,plannedExercises,placements,exercises,settings,import}.ts` + tests | test, typecheck, lint | Nine tables at version 1; TST-018 induces a real `ConstraintError` mid-transaction and asserts zero residue |
| WS-6 Session + progression | REQ-050…058, 060…066 | Completed | `src/domain/session/**`, `src/domain/progression/**` | test, typecheck, lint | 30 tests; the four §29 cases plus the AC-070 lb case |
| WS-7 Session persistence | serves REQ-054, 058, 061 | Completed | `src/db/repositories/{sessions,exerciseSessions,completedSets,history}.ts` + tests, append to `src/db/index.ts` | test, typecheck, lint | TST-021 recovers through a closed/reopened handle and through a second handle; §47 flow 2 end-to-end through real repositories → 102.5 kg |
| WS-8 Styling foundation | REQ-082, 083 | Completed | `src/styles/theme.css`, `src/assets/fonts/*.woff2` (4, copied), `src/lib/utils.ts`, one import line in `src/main.tsx` | build, typecheck, lint | 48 `--color-*`, 9 `--radius-*`, 6 `--shadow-*` reach the built CSS; `design/fonts/` originals intact |
| WS-9 Harness UI | REQ-080, 081 | Completed | `src/App.tsx`, `src/features/harness/{queries.ts,styles.ts,ImportPanel.tsx,SessionPanel.tsx}` | typecheck, lint, test, build, browser | Both §47 flows observed working; zero third-party network |
| INT lint hardening | REQ-004 | Completed | `eslint.config.js` | lint | Added `patterns` blocks — bare package names alone left `@/db/*` relative imports unblocked |
| INT test config | REQ-001 | Completed | `vitest.config.ts` | test | Removed `passWithNoTests` now that real tests exist |

## Integration Gates

| Gate | Owner | Diff Inspected? | Checks | Result |
|---|---|---:|---|---|
| Gate 0 | INT | Yes — read `package.json`, `tsconfig.json`, `eslint.config.js` in full | install, typecheck, lint, build | Pass, after DEC-010 |
| Wave 1 | INT | Yes — full `src/` tree listing plus four invariant greps | `install --frozen-lockfile`, typecheck, lint, test, build | Pass — 114 tests |
| Wave 2 | INT | Yes — verified `SCHEMA_V1` untouched by WS-7; verified `plannedExerciseId` appears in `progression/` only as a union discriminant | typecheck, lint, test | Pass — 156 tests |
| Wave 3 | INT | Yes — repo-wide literal sweep; browser run; `performance.getEntriesByType('resource')` | install, typecheck, lint, test, build, browser | Pass |

Invariant greps run at the Wave 1 gate, all clean: no `dexie`/`react` import under `src/domain/`; no `react` under `src/db/`; no `fetch`/`fs`/`XMLHttpRequest` anywhere in `src/`; no `Date.now()` or argument-less `new Date()` in any domain function.

## Requirement Status

| Requirement | Implementation | Acceptance Evidence | Status |
|---|---|---|---|
| REQ-001…006 | WS-0 | AC-001…006; all five scripts green from a clean install | Completed |
| REQ-010…013 | WS-1 | AC-010…014; timezone re-runs for AC-014 | Completed |
| REQ-020, 021, 023 | WS-2 | AC-020…022; 96 entries | Completed |
| REQ-022, 030…034 | WS-3 | AC-023…025, AC-030…035 | Completed |
| REQ-040…044 | WS-4 | AC-040…045; asserted date lists | Completed |
| REQ-050…058 | WS-6, WS-7 | AC-050…061 | Completed |
| REQ-060…066 | WS-6 | AC-062…070; four §29 cases + lb case | Completed |
| REQ-070…077 | WS-5 | AC-071…079 | Completed |
| REQ-080, 081 | WS-9 | AC-080…082, observed in browser | Completed |
| REQ-082, 083 | WS-8, WS-9 | AC-083…085; repo-wide literal sweep clean | Completed |

## Deviations

1. **DEC-010 — TypeScript pinned to 6.0.3, not 7.0.2.** `typescript-eslint@8.67.0` declares `typescript: ">=4.8.4 <6.1.0"` and throws at load under TS 7, making REQ-002 and REQ-004 mutually unsatisfiable. Confirmed independently by the coordinator. Spec amended; REQ-003 now reads "TypeScript 6.0.3". This was the alternative audit DEC-5 already enumerated.
2. **REQ-072 amended — `sessions.routineId` index added.** WS-5 found that REQ-075's delete-refusal must ask "does any Session reference this Routine?" and the original index list omitted the index that answers it. WS-5 correctly stopped rather than expanding the schema. Approved and applied while still at schema version 1, before any release — after release it would have cost a version-2 migration.
3. **`tsconfig` uses two projects rather than a bare `tsc --noEmit`.** TS6310 (`Referenced project may not disable emit`) reproduces under TS 6; the two-project form keeps both files, emits nothing, and keeps `strict` + `noUncheckedIndexedAccess` in both.
4. **`baseUrl` omitted.** TS 6 already errors on it (TS5101) without a deprecation-suppression flag. `paths` with a leading `./` is the idiomatic TS 6 spelling.
5. **`eslint.config.js` omits `@eslint/js` and `globals`.** Neither resolves from the project root under pnpm's isolated layout, and adding them would breach the frozen dependency list. `no-undef` is off for TS files via typescript-eslint's `eslint-recommended`, so nothing is lost.
6. **Lint rule hardened by INT.** `no-restricted-imports` with bare package names alone would not have caught a `@/db/*` import from `src/domain` — a real hole in the invariant the rule exists to protect. `patterns` blocks added in both directions.
7. **`startUnplannedExercise` is implemented and tested but unused by the harness.** REQ-052 required the domain behavior; the UI that would exercise it is the excluded gym-mode execution screen.
8. **Browser screenshots unavailable.** The Browser pane does not composite frames in this environment, so visual rendering was not verified — only DOM text, network behavior and console output. Both flows were driven through real React handlers and real repositories. This is a genuine limit on the Wave 3 evidence and is carried into verification.

## Ownership / Contract Conflicts

- None unresolved. `src/domain/types.ts` was written once at Gate 0 and not modified afterwards. `src/db/schema.ts` had exactly one writer (WS-5), including its amendment. `package.json` and `pnpm-lock.yaml` had exactly one writer (WS-0). `.claude/launch.json` took an addition only; the `design-preview` entry is byte-for-byte unchanged.
- `CONTEXT.md` was not modified — no new term settled that the glossary did not already carry.

## Blockers

- None open. The one blocker encountered (TS 7 / typescript-eslint) was escalated to the change owner, decided, recorded as DEC-010, and cleared.

## Judgement Calls Ratified by INT

- **`unit` lives on `PlannedExercise` and `CompletedSet`, not on `Exercise`.** CONTEXT.md says "fixed per Exercise"; PRD §14.1 gives `Exercise` no such field. §14 wins as the frozen field list — a catalog Exercise shipped in the build cannot know a given gym's machine reads in pounds. "Fixed per Exercise" survives as a behavioural invariant.
- **Progression arithmetic is done in the exercise's own unit**, with `weightKg` derived through the same single `toKg` conversion every stored set uses. Adding in kg and converting back leaves a lb exercise on 139.9998 lb instead of 140, compounding each session.
- **"Previous weight" is the first of the N evaluated sets** when a session's loads differ (a back-off set). §29 does not define this case; no acceptance criterion depends on it. Recorded rather than treated as a stop.
- **An unrecognized progression type maps to `manual`** in `routineFileToDomain`, while raising a blocking semantic issue — so such a file never reaches persistence, and the mapping function still has a total return type.

## Independent Verification Readiness

**Ready.** 156 tests passing; `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `build` all green; both PRD §47 flows observed running in a browser against real IndexedDB, with data surviving a full page reload and across sessions.
