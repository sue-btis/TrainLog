# Cleanup: one category list, bottom nav at 320 px Verification

Verdict: Pass
Acceptance: Accepted — Josue, 2026-10-24, «Acepto F-1 y F-2, haz el commit y sube la rama.»
Verified by: Self-verification (quick + lean, allowed by default; requested via /verifying-change by Josue, 2026-10-24)
Open limitations: None

Size: quick
Reliability: lean

## Pass History
- Pass 1 (2026-10-24): Pass — F-1, F-2 decisions open.

## Baseline
| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Declared base | `0228c51` (`origin/development`, merge of PR #20) |
| Verified head / working tree | `0228c51` + uncommitted changes on `chore/cleanup-categories-nav/Josue` |
| Untracked before edits | none |
| Diff range | `git diff 0228c51` (4 files) + `docs/changes/2026-10-24-cleanup-categories-nav/` |
| Verification date | 2026-10-24 |

## Deviations
- None from the spec.

## Findings
| ID | Type | Finding | Evidence | Status |
|---|---|---|---|---|
| F-1 | decision | Visible ordering change: "This week" now lists muscles alphabetically (`CATALOG_CATEGORIES` is `.sort()`ed, `src/domain/catalog/index.ts:50-52`) instead of the catalog's first-listed order the volume change shipped with. The two volume tests that pinned the old order were updated to the new one, not weakened. | `src/domain/volume.test.ts` diff; spec Scope | Accepted |
| F-2 | decision | Type-token override: below 360 px the nav label uses `tracking-normal` over `type-micro`'s `.09em`. A standard utility, not an arbitrary value, and the Token-Only Rule (DESIGN.md §Named Rules) covers colour, radius, shadow and type values rather than breakpoints; still a local departure from the type scale that only the owner can sanction. | `src/features/shell/BottomNav.tsx:40` | Accepted |

## Requirement Compliance
| Requirement / AC | Implementation Evidence | Independent Check | Result |
|---|---|---|---|
| Delete duplicate `CATEGORIES` | Removed from `src/domain/catalog/index.ts`; `volume.ts` imports `CATALOG_CATEGORIES` | `grep -rn CATEGORIES src` (excluding `CATALOG_CATEGORIES`): no matches | Pass |
| AC-1 volume tests, alphabetical | `volume.test.ts` expects `biceps` before `chest` / `quadriceps` | `vitest run src/domain/volume src/domain/catalog`: 69 passed | Pass |
| AC-2 nav at 320 px one line, 375 px unchanged | `gap-1 px-2` and `max-[359px]:tracking-normal` below 360 px | Dev server, rerun this pass: 320 px → 4 labels × 1 line, `scrollWidth` 320; 375 px → gap 8 px, padding 16 px, tracking 0.99 px | Pass |

## Automated Checks
| Command / Check | Result | Covers | Evidence / Notes |
|---|---|---|---|
| `pnpm typecheck` | Pass | whole tree | exit 0 |
| `pnpm lint` | Pass | whole tree | 0 errors; 2 warnings, both pre-existing `ImportWizard.tsx` exhaustive-deps |
| `pnpm test` | Pass | whole suite | 45 files, 995 tests |
| `pnpm build` | Pass | production bundle + PWA | exit 0 |

## QA
1. Dev server :5235, viewport 320×700, Progress.
Expected: TODAY / CALENDAR / PROGRESS / MORE each on one line; no horizontal scroll.
Actual: each label one line; `document.documentElement.scrollWidth` 320.
2. Same at 375×812.
Expected: spacing and tracking as before the change.
Actual: row gap 8 px, padding 16 px, label letter-spacing 0.99 px.
3. "This week" tab at 320 px.
Expected: renders.
Actual: renders ("Full body 1/6"); with one muscle row the new order is not observable here — covered by the unit test.

## Ownership and Scope
| Workstream | Assigned Write Set | Actual Files | Compliant? |
|---|---|---|---:|
| single writer | `src/domain/catalog/index.ts`, `src/domain/volume.ts` (+test), `src/features/shell/BottomNav.tsx`, change folder | same | Yes |

## Contract / Integration Review
- Frozen contract fidelity: `CATEGORIES` had one consumer (`src/domain/volume.ts`, by grep); no other export changed.
- Integration gate: n/a (single writer).
- Generated/migration/project/lockfile review: none touched.
- Other repositories: not applicable.

## Quality Metrics
- Changed-line coverage: no tool
- Changed-branch coverage: no tool
- Mutation: not required (lean)
- Flaky/skipped tests affecting scope: none

## Accepted Limitations
| ID | Finding | Accepted by | Date | Follow-up |
|---|---|---|---|---|
| L-1 | F-1 | Josue | 2026-10-24 | none |
| L-2 | F-2 | Josue | 2026-10-24 | none |

## Canonical Design Synchronization
| Artifact | Expected | Observed | Status |
|---|---|---|---|
| `docs/changes/2026-10-23-exercise-rename-delete/audit.md` F-4 | duplicate category list resolved | resolved by this change | Pass |
| `DESIGN.md` Token-Only Rule | no arbitrary colour/radius/shadow/type values | breakpoint variants only; type override is F-2 | Pass (F-2 open as decision) |

## Merge Risk
Low

Reason:
Two small, local edits: one constant with a single consumer, and responsive classes on the nav row that only apply below 360 px. Full suite and build pass.
