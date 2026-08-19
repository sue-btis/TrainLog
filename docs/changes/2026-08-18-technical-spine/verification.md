# TrainLog Technical Spine — Verification

Verdict: **Pass with accepted limitations**
Size: large
Reliability: critical

The first verification pass returned **Fail** on the mutation gate: five survivors in the progression engine demonstrated two missing behavioural assertions in the product's stated correctness core. The change owner authorized remediation; two regression tests were added, both survivor classes are now killed, and the gate was re-run. The history of that failure is retained below rather than rewritten, because the failing pass is what produced the tests.

Remaining limitation: visual rendering is unverified (see Limitations).

## Audit Baseline

| Field | Value |
|---|---|
| Repository | `C:\Users\Josue Escobar\Documents\projects\mine\TrainLog` |
| Declared base | `da7a3daa52999e9fbc76110097d9e9460b74ca35` (`master`) |
| Audited head / working tree | `f5542dc9dc502ecbed158ec70216ee944dc31ab5` on `change/technical-spine`, working tree dirty |
| Diff range | `master (da7a3da)` → working tree |
| Verification date | 2026-08-19 |

**Baseline discrepancy, resolved.** The plan and execution record declare base `da7a3da`, but HEAD is `f5542dc` — a commit made at 09:34 by `sue_btis` containing only this change's own `docs/changes/` artifacts (audit, spec, plan, execution). It touches no production file and is not unrelated work, so the verification range was taken as `master` → working tree rather than `HEAD` → working tree. Recorded rather than silently accepted, because an ambiguous "current diff" is exactly what this step exists to prevent.

## Requirement Compliance

| Requirement / AC | Implementation Evidence | Independent Check | Result |
|---|---|---|---|
| REQ-001 / AC-001 | six pnpm scripts | Ran all five gates from the working tree | Pass |
| REQ-002 / AC-002 | frozen dep set | `package.json` read directly; matches ASM-1 with DEC-010 and the measurement-tooling amendment; no `vite-plugin-pwa`, no charting library | Pass |
| REQ-003 / AC-003 | TS 6.0.3, strict | `tsconfig.json` read: `strict`, `noUncheckedIndexedAccess`, plus `noUnusedLocals`/`noUnusedParameters`/`erasableSyntaxOnly`. `pnpm typecheck` clean | Pass |
| REQ-004, REQ-073 / AC-004, AC-074 | ESLint layering | `eslint.config.js` read; greps confirm no `dexie`/`react` under `src/domain/`, no `react` under `src/db/` | Pass |
| REQ-005 / AC-005 | launch.json append | `git diff master -- .claude/launch.json` shows a 6-line addition only; `design-preview` untouched | Pass |
| REQ-006 / AC-006 | .gitignore, lockfile | `dist/`, `node_modules/`, caches ignored; lockfile present and `--frozen-lockfile` installs clean | Pass |
| REQ-010…013 / AC-010…014 | types, ids, units, dates | `types.ts` read in full: every §14 entity, CONTEXT.md naming, `ProgressionRule` embedded per DEC-006, `ExerciseSession` a discriminated union. `toKg` uses `0.45359237`. Dates are branded `YYYY-MM-DD` | Pass |
| REQ-020…023 / AC-020…025 | catalog | 96 entries, unique kebab-case slugs, the three §11.12 ids present; statically imported, no dynamic import or fetch | Pass |
| REQ-030…034 / AC-030…035 | YAML pipeline | Structural/semantic split verified in source; issues carry machine-readable `FieldPath`; §12 example parses to expected objects | Pass |
| REQ-040…044 / AC-040…045 | scheduling | `generatePlacements` read: required `anchorDate`, Monday-of-week anchoring, pre-anchor skip, no per-day workout limit. No clock read | Pass |
| REQ-050…058 / AC-050…061 | session | `deriveSessionStatus` reads `ExerciseSession.status` alone per DEC-009; snapshot regression present; recovery tested through a reopened and a second handle | Pass |
| REQ-060…063, REQ-065, REQ-066 / AC-062…065, AC-069, AC-070 | progression | `progression/index.ts` read in full; pure, keyed by `exerciseId`, `completed`-only filter, unit-space arithmetic | Pass |
| REQ-064 / AC-066…068 | double progression | All four §29 cases pass. Mutation testing initially showed the set-ordering and walk-backwards premises unasserted; two regression tests added, both classes now killed, progression at 100% mutation score | Pass (after remediation) |
| REQ-070…072 / AC-071…073 | Dexie v1 | `schema.ts` read in full: exactly nine tables; every repository query served by a declared index (enumerated by the implementer and spot-checked) | Pass |
| REQ-074 / AC-075 | atomic import | `import.ts` read: one `rw` transaction over five tables, `bulkAdd` throughout. TST-018 induces a real `ConstraintError` on the last write | Pass |
| REQ-075, REQ-076 / AC-076…078 | routine lifecycle | `activateRoutine` read: transactional, demotes every other active row | Pass |
| REQ-077 / AC-079 | settings | Singleton row, round-trips after reopen | Pass |
| REQ-080, REQ-081 / AC-080…082 | harness UI | Driven in the browser by the verifier; both flows observed; zero third-party origins | Pass (with a limitation, below) |
| REQ-082, REQ-083 / AC-083…085 | tokens | `theme.css` at the prescribed path; repo-wide literal sweep across all `.ts`/`.tsx` returns nothing | Pass |

