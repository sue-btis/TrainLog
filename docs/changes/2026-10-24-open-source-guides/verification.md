# Open-source guides Verification

Verdict: Pass
Acceptance: Accepted — Josue, 2026-10-24, «Acepto F-1 (mergeo storage-warning primero), haz el commit y sube la rama.»
Verified by: Self-verification (quick + lean, allowed by default)
Open limitations: None

Size: quick
Reliability: lean

## Pass History
- Pass 1 (2026-10-24): Pass — F-1 decision open; F-2, F-3 pre-existing.

## Baseline
| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Declared base | `0228c51` (`origin/development`) |
| Verified head / working tree | `0228c51` + uncommitted changes on `docs/open-source-guides/Josue` |
| Untracked before edits | none |
| Diff range | `git diff 0228c51` (`AGENTS.MD`, `README.MD`) + `CONTRIBUTING.md`, `docs/FORMAT.md`, `src/domain/routine-file/format-doc.test.ts`, change folder |
| Verification date | 2026-10-24 |

## Deviations
- FORMAT.md first said a version 1 file "is read as weight × reps". Reading `schema.ts:55` and `to-domain.ts` showed `version` is accepted as 1 or 2 and changes nothing else; the guide was corrected to say both are read by the same rules.
- The test's fence regex accepts `\r\n`: on this Windows checkout (`core.autocrlf=true`) FORMAT.md is read with CRLF, and the first run found zero blocks.

## Findings
| ID | Type | Finding | Evidence | Status |
|---|---|---|---|---|
| F-1 | decision | Release-order dependency: README "What it does" names the Today storage warning, which lives on `feat/storage-warning/Josue`, not yet in `development`. Merging this branch first makes the README claim it for a short while. | `git merge-base --is-ancestor origin/feat/storage-warning/Josue origin/development` → not merged | Accepted |
| F-2 | pre-existing | In-app field reference drift: `FIELD_NOTES` (`src/domain/routine-file/example.ts`) marks `progression` as optional (the parser requires it) and `reps` as required (v2 allows `target` instead). Shown in the import wizard. | `schema.ts:32-46` vs `example.ts` `FIELD_NOTES` | Fixed in `docs/changes/2026-10-24-field-notes/` |
| F-3 | pre-existing | Version wording: `FIELD_NOTES` and README say a version 1 file "means" weight × reps; the importer treats 1 and 2 identically and the outcome comes from v1 files declaring no `measurement`. | `schema.ts:55`; no other use of `version` in `src/domain/routine-file/` | README fixed on this branch; wizard text fixed in `docs/changes/2026-10-24-field-notes/` |

## Requirement Compliance
| Requirement / AC | Implementation Evidence | Independent Check | Result |
|---|---|---|---|
| AC-1 FORMAT.md yaml blocks parse and validate clean | `format-doc.test.ts` | 3 blocks, `validateRoutineFile(..., { knownExercises: [] })` → `[]` each (axis check on) | Pass |
| AC-2 every field, measurement and code documented | FORMAT.md tables | Test asserts every `MEASUREMENTS` entry and every `SemanticIssueCode` (keyed record with `satisfies`, so a new code breaks compile) appears; fields checked by reading `schema.ts:32-60` against the tables | Pass |
| AC-3 README current | "What it does", "Known limits", Documentation table | Read against shipped changes; removed the "cannot be created, renamed or deleted" claim | Pass (see F-1) |
| AC-4 CONTRIBUTING agrees with AGENTS.MD and licences | `CONTRIBUTING.md` | Each rule traced to AGENTS.MD (layers, offline, snapshot, derived progression, measurement module, English code), DESIGN.md (tokens, 48 px), CI workflow (Node 24, four commands), README Credits (MIT, CC BY-SA 4.0) | Pass |
| AC-5 AGENTS.MD says twelve | `AGENTS.MD` Validation | Matches the 12-member `SemanticIssueCode` union in `validate.ts:7-19` | Pass |

## Automated Checks
| Command / Check | Result | Covers | Evidence / Notes |
|---|---|---|---|
| `pnpm typecheck` | Pass | whole tree incl. the `satisfies` record | exit 0 |
| `pnpm lint` | Pass | whole tree | 0 errors; 2 pre-existing `ImportWizard.tsx` warnings |
| `pnpm test` | Pass | whole suite | 46 files, 1000 tests (adds 5 in `format-doc.test.ts`) |
| `pnpm build` | Pass | bundle | exit 0 |
| Relative links in the four documents | Pass | broken-link check | every `](./…)` / `](../…)` target exists |

## QA
1. Read FORMAT.md top to bottom against `schema.ts`, `validate.ts`, `measurement.ts`, `to-domain.ts`, `progression/index.ts`.
Expected: every statement traceable to code.
Actual: traceable, after the version correction recorded under Deviations.

## Ownership and Scope
| Workstream | Assigned Write Set | Actual Files | Compliant? |
|---|---|---|---:|
| single writer | FORMAT.md, format-doc test, CONTRIBUTING.md, README.MD, AGENTS.MD | same + change folder | Yes |

## Contract / Integration Review
- Frozen contract fidelity: no production code changed.
- Generated/migration/project/lockfile review: none touched.
- Other repositories: not applicable.

## Quality Metrics
- Changed-line coverage: no tool (docs; the test covers the examples)
- Mutation: not required (lean)

## Accepted Limitations
| ID | Finding | Accepted by | Date | Follow-up |
|---|---|---|---|---|
| L-1 | F-1 | Josue | 2026-10-24 | done — `feat/storage-warning/Josue` merged into `development` (PR #21) |

## Canonical Design Synchronization
| Artifact | Expected | Observed | Status |
|---|---|---|---|
| AGENTS.MD | semantic count matches code | twelve, listed | Pass |
| PRD §12 | unchanged (DEC-1) | unchanged | Pass |

## Merge Risk
Low

Reason:
Documentation plus one test over a docs file; no production code. The only ordering concern is F-1.
