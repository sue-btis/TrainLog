# Data — backup export, restore, CSV export — Implementation Plan

Status: Ready
Size: medium
Reliability: critical
Base: `master@31ea5ca`

## Preflight Baseline

- **Baseline moved since `spec.md` was written, with no content change.** The spec
  names `pwa-addition@c84b117`; `pwa-addition` has since merged to `master` as
  PR #4 (`31ea5ca`). Proven identical, not assumed:
  `git rev-parse c84b117^{tree}` and `git rev-parse HEAD^{tree}` both yield
  `c53f0bfaf2002f3bff1dba985e0752b3943eece6`, and
  `git diff --quiet c84b117 HEAD -- src/ docs/PRD.md package.json stryker.config.json`
  exits clean. Every repository fact cited in `spec.md` therefore holds verbatim
  at `31ea5ca`. The plan is **Ready**, not **Stale** — the pointer moved, the
  tree did not.
- **Working tree:** clean except the untracked `docs/changes/2026-08-21-data-export-restore/`.
  No overlap with any write set below.
- **HEAD is `master`, the default branch.** First action is to branch; no task
  below commits to `master`.
- Spec: `spec.md` — status `Ready for planning`, no open blocker.
- Audit: N/A (medium).
- **Required commands:** `pnpm test`, `pnpm typecheck`, `pnpm lint`,
  `pnpm build`, `pnpm exec stryker run` (no npm script exists for Stryker).
- **Relevant overlaps:** none. Nothing under `src/` matches backup, restore, CSV
  or `/more`.

## Dependency Graph

### True Dependencies

| ID | Dependency | Why It Must Precede | Unlocks |
|---|---|---|---|
| D-1 | Backup document contract before export | Export must emit the exact shape restore reads. Writing the emitter first invites a shape restore then has to accommodate. | T-2 |
| D-2 | Backup document contract before restore | Restore validates against the schema; without it validation is invented per-field. | T-3 |
| D-3 | Export **and** restore before the round-trip test | The check that proves writer and reader agree needs both halves. | Integration Gate |
| D-4 | Repository functions before the screen | The screen wires existing functions; building it first means stubbing the very behavior under test. | T-5 |

### Artificial Dependencies Removable by a Frozen Contract

| ID | Coupling | Frozen Artifact | Unlocks |
|---|---|---|---|
| A-1 | Export and restore would otherwise have to be written together to stay in agreement | `src/domain/backup/document.ts` — the document type and `BACKUP_VERSION`, frozen in T-1 | T-2 and T-3 become independently implementable and independently testable |

T-1 exists to collapse A-1. It materializes a contract `spec.md` already froze
(R-2); it may not extend or redesign it.

### Not a Dependency

CSV (T-4) shares the `src/domain/backup/` directory with T-1 but reads nothing
from the backup document. It is ordered after T-1 for write-set cleanliness
only, and could move earlier without breaking anything.

## Execution Strategy

**Topology: single-agent sequential, one working tree.**

Reason: `src/db/repositories/backup.ts` is written by T-2, T-3 **and** T-4, and
`src/db/index.ts` by all three. The write sets are provably **not** disjoint, so
concurrent writers are not permitted regardless of available parallelism. The
change is five tasks over ~8 files — sequential costs little and removes the
entire class of merge hazard. Reliability is `critical`; a merge artifact in
restore is exactly the failure mode that is unrecoverable.

Preflight step 0: `git switch -c change/data-export-restore`.

## Ownership Map

