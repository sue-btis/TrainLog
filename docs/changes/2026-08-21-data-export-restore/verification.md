# Data — backup export, restore, CSV export — Verification

Verdict: **Pass with accepted limitations**
Size: medium
Reliability: critical

## Audit Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Declared base | `master@31ea5ca` |
| Audited head | `5329d5a` on `change/data-export-restore` |
| Working tree | Clean |
| Diff range | `master..change/data-export-restore` — 7 commits, 19 files, +3049/−8 |
| Verification date | 2026-08-21 |

The spec names `pwa-addition@c84b117` as its base. That commit and `master@31ea5ca`
have the identical tree `c53f0bfa…` (PR #4 merged with an empty diff), so the
spec's repository evidence holds unchanged at the audited base. Confirmed
independently, not taken from the execution record.

## Requirement Compliance

| Requirement / AC | Implementation Evidence | Independent Check | Result |
|---|---|---|---|
| R-1 / AC-1 | `sections.ts` appends `{to:'/more', label:'More'}` as the 4th entry; `App.tsx:33` adds the route inside `AppShell` | Diff read: `SECTIONS[2]` still resolves to Routines. Browser: `/more` renders under a top bar reading "More", 4 nav tabs present | **Pass** |
| R-2 / AC-2 | `domain/backup/document.ts` — 11 keys, 8 arrays + `settings` object | Exported document's key set matches exactly. `BACKUP_VERSION` is a constant distinct from `SCHEMA_VERSION`. Ids branded at each field, so the schema's output type *is* `BackupDocument` — no cast to hide drift | **Pass** |
| R-3 / AC-3 | `exportBackup` reads nine tables | `carries user-created Exercises and no catalog Exercise`; browser export of a real DB contained the user Exercise and no catalog slug | **Pass** |
| R-4 / AC-4a–4d | `parseBackup` — version gate, per-row Zod, referential pass | 26 refusal tests + 4000-case fuzz. Browser: `version: 9`, non-JSON and an orphaned set each refused, DB unchanged | **Pass** |
| R-5 / AC-5 | `checkReferences` resolves `exerciseId` against catalog or document | `accepts a catalog exerciseId absent from the exercises table`; `rejects a user-created exerciseId the document forgot to carry` | **Pass** |
| R-6 / AC-6a–6d | `restoreSummary` + `RestoreConfirmation` | `restoreSummary writes nothing`; browser showed `Sessions 2 → 0`, `Sets logged 5 → 0` before any write; "Keep what I have" left 2/5; "Replace it all" applied it | **Pass** |
| R-7 / AC-7a–7c | One `db.transaction('rw', [8 tables])`, `settings` outside scope | `replaces every restored table`; `leaves the device its own default unit`; `leaves the database untouched when a write fails part-way` — verified against a real mid-write failure, not a mock | **Pass** |
| R-8 / AC-8a–8f | `csv.ts` + `listSetsForCsv` | 14 tests; browser CSV header exact, `165 lb` emitted as `165,lb`, oldest-first, local day | **Pass** |
| R-9 / AC-9 | `download()` + `formatLocalDate` | Browser produced `trainlog-backup-2026-08-21.json` and `trainlog-history-2026-08-21.csv` | **Pass** |
| R-10 / AC-10 | No network API in the new code | Grep over all three new areas: no `fetch`/`XHR`/`WebSocket`/`sendBeacon`. Production build with the preview server **stopped**: all three actions completed; network panel shows only precached page-load assets | **Pass** |

Every requirement carries evidence beyond implementation self-report.

## Automated Checks

| Command | Result | Covers | Evidence |
|---|---|---|---|
| `pnpm test` | **Pass** | R-2…R-8 | 340 tests, 24 files (baseline 257) |
| `pnpm typecheck` | **Pass** | Layering, branded ids | Clean, both tsconfigs |
| `pnpm lint` | **Pass** | Conventions | Clean |
| `pnpm build` | **Pass** | R-10 | `dist/sw.js`, 23 precache entries; `pnpm-lock.yaml` unchanged |
| `pnpm exec stryker run` | **Pass** | R-4, R-5, R-8 | **91.21** vs `break: 80`, exit 0 |
| `vitest --coverage` | **Pass** | changed modules | Lines **100%**, branches **92.59%** |
| `git diff --name-only` vs forbidden paths | **Pass** | Ownership | Empty |

## QA

Driven through the real UI against a pre-existing database (3 routines,
2 sessions, 5 sets), then repeated on the production build.

1. Open `/more`. **Expected:** screen under a "More" top bar, 4 nav tabs.
   **Actual:** as expected.
2. Press *Export backup*, then *Export history*. **Expected:** two files named
   for today. **Actual:** `trainlog-backup-2026-08-21.json` (8438 B),
   `trainlog-history-2026-08-21.csv`; CSV header
   `date,exercise,set,weight,unit,reps,rir`; a `165 lb` set exported as `165,lb`.
3. Choose a backup holding fewer sessions. **Expected:** counts shown, nothing
   written. **Actual:** `Routines 3 → 3`, `Sessions 2 → 0`, `Sets logged 5 → 0`;
   DB unchanged.
4. Press *Keep what I have*. **Expected:** nothing written. **Actual:** still
   2 sessions / 5 sets.
5. Re-choose, press *Replace it all*. **Expected:** replaced. **Actual:** 0 / 0.
6. Restore the full backup. **Expected:** history returns.
   **Actual:** 2 / 5; `/exercises/front-squat` reads "2 sessions",
   `165 LB × 6` and `100 KG × 6` in their own units.
7. Feed junk, `version: 9`, and an orphaned set. **Expected:** each refused,
   naming what and where, DB untouched. **Actual:** as expected, all three.
8. Repeat 2–6 on `pnpm preview` **with the server stopped**. **Expected:** all
   work offline. **Actual:** all worked; no request from any action.

## Ownership and Scope

| Task | Assigned Write Set | Actual Files | Compliant? |
|---|---|---|---|
| T-1 | `domain/backup/**`, `stryker.config.json` | as assigned | **Yes** |
| T-2/T-3 | `db/repositories/backup.*`, `db/index.ts` | as assigned | **Yes** |
| T-4 | `domain/backup/csv.ts`, `db/repositories/backup.ts`, `db/index.ts` | as assigned | **Yes** |
| T-5 | `features/more/**`, `sections.ts`, `App.tsx`, `docs/PRD.md` | as assigned | **Yes** |

`src/db/schema.ts`, `src/domain/types.ts`, `src/domain/catalog/`,
`src/features/session/`, `src/features/import/`, `package.json` and
`pnpm-lock.yaml` are **absent from the diff**. No table, index, or
`SCHEMA_VERSION` change. Exactly three §38 rows changed; the three stale
PWA/Offline/Rest-timer rows were correctly left alone.

## Contract / Integration Review

- **Frozen contract fidelity:** `document.ts` and `schema.ts` were last modified
  in T-1's commit `2006d6d` except for the mutation-driven test work, which
  touched no production file. The contract held for every downstream task.
- **Integration gate A:** round-trip through a real JSON string —
  export → `resetDatabase` → parse → restore — returns the eight restored tables
  deep-equal to the original, and again on a second pass. `settings` excluded by
  R-7, stated in the test rather than silently omitted.
- **Generated / lockfile:** none changed. No dependency added; Zod, Dexie and
  Vitest were already present.
- **`stryker.config.json`:** two lines, both required — the module plus a
  negation excluding its tests.

## Quality Metrics

- Changed-line coverage: **100%** (133/133) — target 95%
- Changed-branch coverage: **92.59%** (50/54) — target 90%
- Statements **100%** (146/146), functions **100%** (42/42)
- Mutation scope: `src/domain/backup/**` excluding tests. Score **91.21%** —
  target 80%. `csv.ts` 100%, `schema.ts` 82.35%
- Surviving mutants: 42 in `schema.ts`, classified below. Zero no-coverage
- Fuzz: 4000+ hostile inputs, no throw, no silent refusal, no prototype pollution
- Flaky/skipped tests affecting scope: none

### Surviving mutant classification

39 of 42 mutate error-message prose. The other three are
`schema.ts:89` (a `typeof value === 'string'` guard `isLocalDate` makes
redundant, since its regex coerces), `schema.ts:270` (symbol path segments Zod
does not emit) and `schema.ts:464` (a non-numeric `version` takes a different
branch and is refused either way).

**No surviving mutant can make the validator accept a document it should
refuse**, which is the bar the critical profile sets for destructive-guard
logic. Asserting exact error wording would raise the score while making the
tests brittle and the validator no safer.

Every operator-level survivor elsewhere in the Stryker report (`scheduling`,
`session`, `history`) is pre-existing code outside this write set.

## Findings Raised During Verification

Verification was not a rubber stamp. Four defects were found and fixed:

1. **`rejects text that is not JSON` passed for the wrong reason.** Its helper
   ran input through `JSON.stringify`, so `'not a backup'` became valid JSON and
   the `JSON.parse` catch block was never executed — which is what six
   no-coverage mutants were reporting. Now calls `parseBackup` on raw text.
2. **`JSON.parse` returns property-less values** (`null`, `true`, `42`, `[]`).
   Reading `.version` off `null` throws rather than refusing; the optional chain
   guarding it was load-bearing and untested.
3. **Branch coverage was 88.88%, under the critical target.** Two of the six
   uncovered branches were genuinely reachable — a Session abandoned before any
   exercise was chosen, and an `exerciseId` resolving to no name. Both now
   tested; coverage 92.59%.
4. **Duplicate-id short-circuit and the unplanned-union member** had no test for
   their actual purpose. Both pinned.

No production code changed for any of them — the implementation was already
correct; the tests were not holding it in place.

## Missing / Partial Requirements

None. R-1 through R-10 all pass.

## Extra / Unrequested Changes

None. Every changed file appears in the plan's Ownership Map. The fuzz suite
(`schema.fuzz.test.ts`) is new and was not itemised in the plan, but is a test
file inside T-1's `domain/backup/**` write set, required by the critical
profile's parser/validator risk trigger.

## Security / Tenant / Permission / Compatibility Concerns

- **Destructive operation** is gated by validate → summarise → confirm, and is
  atomic. Verified rollback on a real mid-write failure.
- **Compatibility:** `version > BACKUP_VERSION` is refused with an explicit
  message; unknown keys inside a row are dropped so the format can gain fields.
  `BACKUP_VERSION` is independent of `SCHEMA_VERSION`, so a Dexie index change
  does not invalidate saved backups.
- **No network egress.** A backup never leaves the device.
- **No prototype pollution** via a crafted document (tested).
- No authentication, tenancy or permission surface exists in this app.

## Limitations or Deviations

1. **Four unreachable branches remain uncovered** — an index into a
   fixed-length `Promise.all` result, a `Map.get` whose keys are pre-seeded,
   symbol path segments, and `JSON.parse` throwing a non-`Error`. All exist to
   satisfy `noUncheckedIndexedAccess` and none is reachable at runtime.
   *Accepted.* Removing the guards to raise the number would trade real
   defensiveness for a metric.
2. **39 surviving mutants alter error prose only.** *Accepted*, per the
   classification above.
3. **`settings` is exported but not restored.** Behaviour required by §17 and
   §18. Visible consequence: restoring onto a new phone does not carry the
   default unit. *Accepted* — it is the PRD's decision, recorded in the spec.
4. **Restore is not blocked while a Session is in progress.** The user chose the
   confirmation alone rather than a refusal; the summary names the open session
   among the losses. *Accepted, authority: user decision at shaping.*

## Blocking Issue Found Outside This Change

**`plannedUnit` was added to a stored type with no Dexie migration** — commit
`fb64227` (2026-08-20) made it a required field of `PlannedExerciseSession`
while `SCHEMA_VERSION` stayed at 1. Rows written before that commit lack it.

Confirmed by running the app: restoring this repository owner's own backup was
refused with `exerciseSessions[0].plannedUnit — Invalid option`. The current
write path (`src/domain/session/index.ts:92`) always sets it, so only pre-`fb64227`
rows are affected.

**This change is correct and the refusal is correct** — `src/db/schema.ts:4`
requires every later schema change to be a forward migration, and tolerating
rows that contradict the domain is precisely what R-4 exists to prevent. The
validator was deliberately not loosened. Verification proceeded against a
database whose legacy rows were repaired the way a migration would, and the
round-trip then passed end to end.

**It does not block merging this change**, but it does mean any lifter with a
pre-`fb64227` database can export a backup and not restore it. The fix — a
`version(2).upgrade()` backfilling `plannedUnit` from the referenced
PlannedExercise's `unit` — belongs in its own change and has been queued.

## Merge Risk

**Low.**

The change is additive: one new domain module, one new repository, one new
screen, one nav entry. Nothing existing was modified beyond three wiring lines
and three PRD rows. No schema, dependency, or lockfile change. The one
irreversible operation is validated, confirmed, atomic, and verified to roll
back. Every requirement has behavioural evidence from both automated tests and
the running application, including offline on the production build.