## Automated Checks

| Command / Check | Result | Covers | Evidence / Notes |
|---|---|---|---|
| `pnpm install --frozen-lockfile` | Pass | REQ-001, REQ-006 | "Already up to date" |
| `pnpm typecheck` | Pass | REQ-003 | Zero diagnostics, both projects |
| `pnpm lint` | Pass | REQ-004, REQ-073 | Zero diagnostics |
| `pnpm test` | Pass | TST-001…024 | 17 files, **158 tests passing** (156 + 2 verification regressions) |
| `pnpm build` | Pass | REQ-001, REQ-082 | Built clean; four woff2 emitted |
| `vitest --coverage` (v8) | Pass | critical coverage gate | 96.95% lines, 92.12% branches |
| `stryker run` (first pass) | Fail on review | critical mutation gate | 95.60%; seven survivors, five in invariant logic |
| `stryker run` (after remediation) | Pass | critical mutation gate | **98.74%**; progression and session both **100%**; two survivors remain, both classified equivalent |
| Browser QA | Pass | AC-080…082 | Both §47 flows; `performance.getEntriesByType('resource')` shows same-origin only |

## QA

1. Start the dev server, open the app.
   Expected: prior state restored from IndexedDB. Actual: routine "Hybrid Strength - September · active", 7 placements, history and suggestion all present — data persisted across a full page reload *and* across sessions.
2. Read the generated placements.
   Expected: 7 dates from a Wednesday anchor, week-1 Monday omitted. Actual: `2026-08-21 … 2026-09-11`, 7 entries, `2026-08-17` correctly absent.
3. Read the progression suggestion after 4×6 at 100 kg with `max_reps 6`, `increment 2.5`.
   Expected: 102.5 kg, target met. Actual: `102.5 kg (102.5 kg) · target met, load advances`.
4. Inspect network activity after load while exercising both flows.
   Expected: no third-party request. Actual: same-origin module and font entries only.

## Ownership and Scope

| Workstream | Assigned Write Set | Actual Files | Compliant? |
|---|---|---|---:|
| WS-0 | root config, launch.json | as assigned, plus the two `src/` placeholders it declared | Yes |
| WS-1 | `src/domain/{types,ids,units,dates}.ts`, catalog stub | as assigned | Yes |
| WS-2 | `src/domain/catalog/**` | as assigned | Yes |
| WS-3 | `src/domain/routine-file/**` | as assigned | Yes |
| WS-4 | `src/domain/scheduling/**` | as assigned | Yes |
| WS-5 | `src/db/` core + `schema.ts` | as assigned; sole writer of `schema.ts` | Yes |
| WS-6 | `src/domain/{session,progression}/**` | as assigned | Yes |
| WS-7 | four session repositories + `src/db/index.ts` append | as assigned; `schema.ts` untouched | Yes |
| WS-8 | `src/styles/`, `src/assets/fonts/`, `src/lib/` | as assigned; `design/fonts/` originals intact | Yes |
| WS-9 | `src/App.tsx`, `src/features/**` | as assigned | Yes |

`dexie-react-hooks` in `src/features/harness/queries.ts` is **not** a layering breach: AGENTS.MD prescribes `useLiveQuery` inside feature hooks calling repositories, and every query function comes from `@/db`. No IndexedDB access occurs outside `src/db/`.

## Contract / Integration Review

- **Frozen contract fidelity:** `src/domain/types.ts` written once at Gate 0, unmodified since. `src/db/schema.ts` had exactly one writer including its amendment, and is still version 1 with nine tables.
- **Integration gates:** all four executed by the coordinator against the actual tree.
- **Lockfile / generated files:** `pnpm-lock.yaml` had one writer during implementation; it changed again during verification to add the three measurement-only devDependencies, under recorded authority. `dist/`, `.stryker-tmp/` and `reports/` are gitignored and removed.
- **`stryker.config.json`** is new, added by verification, and is tooling configuration rather than product code.

## Quality Metrics

- **Changed-line coverage: 96.95%** (287/296) — critical target ≥95%: met.
- **Changed-branch coverage: 92.12%** (117/127) — critical target ≥90%: met.
  - Weakest area is `src/db/repositories` at 81.25% branch, concentrated in thin `get` wrappers (`workouts.ts:8`, `plannedExercises.ts:10`) and harness-only paths. `src/domain/session`, `progression`, `catalog`, `units`, `dates` and `import.ts` are at 100%.
