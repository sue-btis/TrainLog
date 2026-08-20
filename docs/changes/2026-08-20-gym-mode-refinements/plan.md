# Gym Mode Refinements Implementation Plan

Status: Ready
Size: medium
Reliability: strict
Base: `change/gym-mode`, working tree carrying the previous change (uncommitted)

## Preflight Baseline

- Working tree: the gym mode change, implemented and verified, **not committed**.
  This change builds directly on it. The verification diff range for *this*
  change is therefore "the tree as it stood after `verification.md` of
  `2026-08-20-gym-mode`", not `master@6dbb8d9`. Committing the previous change
  first would give a cleaner range and is recommended, not required.
- Spec: `docs/changes/2026-08-20-gym-mode-refinements/spec.md`, `Ready for planning`.
- Commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`,
  `npx stryker run`, dev server on port 5233 (`trainlog-verify`).
- Overlaps: none beyond the previous change, which this one extends by design.

## Dependency Graph

### True Dependencies

| ID | Dependency | Why It Must Precede | Unlocks |
|---|---|---|---|
| D-1 | Set-editing domain before its persistence | The repository writes what a domain function produced; nothing in `db/` derives values | T-2 |
| D-2 | Set-editing persistence before its UI | The edit/delete controls have nothing to call until the transaction exists | T-4 |
| D-3 | `domain/history.ts` before the history screen | The screen renders derived figures and computes none itself | T-5 |

T-3 (the four gym-mode refinements) depends on nothing and is ordered first
because it is the smallest and touches the same files T-4 will.

### Artificial Dependencies Removable by Gate 0

None.

## Execution Strategy

Topology: **Sequential**, single agent, one working tree.

Reason: T-3 and T-4 both edit `SetLogger.tsx` and `ExerciseView.tsx`; T-4 and
T-5 both edit `SessionScreen.tsx`. Write sets are not disjoint, and the change is
~14 files.

## Gate 0

Required: **No**.

## Ownership Map

| Task | Requirements | May Edit | Must Not Edit | Depends On |
|---|---|---|---|---|
| T-1 Set-editing domain | R-4 (values) | `src/domain/session/index.ts`, `index.test.ts` | `src/db/**`, `src/features/**`, `src/domain/progression/**` | — |
| T-2 Set-editing persistence | R-4 (writes) | `src/db/repositories/completedSets.ts`, `completedSets.test.ts` (new), `src/db/index.ts` | `src/db/schema.ts`, all other repositories | T-1 |
| T-3 Gym mode refinements | R-1, R-2, R-3, R-5 | `src/features/session/{SetLogger,RestTimer,ExerciseView,SessionScreen}.tsx`, `src/features/ui/styles.ts` | `src/db/**`, `src/domain/**`, `src/styles/theme.css` | — |
| T-4 Set editing UI | R-4 | `src/features/session/{ExerciseView,SessionScreen,SetLogger}.tsx`, `src/features/data/queries.ts` | `src/db/**`, `src/domain/**` | T-2, T-3 |
| T-5 Exercise History screen | R-6 | `src/domain/history.ts` + test (new), `src/features/history/**` (new), `src/App.tsx`, `src/features/routines/RoutineDetailScreen.tsx`, `src/features/session/SessionScreen.tsx`, `src/features/data/queries.ts`, `stryker.config.json` | `src/db/**` except reads, `src/domain/progression/**` | T-3 |

Shared files, single writer at a time in task order:
`SetLogger.tsx` → T-3, then T-4. `ExerciseView.tsx` → T-3, then T-4.
`SessionScreen.tsx` → T-3, then T-4, then T-5. `queries.ts` → T-4, then T-5.

## Generated / Migration / Project / Lockfile Ownership

| File / Pattern | Owner | When It May Change | Validation |
|---|---|---|---|
| `package.json`, `pnpm-lock.yaml` | Nobody | Never | `git diff --exit-code` |
| `src/db/schema.ts` | Nobody | Never — v1 frozen | `SCHEMA_V1` byte-diff |
| `src/styles/theme.css` | Nobody | Never — no new token expected | `git diff --exit-code` |
| `stryker.config.json` | T-5 | To add `src/domain/history.ts` to `mutate` | `npx stryker run` |
| `coverage/`, `.stryker-tmp/` | Nobody | Deleted after each metrics run | `git status` clean |

## Wave 1 — Gym mode does what a lifter asked of it

Goal: the four refinements plus editable sets.
Requirements: R-1, R-2, R-3, R-4, R-5. Acceptance: AC-1…AC-16.

### T-1 — Domain: correcting and removing a set

- Steps:
  1. Failing tests first: editing recomputes `weightKg` (including across a unit
     change); removing renumbers survivors to `1..n`; removing the last set
     returns `pending`; removing an id the list lacks is a no-op.
  2. Add the two pure functions. Every instant stays a parameter.
  3. `pnpm vitest run src/domain/session`, `pnpm typecheck`.
- Stop if: renumbering or status would need anything but `CompletedSet` and
  `ExerciseSession` values.

### T-2 — Persistence: one transaction for a deletion

- Steps:
  1. Failing `fake-indexeddb` tests in a new `completedSets.test.ts`: the
     survivors, their renumbering and the status change land together; a
     mid-write failure leaves the original three intact.
  2. Add the update and the transactional delete. `saveLoggedSet` is untouched.
  3. `pnpm vitest run src/db`, `pnpm typecheck`.
- Stop if: an index that v1 does not declare is needed.

### T-3 — The four refinements

- Steps:
  1. **R-5** — drop `overflow-x-auto` from `DomeStrip`; let the domes wrap.
  2. **R-1** — make the readout an input that also steps. Commit on blur and
     Enter; revert an unparseable or negative entry; `inputMode` so a phone
     offers a keypad.
  3. **R-2** — replace the fixed `+30s` with a lifter-chosen amount.
  4. **R-3** — the primary action completes a set below the planned count and
     advances at or above it; the last exercise offers to finish; an extra set
     stays reachable; an unplanned exercise never switches.
  5. `pnpm typecheck`, `pnpm lint`, QA each in the dev server.
- Stop if: a face is needed that `styles.ts` cannot build from existing tokens.

### T-4 — Editing and deleting sets on screen

- Steps:
  1. A control on each logged set (or its dome) to edit or delete it.
  2. Edit reuses the same number entry as R-1 rather than growing a second one.
  3. Delete confirms first (§37), naming what goes.
  4. Offer neither unless the Session is `in_progress` (AC-15).
  5. `pnpm typecheck`, `pnpm lint`, QA: edit a set, delete the middle of three,
     delete the last one and watch the exercise return to `pending`.
- Stop if: editing a past session's set becomes reachable — that is excluded.

### Wave 1 Integration Gate

- Inspect the combined diff; confirm frozen files untouched.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Completion: AC-1…AC-16 evidenced.

## Wave 2 — Every exercise has a history

Goal: §11.10. Requirements: R-6. Acceptance: AC-17…AC-21.

### T-5 — `domain/history.ts` and the screen

- Steps:
  1. Failing tests for every figure: empty history, one session, a best-set tie,
     a `partial` session counted in max/min but not in working weight (A-1…A-3).
  2. Add `src/domain/history.ts` — pure, over `SessionHistory[]`.
  3. Build the screen inside `AppShell` with a back control, and route it.
  4. Entry points: a `History` control in gym mode that returns to the open
     session, and the routine detail's exercise rows.
  5. Add `src/domain/history.ts` to `stryker.config.json`.
  6. `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`; QA both entries.
- Stop if: a figure needs a definition the spec's assumptions do not cover, or
  charting.

### Wave 2 Integration Gate

- Full combined diff against the previous change's verified state.
- `pnpm test`, `typecheck`, `lint`, `build`; coverage and mutation on the new
  domain logic; `coverage/` removed afterwards.
- Completion: AC-17…AC-21 evidenced, and AC-1…AC-16 still passing.

## Single-Agent Fallback

This is the sequential plan. Order: T-3 → T-1 → T-2 → T-4 → Wave 1 gate → T-5 →
Wave 2 gate. T-3 leads because it is smallest and touches the files T-4 extends.

## Requirement Execution Matrix

| Requirement | Task | Acceptance | Tests |
|---|---|---|---|
| R-1 | T-3 | AC-1…AC-4 | QA |
| R-2 | T-3 | AC-5, AC-6 | QA |
| R-3 | T-3 | AC-7…AC-10 | QA |
| R-4 | T-1 + T-2 + T-4 | AC-11…AC-15 | domain unit, `fake-indexeddb`, QA |
| R-5 | T-3 | AC-16 | QA |
| R-6 | T-5 | AC-17…AC-21 | domain unit, QA |

## Final Verification

| Command / Check | Covers | Required Evidence |
|---|---|---|
| `pnpm test` | R-4, R-6 | full pass, new cases named |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | all | clean |
| `npx vitest run --coverage` | strict profile | ≥90% line, ≥80% branch on changed logic |
| `npx stryker run` | strict profile | ≥80% (repo break threshold), survivors classified |
| `git diff --exit-code src/styles/theme.css package.json pnpm-lock.yaml` | frozen | no diff |
| `SCHEMA_V1` byte-diff | frozen | identical |
| QA list in `spec.md` | R-1…R-6 | what was done, what was observed |

## Global Stop Conditions

- Spec and repository contradict each other.
- A task needs to write outside its ownership row.
- Any frozen file would have to change.
- Editing a past session's set becomes reachable.
- Unrelated user work appears over a required write set.