| Task | Mode | R IDs | May Read | May Edit | Must Not Edit | Depends On |
|---|---|---|---|---|---|---|
| T-1 | write | R-2, R-4, R-5 | `src/domain/**`, `src/db/schema.ts` | `src/domain/backup/**`, `stryker.config.json` | `src/db/**` (except reading schema), `src/features/**` | — |
| T-2 | write | R-3 | `src/domain/backup/**`, `src/db/**` | `src/db/repositories/backup.ts`, `src/db/repositories/backup.test.ts`, `src/db/index.ts` | `src/domain/backup/**`, `src/features/**` | T-1 |
| T-3 | write | R-6 (counts), R-7 | same as T-2 | same as T-2 | same as T-2 | T-1, T-2 |
| T-4 | write | R-8 | `src/domain/**`, `src/db/**` | `src/domain/backup/csv.ts` (+ test), `src/db/repositories/backup.ts`, `src/db/index.ts` | `src/domain/backup/document.ts`, `src/domain/backup/schema.ts`, `src/features/**` | T-1 |
| T-5 | write | R-1, R-6 (UI), R-9, R-10 | everything | `src/features/more/**`, `src/features/shell/sections.ts`, `src/App.tsx`, `docs/PRD.md` | `src/domain/**`, `src/db/**` | T-2, T-3, T-4 |

**Shared mutable files — sequential ownership, never concurrent:**

- `src/db/repositories/backup.ts` — T-2 creates it, T-3 and T-4 extend it. One
  writer at a time, in task order.
- `src/db/index.ts` — T-2, T-3, T-4 each append re-exports. Append only; no task
  reorders or removes an existing export.

**Contract-frozen after T-1:** `src/domain/backup/document.ts` and
`schema.ts` are read-only to T-2..T-5. A downstream task that finds them
insufficient **stops** and returns to the spec rather than editing them — that
is the whole point of T-1.

## Generated / Project / Lockfile Ownership

| File / Pattern | Owner | When It May Change | Validation |
|---|---|---|---|
| `stryker.config.json` | T-1 | Once, to append `src/domain/backup/**` to `mutate`. Thresholds unchanged. | `pnpm exec stryker run` |
| `docs/PRD.md` §38 | T-5 | Once, flipping **only** the Backup, Restore and CSV export rows to ✅. | Diff shows exactly three changed rows |
| `pnpm-lock.yaml` | **Nobody** | No task adds a dependency. Zod, Dexie and Vitest are already present. | Lockfile unchanged in the final diff |
| `src/db/schema.ts` | **Nobody** | Never — no table, no index, no version bump (spec stop condition). | Unchanged in the final diff |

## T-1 — Backup document contract

Goal: the §17 document shape exists as a type, a validator, and a parser, with
nothing able to write or read it yet.

- Assigned: R-2, R-4, R-5
- Steps:
  1. `document.ts` — the `BackupDocument` type (eleven keys: `version`,
     `exportedAt`, eight table arrays, `settings` object) and `BACKUP_VERSION`,
     a constant **distinct from `SCHEMA_VERSION`**.
  2. Tests first for the rejections of AC-4a, AC-4b, AC-4c and AC-5 — each
     starts red.
  3. `schema.ts` — Zod schemas per entity, mirroring `src/domain/types.ts`
     exactly. `ExerciseSession` is a **discriminated union**, not a shape with
     optional `planned*` fields. Unknown keys inside a row are dropped;
     malformed values are refused.
  4. `parseBackup(text)` returning
     `{ok: true, document} | {ok: false, errors: StructuralError[]}`, mirroring
     `parseRoutineFile`. Pure: no Dexie, no React, no clock.
  5. Referential checks over the parsed document: `workouts→routines`,
     `plannedExercises→workouts`, `placements→routines+workouts`,
     `sessions→routines+workouts`, `exerciseSessions→sessions`,
     `completedSets→exerciseSessions`, and every `exerciseId` resolving to a
     catalog slug or to a row in the document's own `exercises`.
  6. Append `src/domain/backup/**` to `stryker.config.json`'s `mutate`.
- Checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`
- Evidence: test output showing each rejection case failing before and passing
  after; the parser's public signature.
- Stop if: a domain type cannot be expressed in Zod without changing it; the
  §17 shape and `SCHEMA_V1` disagree; a check needs a database.

## T-2 — Export

Goal: the database becomes a valid document.

- Assigned: R-3. Depends on T-1.
- Steps:
  1. Test (`fake-indexeddb`): import a routine using catalog exercises, log a
     session, export, assert `exercises` excludes every catalog slug and each
     other array's length equals its table `count()` (AC-3).
  2. `exportBackup(exportedAt)` reading all nine tables. **`exportedAt` is a
     parameter** (DEC-E) — the repository reads no clock.
  3. Assert the result satisfies T-1's own schema, so export cannot drift from
     the contract without a red test.
  4. Re-export from `src/db/index.ts`.
- Checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`
- Evidence: passing export test; the key set of a real exported document.
- Stop if: producing the §17 shape needs any per-field translation.

## T-3 — Restore

Goal: a validated document replaces the database, atomically, or nothing happens.

- Assigned: R-6 (counts), R-7. Depends on T-1, T-2.
- Steps:
  1. Tests first: AC-7a (all eight tables replaced), AC-7b (`settings`
     survives), AC-7c (injected mid-write failure leaves the pre-restore
     contents), AC-4d (every rejection leaves all nine tables untouched).
  2. `restoreSummary(document)` — current counts vs the document's, plus whether
     an `in_progress` Session is about to be destroyed (AC-6b). Read-only.
  3. `restoreBackup(document)` — one `db.transaction('rw', [8 tables])`,
     `clear()` then `bulkAdd()` per table, following the `importRoutine`
     pattern. **`settings` is outside the transaction scope**, not merely
     skipped inside it.
  4. Re-export from `src/db/index.ts`.
- Checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`
- Evidence: passing atomicity test; the transaction's table list showing eight
  entries and no `settings`.
- Stop if: the replacement cannot be one transaction; a row needs coercing,
  defaulting or dropping to fit.

## Integration Gate A — round-trip

The gate that justifies this plan's existence. Runs after T-3.

- Owner: integration. May edit: `src/db/repositories/backup.test.ts` only.
- Must inspect: the combined T-1..T-3 diff; that `document.ts` and `schema.ts`
  are byte-identical to their T-1 state; that `src/db/schema.ts` and
  `pnpm-lock.yaml` are untouched.
- Check: seed a database → `exportBackup` → `resetDatabase()` →
  `parseBackup(JSON.stringify(doc))` → `restoreBackup` → assert each of the
  **eight restored tables** deep-equals the original. `settings` is excluded by
  R-7, and the test must say so in a comment so it does not read as an oversight.
- Completion: R-2, R-3, R-4, R-5, R-7 demonstrated; `pnpm test` green.
- Stop if: the round-trip needs any accommodation on either side — that is
  writer/reader disagreement, the exact failure this change is built to prevent.

## T-4 — CSV export

Goal: every logged set becomes one CSV row.

- Assigned: R-8. Depends on T-1 (directory only).
- Steps:
  1. Tests first: header exactly `date,exercise,set,weight,unit,reps,rir`
     (AC-8a); comma/quote escaping (AC-8e); empty input emits the header alone
     (AC-8f); a `165 lb` set emits `165,lb` and never `74.8` (AC-8d).
  2. `src/domain/backup/csv.ts` — a pure serializer over already-assembled rows.
     No database, no name resolution, no clock.
  3. A db read assembling the rows: sessions × exerciseSessions × completedSets,
     names via the existing `getExerciseNames` (catalog **and** user table,
     AC-8c), `date` via `formatLocalDate(new Date(session.startedAt))` — local
     day, never UTC (AC-8b).
  4. Re-export from `src/db/index.ts`.
- Checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`
- Evidence: passing CSV tests; a sample row set.
- Stop if: a column outside DEC-B is needed.

## T-5 — `/more` screen

Goal: the three actions are reachable and work offline.

