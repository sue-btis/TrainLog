# Data — backup export, restore, CSV export — Execution

## Baseline

| Field | Value |
|---|---|
| Repository | `TrainLog` |
| Branch | `change/data-export-restore`, cut from `master` |
| Planned base | `master@31ea5ca` |
| Current start commit | `31ea5ca` |
| Working tree before edits | Clean apart from the untracked change folder |
| Pre-existing relevant changes | None. Nothing under `src/` matched backup, restore, CSV or `/more` |
| Baseline suite | 20 files, 257 tests, green before any edit |

## Preflight Verdict

**Safe sequentially only.**

`src/db/repositories/backup.ts` is written by three tasks and `src/db/index.ts`
by three, so the write sets are not disjoint and concurrent writers were never
an option. Executed strictly in plan order.

## Execution Topology

Sequential, single agent, one working tree — the plan's own topology, not a
fallback.

## Executed Work

| Task | R IDs | Status | Files | Checks | Evidence |
|---|---|---|---|---|---|
| T-1 Document contract | R-2, R-4, R-5 | Completed | `domain/backup/{document,schema,index}.ts` + `schema.test.ts`, `stryker.config.json` | test, typecheck, lint | 33 tests; commit `2006d6d` |
| T-2 Export | R-3 | Completed | `db/repositories/backup.ts`, `db/index.ts` | test, typecheck, lint | commit `9ddd14e` |
| T-3 Restore | R-6, R-7 | Completed | same | test, typecheck, lint | commit `9ddd14e` |
| Gate A Round-trip | — | Passed | `db/repositories/backup.test.ts` | test | 16 tests incl. two round-trips |
| T-4 CSV | R-8 | Completed | `domain/backup/csv.ts` + test, `db/repositories/backup.ts` | test, typecheck, lint | 11 + 7 tests; commit `246925c` |
| T-5 `/more` screen | R-1, R-6 (UI), R-9, R-10 | Completed | `features/more/`, `shell/sections.ts`, `App.tsx`, `docs/PRD.md` | test, typecheck, lint, build, browser QA | below |

Final suite: **324 tests, 23 files, green.** `pnpm typecheck`, `pnpm lint`,
`pnpm build` all clean; the build emits `dist/sw.js` with 23 precache entries.

## Integration Gates

| Gate | Owner | Diff Inspected? | Checks | Result |
|---|---|---|---|---|
| A — round-trip | integration | Yes — `git diff --stat HEAD -- src/db/schema.ts pnpm-lock.yaml` empty | export → JSON string → parse → restore, twice | Pass: the eight restored tables deep-equal the original |

## Browser Verification

Driven through the real UI, not simulated.

**Dev server (`localhost:5173`), pre-existing database of 3 routines / 2 sessions / 5 sets:**

- `/more` renders under a top bar reading "More" with a fourth nav tab (R-1).
- Export produced `trainlog-backup-2026-08-21.json` (8438 B) and
  `trainlog-history-2026-08-21.csv`, both named for the local day (R-9).
- CSV header exactly `date,exercise,set,weight,unit,reps,rir`; a set logged as
  `165 lb` emitted `165,lb`, not `74.8`; rows oldest-first (R-8, AC-8a/8d).
- Choosing a trimmed backup showed `Routines 3 → 3`, `Sessions 2 → 0`,
  `Sets logged 5 → 0` and wrote nothing (AC-6a).
- "Keep what I have" left the database at 2 sessions / 5 sets (AC-6c).
- "Replace it all" took it to 0 / 0, then restoring the full backup brought
  2 / 5 back; `/exercises/front-squat` then read "2 sessions", `165 LB × 6` and
  `100 KG × 6` in their own units (AC-6d, AC-7a).
- Three refusals, each naming what and where, each leaving the database
  unchanged (AC-4a, AC-4c, AC-4d):
  - `junk.json` → "the file itself · Unexpected token 'h' …"
  - `version: 9` → "This backup is version 9, and this app reads version 1."
  - orphaned set → "completedSets[0].exerciseSessionId · No Exercise Session in
    this backup has the id ghost"

**Production build (`pnpm preview`, port 4183) with the server stopped (R-10):**

