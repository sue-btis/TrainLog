# Routine Authoring — Execution

## Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Branch | `change/routine-authoring` |
| Planned base | `master@49efc78` + the landed quick change |
| Current start commit | `e6f3165` (change record) — on `40e0c02` (quick change) — on `49efc78` |
| Working tree before edits | Clean, except untracked `docs/PRD-DMS.md` |
| Pre-existing relevant changes | None. The quick change was committed to `change/empty-routine-accept` at `40e0c02` before any wave began. |

## Preflight Verdict

**Safe sequentially only.**

The tree was dirty at preflight, but every item was accounted for: the quick
change's three `src/` files, this change's four documents, and one unrelated
file. Plan §1's two required actions were performed before the first edit —
the quick change was committed on its own branch by explicit pathspec, and
`docs/PRD-DMS.md` was unstaged and left untracked. It has not been read, moved,
edited or staged since (stop condition 10).

All 34 existing paths named by spec §5 were verified present, and all 4 new
paths verified absent, before editing.

## Execution Topology

**Sequential.** One writer, one branch, per plan §4. No subagents were used to
write code; none were simulated. Waves A–E in order.

## Executed Work

| Wave / WS | REQ IDs | Status | Files Changed | Checks | Evidence |
|---|---|---|---|---|---|
| A / WS-1 | REQ-100…110, 902, 909 | **Completed** | 7 | typecheck, test, lint, build — all green | 471 tests (458 → +13); UI observed, below |
| B / Gate 0 + WS-2 | REQ-001…014, 200…212 | Not started | | | |
| C / WS-3 | REQ-300…312 | Not started | | | |
| D / WS-4 | REQ-400…417 | Not started | | | |
| E / WS-5 | REQ-500…516 | Not started | | | |

## Wave A — "I can create an exercise the app does not ship with."

### Files changed

| Path | Change |
|---|---|
| `src/domain/catalog/index.ts` | `findExerciseByName`, `CATALOG_CATEGORIES`, `CATALOG_EQUIPMENT` |
| `src/domain/routine-file/to-domain.ts` | `resolveFileExercise` re-expressed on the shared matcher |
| `src/db/repositories/exercises.ts` | `createUserExercise`, `ExerciseNameRequiredError`, `CreatedExercise` |
| `src/db/index.ts` | append-only re-export (exercises block) |
| `src/features/exercises/ExerciseCatalogScreen.tsx` | create affordance, header contract, empty-state copy |
| `src/domain/catalog/index.test.ts` | TST-100, TST-108 |
| `src/db/repositories/exercises.test.ts` | TST-102…107 |

No file outside WS-1's May-Edit column changed. Verified against the actual diff.

### The regression gate ran first, and it mattered

REQ-902's whole point is that one matcher replaces two. The refactor was landed
against the **existing** `resolveFileExercise` tests before anything else
changed: `to-domain.test.ts` + `catalog/index.test.ts`, 39 tests, green with the
extraction in place and no test modified. That is TST-101 — a no-edit gate, and
the only evidence that the observable resolution order survived.

### Requirement status

| Requirement | Implementation | Acceptance evidence | Status |
|---|---|---|---|
| REQ-100 | create affordance + live query | AC-100 — observed: created "Zercher Good Morning", found by search with no reload | Completed |
| REQ-101 | resolve-then-report | AC-101/102 — observed: "Front Squat already exists, so nothing was created." with a link to it | Completed |
| REQ-102, 902 | `findExerciseByName` in `@/domain/catalog`; `resolveFileExercise` re-expressed on it | AC-103 — TST-100, TST-101 | Completed |
| REQ-103 | shared matcher | AC-104 — TST-105 | Completed |
| REQ-104 | decision + write in one transaction | AC-105 — TST-104: two racing creates, one row, one `created: true` | Completed |
| REQ-105 | closed vocabularies from `CATALOG` only | AC-106 — TST-107 | Completed |
| REQ-106 | trim, then `ExerciseNameRequiredError` | AC-107 — TST-102, TST-106 | Completed |
| REQ-107 | catalog hit returns the slug, writes nothing | AC-108 — TST-103, **and** the running app: after typing a catalog name the `exercises` table still held exactly one row | Completed |
| REQ-108 | no update or delete verb exists | AC-109 — static: the repository exports one writer | Completed |
| REQ-109 | not closed, pinned | AC-110 — TST-108 | Completed |
| REQ-110 | header + empty-state rewritten | AC-111 — observed | Completed |
| REQ-909 | `CreatedExercise` declared locally | — (structural) | Completed |

### What was observed, and how

§12 requires the "running the app" ACs to record what was observed. The dev
server ran on port 5235 (`trainlog-verify-3`), at mobile viewport.

- The Exercises screen renders a **New exercise** control; opening it shows
  name, category and equipment with Create and Cancel.
- **Create is disabled while the name is blank** and enables once a name is
  typed — observed as a state transition, not inferred.
- Creating "Zercher Good Morning" reported *"Zercher Good Morning is yours
  now."*, closed the form, and the movement was findable by searching
  "zercher" **with no reload**, under the "other" band since it carries no
  category.
- Typing `"  front   SQUAT "` — deliberately mis-cased and mis-spaced — reported
  *"Front Squat already exists, so nothing was created."* and offered
  `/exercises/front-squat`, the permanent catalog slug.
- Reading IndexedDB directly afterwards: the `exercises` table held **exactly
  one row**, the created movement with a UUID. The catalog name wrote nothing.

**Method, stated plainly.** Clicks through the `computer` tool timed out — the
Browser pane is hidden in this session — so the interactions were driven by
dispatching real events at the page (`element.click()`, native value setter plus
an `input` event), which run the component's actual React handlers. Rendering,
copy and the IndexedDB state were read directly. This exercises the real
component and the real repository; it is not a trusted user gesture, and it is
recorded as what it is rather than as a click.

### Checks

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass — 29 files, **471** tests (baseline 458, +13) |
| `pnpm lint` | Pass |
| `pnpm build` | Pass |

## Integration Gates

| Gate | Owner | Diff inspected? | Checks | Result |
|---|---|---:|---|---|
| Wave A | this writer | Yes | four green, 471 tests | **Pass** |

## Deviations

- **UI verification method.** See "What was observed" above. The plan assumed
  browser-driven clicks; the pane is unavailable, so events were dispatched at
  the page instead. Recorded rather than glossed.

## Ownership / Contract Conflicts

None. `src/db/index.ts` was appended to, as its shared-file rule requires.

## Blockers

None.

## Independent Verification Readiness

Wave A: ready. Diff range `git diff 40e0c02..HEAD -- src/`.
Waves B–E: not started.