- Assigned: R-1, R-6 (UI), R-9, R-10. Depends on T-2, T-3, T-4.
- Steps:
  1. Append the fourth `SECTIONS` entry — **append**, so `AppShell`'s
     `SECTIONS[2]` still resolves to Routines (AC-1).
  2. `/more` route inside the `AppShell` element in `App.tsx`; amend the header
     comment that currently promises More is still to come.
  3. `MoreScreen` with three actions. Restore uses the **existing inline
     two-step confirm** (DEC-F, `RoutinesScreen.tsx:98`) — no dialog primitive
     is added — and renders `restoreSummary` between validation and
     confirmation. Rejections render like `FileStep`'s: what is wrong and where.
  4. File input reusing the `FileStep.tsx:73` pattern, including the
     `event.target.value = ''` reset.
  5. Downloads via `Blob` + `URL.createObjectURL` + `<a download>`, revoking the
     object URL after use. Filenames from `formatLocalDate` (R-9).
  6. Flip the three §38 rows in `docs/PRD.md`.
- Checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`; then the
  browser QA below.
- Evidence: screenshot of `/more`; screenshot of the confirmation naming counts;
  a downloaded backup and CSV; DevTools network panel empty during all three
  actions.
- Stop if: a §32 setting is needed to make the screen coherent — Settings is
  excluded scope.

## Single-Agent Fallback

This *is* the plan. There is no concurrent variant, by the ownership analysis
above.

1. `git switch -c change/data-export-restore`
2. T-1 → T-2 → T-3
3. Integration Gate A (round-trip)
4. T-4
5. T-5
6. Final verification

Dependency-safe: each task's inputs are frozen by the time it starts, and the
one file three tasks share is written by one of them at a time.

## Requirement Execution Matrix

| Requirement | Task / Gate | Acceptance | Tests |
|---|---|---|---|
| R-1 | T-5 | AC-1 | Browser QA |
| R-2 | T-1, verified at Gate A | AC-2 | `domain/backup` schema tests |
| R-3 | T-2 | AC-3 | `db/repositories/backup.test.ts` |
| R-4 | T-1 (4a–4c), T-3 (4d) | AC-4a–4d | parser + repository tests |
| R-5 | T-1 | AC-5 | parser tests |
| R-6 | T-3 (counts), T-5 (UI) | AC-6a–6d | `restoreSummary` test + browser QA |
| R-7 | T-3 | AC-7a–7c | repository tests |
| R-8 | T-4 | AC-8a–8f | CSV serializer + read tests |
| R-9 | T-5 | AC-9 | Browser QA |
| R-10 | T-5 | AC-10 | Browser QA with network cut |

Every requirement has an owner; every acceptance item is scheduled.

## Final Verification

| Command / Check | Covers | Environment | Required Evidence |
|---|---|---|---|
| `pnpm test` | R-2..R-8 | Node + `fake-indexeddb` | Full pass, round-trip test named in the output |
| `pnpm typecheck` | Layering, branded ids | Node | Clean, both tsconfigs |
| `pnpm lint` | Conventions | Node | Clean |
| `pnpm build` | R-10 | Node | Succeeds; `pnpm-lock.yaml` unchanged |
| `pnpm exec stryker run` | R-4, R-5 validation strength | Node | Score ≥ existing `break: 80`; surviving mutants in the validation path listed and judged |
| Browser QA: import → log a session → export → clear site data → restore | R-1, R-6, R-9 | `pnpm preview` | Calendar and one exercise's history read as before |
| Browser QA repeated with the network cut | R-10 | `pnpm preview` | All three actions complete; network panel empty |
| `git diff --stat master` | Ownership | — | No file outside the Ownership Map; `src/db/schema.ts` and `pnpm-lock.yaml` absent |

## Global Stop Conditions

- A downstream task needs to edit `src/domain/backup/document.ts` or
  `schema.ts` after T-1 froze them.
- The round-trip at Gate A needs an accommodation on either side.
- Restore cannot be expressed as one transaction across the eight tables.
- Any task needs to write outside its Ownership Map row.
- `src/db/schema.ts`, `pnpm-lock.yaml`, or a §38 row outside the three owned
  ones appears in the diff.
- The spec and the repository contradict each other.
- Work is about to be committed to `master`.