- Service worker `active`; `/more` still rendered after the server was killed.
- All three actions completed offline: backup exported, CSV exported with the
  right header, and a full restore ran through confirmation to "Restored."
- No network request originated from any action — the only entries are
  page-load assets served from the precache.
- `grep -rE 'fetch\(|XMLHttpRequest|WebSocket|sendBeacon|import\('` over
  `domain/backup`, `db/repositories/backup.ts` and `features/more` → no match.

## Deviations

Three, all inside the spec rather than around it:

1. **Ids are branded in the Zod schema** (`idOf<T>()`), so `parseBackup`'s output
   type *is* `BackupDocument` rather than being cast into it. The first draft
   used `as BackupDocument`, which typecheck rejected — correctly, since a
   schema that drifts from `domain/types.ts` would then compile. Strengthens the
   contract R-2 freezes; changes no required behavior.
2. **`z.looseObject` for the unplanned ExerciseSession.** A plain `z.object`
   strips unknown keys *before* checks run, so a row carrying both
   `plannedExerciseId: null` and `plannedSets` had its contradiction silently
   deleted and was accepted. That is the exact silent data loss §18 forbids.
   Required by AC-4b; the first implementation did not satisfy it.
3. **Union issues are unwrapped in `toStructuralErrors`.** Zod reports a failed
   union as "Invalid input" and files the real reasons underneath, which does
   not satisfy R-4's "names what is wrong and where". Unwrapping them exposed a
   second case — a discriminated union matching no member reports *no* reasons,
   which would have produced a refusal with an empty error list. Both handled,
   with a test pinning that a refusal always carries at least one reason.

Two test expectations I wrote were wrong and the code was right; both corrected
to the observed behavior rather than the reverse:

- I asserted `plannedExercises[0].progression`; Zod reports the more precise
  `progression.type`.
- A fixture's `startedAt` of `1_755_100_000_000` is 2025-08-13, not the
  2026-08-18 I had asserted. Replaced with a timestamp built from local parts so
  the calendar day is a fact of the fixture rather than a guess.

## Ownership / Contract Conflicts

None. `src/db/schema.ts` and `pnpm-lock.yaml` are absent from the diff, no table
or index was added, and `SCHEMA_VERSION` is untouched. `domain/backup/document.ts`
and `schema.ts` were not edited after T-1 froze them. Exactly three rows of
§38 changed; the three stale PWA/Offline/Rest-timer rows were left alone as the
plan required.

## Findings Outside This Change

**Pre-existing: `plannedUnit` was added to a stored type with no migration.**

Restoring the user's own real backup was refused with
`exerciseSessions[0].plannedUnit — Invalid option`. The cause is not in this
change: `plannedUnit` became a required field of `PlannedExerciseSession` on
2026-08-20 in `fb64227`, and rows written before that commit do not have it.
`src/domain/session/index.ts:92` writes it for every new ExerciseSession, so the
current build is correct going forward; only rows predating `fb64227` are
affected.

`src/db/schema.ts:4` states the schema "is effectively irreversible … every
later change to it must be a forward migration". Adding a required field to a
stored type without one left existing rows violating a type the compiler
believes is satisfied.

The validator refusing them is correct behaviour and was deliberately not
loosened — tolerating rows that contradict the domain is what R-4 exists to
prevent. Verification proceeded against a database whose two legacy rows were
repaired the way a migration would, and the round-trip then passed end to end.

**Consequence today:** any lifter whose database predates `fb64227` — including
this one — can export a backup but not restore it. Out of scope here; it needs
a Dexie `version(2).upgrade()` backfilling `plannedUnit` from the referenced
PlannedExercise's `unit`, which is exactly what the manual repair did.

## Blockers

None.

## Independent Verification Readiness

**Ready**, with one item outstanding at the time of writing: `pnpm exec stryker
run` is still executing. The first run scored 77.27 against a `break` of 80, but
that run was invalid — the `mutate` glob matched the `.test.ts` files, so Stryker
was mutating test code. Implementation scores in that run were `csv.ts` 100.00
and `schema.ts` 78.15. The glob now excludes tests and the re-run is in flight;
its result belongs in `verification.md`.