- **Mutation scope:** `src/domain/{progression,session,scheduling}/index.ts`.
  - First pass: **95.60%** (150 killed, 2 timeout, 7 survived). progression 92.75%, scheduling 96.72%, session 100%.
  - After remediation: **98.74%** (155 killed, 2 timeout, 2 survived). **progression 100%**, **session 100%**, scheduling 96.72%.
- **Flaky/skipped tests:** none. `passWithNoTests` was removed at the Wave 1 gate.

### Surviving mutants, classified

| # | Location | Mutation | Classification | Outcome |
|---|---|---|---|---|
| 1–3 | `progression/index.ts:113-116` | `.sort((a,b) => a.setNumber - b.setNumber)` deleted / neutered / made `+` | **Real gap.** §29 evaluates "the first N sets" via `sets.slice(0, plannedSets)`, and `previous = sets[0]` picks the load to advance from. Both depend on set order. No test supplied sets out of `setNumber` order, so nothing proved the sort mattered — and the domain function must not lean on the repository's own sort. | **Killed.** Test added: two working sets at 100 kg plus an 80 kg back-off set, supplied out of order, with N = 2. Without the sort, `sets[0]` is the back-off set and the first N includes it — 80 kg and `targetMet: false` instead of 102.5 kg and `true`. |
| 4–5 | `progression/index.ts:117` | `if (sets.length > 0)` → `if (true)` / `>= 0` | **Real gap.** The guard implements "a completed Session that did not include this exercise is skipped, so the search walks backwards". Confirmed by grep: no test covered a completed session lacking the exercise. A lifter who trains a session without front squats would expose it. | **Killed.** Test added: a squat session followed by a later completed bench-only session. With the guard inverted the engine stops at the empty result and returns `null` instead of 102.5 kg. |
| 6 | `scheduling/index.ts:56` | `dayOffset < 7` → `<= 7` | **Equivalent mutant.** `DAYS_AFTER_MONDAY` holds 0–6, so `=== dayOffset` never matches on the 8th iteration. Harmless dead work; no assertion could distinguish it. | Accepted, no action. |
| 7 | `scheduling/index.ts:84` | `if (rotation.length === 0) return null` → `if (false)` | **Equivalent mutant.** Initially recorded as a minor gap; that was wrong. `nextWorkoutInRotation([], null)` is already asserted to be `null`, and the guard is redundant — `(-1+1) % 0` is `NaN`, `rotation[NaN]` is `undefined`, and the trailing `?? null` already returns `null`. Behaviour is identical with or without the guard. | Accepted, no action. |

Under the critical profile, survivors in invariant logic may not stand without recorded accepted-risk approval. Survivors 1–5 sat in the progression engine and each demonstrated a missing behavioural assertion, which is why the first pass failed. Both classes are now killed by tests that fail if the behaviour regresses. The two remaining survivors are equivalent mutants in scheduling, requiring no assertion.

## Missing / Partial Requirements

- None. **REQ-064** was the sole failing item and was closed by remediation: two regression tests in `src/domain/progression/index.test.ts`, no production code changed. The implementation was correct throughout; what was missing were the assertions that would catch it breaking.

## Extra / Unrequested Changes

- `stryker.config.json` and three measurement-only devDependencies, added by verification under recorded authority. Not product code, not bundled.
- Two regression tests added by verification, under the change owner's explicit instruction to remediate.
- `.gitignore` extended with `.stryker-tmp/` and `reports/`.
- Commit `f5542dc` (docs artifacts only), made outside the workstreams.

## Security / Tenant / Permission / Compatibility Concerns

- None. No auth, no tenancy, no secrets, no network. `crypto.randomUUID()` needs a secure context, satisfied by localhost and HTTPS.
- Dexie schema version 1 against an empty database — no migration to validate. Its shape is the compatibility surface for the excluded backup/restore work, and it matches §17's document field for field.

## Limitations or Deviations

- **Visual rendering unverified.** The Browser pane does not composite frames in this environment; screenshots time out. Both flows were driven through real React handlers and verified via DOM text, network entries and console output, but nobody has looked at the rendered page. The token system compiles and utilities generate correctly; whether it *looks* right is unknown. Authority: coordinator, recorded in `execution.md`.
- **DEC-010** — TypeScript pinned to 6.0.3 rather than 7.0.2. Authority: change owner.
- **REQ-072 amendment** — `sessions.routineId` index added at version 1. Authority: change owner.
- **REQ-002 amendment** — three measurement-only devDependencies. Authority: change owner.

## Merge Risk

**Low**

Layering holds, the schema is right, and the guarantees that matter most are tested by evidence that would actually fail if they broke: import atomicity through a real `ConstraintError`, the ADR 0002 snapshot regression, session recovery through a reopened handle, and — after remediation — every branch of the progression rule at a 100% mutation score. Coverage clears the critical bar at 96.95% lines and 92.12% branches.

The one thing merging cannot tell you is what the app looks like. That is a real gap, but it is a gap in an intentionally throwaway harness UI, not in the spine this change exists to establish — and the first real UI change will put a human in front of it.
