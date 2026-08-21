# Data — backup export, restore, CSV export — Spec

Status: Ready for planning
Size: medium
Reliability: critical
Base: `pwa-addition` at `c84b117`, clean working tree — since merged to
`master` as `31ea5ca` (PR #4) with an **identical tree**
(`c53f0bfa…` both sides), so every fact below holds unchanged at `master`.
See `plan.md` § Preflight Baseline.

## Goal

A lifter can carry their entire training history off one device and onto
another, and can take their set history into any external tool.

Done when: a fourth navigation tab **More** leads to a screen with three
working actions — **Export Backup** downloads a JSON document holding every row
the app owns; **Restore Backup** validates a chosen document, states exactly
what is about to be destroyed, and on confirmation replaces the local database
with it; **Export History (CSV)** downloads every logged set as one CSV. All
three work with the network off.

## Evidence and Current Behavior

Verified by inspection at `c84b117`:

- **The schema was built for this.** [`src/db/schema.ts:11`](../../../src/db/schema.ts) states the nine
  tables are *"matching the backup document of §17 field for field so that
  export and restore can serialize the database without a translation layer."*
  No translation layer is needed and none may be introduced.
- **Catalog exclusion is structural, not a filter.** Catalog Exercises ship in
  the build and are never written to the `exercises` table (DEC-007,
  [`src/domain/catalog/index.ts:5`](../../../src/domain/catalog/index.ts)).
  [`listUserExercises`](../../../src/db/repositories/exercises.ts) already carries the comment
  *"The catalog is not included (§17 export scope)."* §17's "the base catalog is
  not exported" and §18's "restore does not replace the bundled catalog"
  therefore need no code.
- **`More` is the repository's own name for the fourth tab.**
  [`src/features/shell/sections.ts:9`](../../../src/features/shell/sections.ts) and
  [`src/App.tsx:10`](../../../src/App.tsx) both read *"Progress, Exercises and More arrive
  with the screens behind them."* `SECTIONS` currently holds three entries;
  [`AppShell.tsx:23`](../../../src/features/shell/AppShell.tsx) binds `SECTIONS[2]` as `ROUTINES`,
  so **appending** a fourth entry is safe and prepending is not.
- **Multi-table atomic writes are an established pattern** —
  [`importRoutine`](../../../src/db/repositories/import.ts) opens one
  `db.transaction('rw', [5 tables])` so *"any failure aborts the whole
  transaction and leaves no partial routine behind."* Six other call sites use
  the same shape.
- **Structural validation has a shape to mirror** —
  [`parseRoutineFile`](../../../src/domain/routine-file/schema.ts) is pure, does no I/O, reads no
  clock, and returns `{ok: true, file} | {ok: false, errors: StructuralError[]}`
  where `StructuralError` is `{path, message}`.
- **File input has a working pattern** — the visually-hidden `<input
  type="file">` driven by a visible `Button`, including the `event.target.value
  = ''` reset that permits re-choosing the same file
  ([`FileStep.tsx:73`](../../../src/features/import/FileStep.tsx)).
- **Confirmation has a working pattern, and it is not a modal** — destructive
  actions use an inline two-step button that swaps its own label plus a
  "Keep it" escape ([`RoutinesScreen.tsx:98`](../../../src/features/routines/RoutinesScreen.tsx)).
  No dialog primitive exists in `src/components/ui/`; none is to be added.
- **Ids are branded strings** (`Id<Entity>`) and `toId` *"does not validate — the
  caller asserts provenance"* ([`src/domain/ids.ts`](../../../src/domain/ids.ts)). Restore is a
  caller that cannot assert provenance, so it must validate before tagging.
- **`ExerciseSession` is a discriminated union** on `plannedExerciseId`
  (`null` → unplanned, id → planned with nine snapshotted `planned*` fields),
  [`src/domain/types.ts`](../../../src/domain/types.ts). A shape with nullable targets is not
  representable and must not become representable through restore.
- **The domain reads no clock** (DEC-008). Every date-dependent domain function
  takes its date as a parameter.
- **`Settings` today holds exactly `{id: 'settings', defaultUnit}`**
  ([`src/db/repositories/settings.ts`](../../../src/db/repositories/settings.ts)). The rest of §32 is
  unimplemented.
- **Nothing named backup, restore, export or CSV exists** anywhere under
  `src/`. `src/features/data/` holds only `queries.ts`.
- Working tree clean at `c84b117`. **No overlap with unrelated work.**

## Scope

Included:

- A `/more` route inside the shell, a fourth `SECTIONS` entry, and the screen.
- The backup document contract (§17) as a pure domain module: type, Zod schema,
  and a parser mirroring `parseRoutineFile`.
- Export: read nine tables → document → downloaded JSON file.
- Restore: parse → validate → summarise losses → confirm → atomic replacement of
  eight tables.
- CSV export of every logged set.

Excluded:

- **Settings UI (§32).** `/more` hosts the three data actions only. The Settings
  section lands there in a later change.
- **Merge on restore.** §18 and PRD §37 (Data Safety) both say replace; §37 is explicit that
  merge is out of MVP.
- **Forward migration of older backups.** Only `version: 1` exists, so no
  `version < 1` input is reachable. The rejection branches are in scope; a
  migration path is not.
- **Session history screen** (the fourth MVP gap) — a separate change.
- **Progress dashboard, exercise catalog screen** — out of MVP 0.1.
- **Any network transport for backups.** Local file in, local file out.

## Decisions and Assumptions

| ID | Decision | Authority |
|---|---|---|
| DEC-A | Host screen is `/more`, appended to `SECTIONS` as the fourth tab. | User, and the repo's own naming (`sections.ts:9`) |
| DEC-B | CSV columns are `date,exercise,set,weight,unit,reps,rir` — a superset of the §19 example. | User |
| DEC-C | Restore shows an inline confirmation naming what will be destroyed, after validation, before any write. | User |
| DEC-D | Restore replaces; it never merges. | §18, §37 |
| DEC-E | The document's `version` and `exportedAt` are supplied by the caller, not read from a clock inside the domain. | DEC-008 (`domain` reads no clock) |
| DEC-F | Confirmation uses the existing inline two-step button pattern. No dialog primitive is added. | `RoutinesScreen.tsx:98`; ladder rung 2 (reuse) |

Assumptions:

- **`settings` is exported (§17) but not restored (§18).** Both are explicit in
  the PRD. Stated consequence: restoring onto a new phone does not carry the
  default unit across; the lifter's first import there uses `DEFAULT_UNIT`.
  Stop if a reviewer reads §18's exclusion as an oversight rather than a
  decision — that is a product call, not an implementation one.
- **No in-progress-session guard was selected.** Restore therefore proceeds
  while a Session is `in_progress`, and destroys it along with the rest of
  `sessions`. R-6 requires the confirmation to name it. Reachability is
  unaffected: `/more` sits inside the shell and `/session` outside it, so the
  lifter has already left gym mode to get here. Stop if a route is later added
  that reaches `/more` from inside a live session.
- **Catalog slugs are permanent** (REQ-023: removing or renaming one is
  prohibited), which is what makes R-4's exercise-reference check safe across
  builds. Stop if a catalog entry is ever removed.
- **One local user, whole-database reads** (`schema.ts:50`, "One database, one local user"). Export holds the entire
  database in memory as one JSON string. Acceptable at a single lifter's
  history; a stated ceiling, not a silent one.

## Requirements and Acceptance

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-1 | A fourth navigation tab **More** appears after Routines and opens `/more` inside the shell, with the top bar naming it. | AC-1: `SECTIONS` has four entries with `More` **last**; `AppShell`'s `SECTIONS[2]` still resolves to Routines. Navigating to `/more` renders the screen under a top bar reading "More", with the bottom nav present and the More tab active. |
| R-2 | The backup document has exactly the eleven keys of §17 — `version`, `exportedAt`, and the nine tables (eight as arrays, `settings` as an object) — and is the only serialization format. | AC-2: the exported JSON's key set equals `{version, exportedAt, routines, workouts, plannedExercises, placements, exercises, sessions, exerciseSessions, completedSets, settings}`. `TABLE_NAMES` from `db/schema.ts` is a subset of it. No key is renamed or reshaped relative to the stored row. |
| R-3 | Export writes every row of all nine tables, and no catalog Exercise. | AC-3: with a routine imported using catalog exercises and one session logged, the document's `exercises` array excludes every catalog slug and holds exactly the user-created Exercises; every other array's length equals its table's `count()`. |
| R-4 | A document is rejected — with no write of any kind — when its `version` is greater than the app's, when any row fails its type schema, or when any intra-document reference is unresolvable. Rejection names what is wrong and where. | AC-4a: `version: 2` is refused with an explicit message naming the version mismatch. AC-4b: a `CompletedSet` with `reps: "6"`, a `Session` with an unknown `status`, and an `ExerciseSession` carrying both `plannedExerciseId: null` and `plannedSets` are each refused, each reporting a `path`. AC-4c: a `completedSets` row whose `exerciseSessionId` matches no `exerciseSessions` row in the same document is refused. AC-4d: after every rejection above, all nine tables hold exactly what they held before. |
| R-5 | An `exerciseId` on any row resolves either to a catalog slug or to an Exercise inside the same document. | AC-5: a document whose `exerciseSessions` references an `exerciseId` present in neither is refused; one referencing a catalog slug not present in `exercises` is accepted. |
| R-6 | After a document validates and before anything is written, the screen states what the restore will destroy and what it will install, and nothing happens until the lifter confirms. An `in_progress` Session is named among the losses. | AC-6a: choosing a valid backup writes nothing; the screen shows current counts (routines, sessions, sets) against the document's. AC-6b: with an `in_progress` Session present, the summary says so in words. AC-6c: dismissing leaves all nine tables unchanged. AC-6d: confirming performs the restore. |
| R-7 | Restore replaces exactly the eight tables §18 lists, atomically. `settings` is not touched. The catalog is untouched by construction. | AC-7a: after restoring onto a non-empty database, each of the eight tables equals the document's contents — no pre-existing row survives, no document row is missing. AC-7b: a `defaultUnit` of `lb` set before the restore is still `lb` after it. AC-7c: a failure injected mid-write leaves all eight tables at their pre-restore contents, not partially replaced. |
| R-8 | CSV export emits one row per `CompletedSet` across all Sessions, with the header `date,exercise,set,weight,unit,reps,rir`. | AC-8a: header matches exactly. AC-8b: `date` is the Session's local calendar day derived from `startedAt`, never a UTC day. AC-8c: `exercise` is the resolved display name, for catalog and user-created Exercises alike. AC-8d: `weight` and `unit` are what the lifter entered — a set logged as `165 lb` emits `165,lb`, not `74.8`. AC-8e: a name containing a comma or a quote is quoted and escaped so the column count holds. AC-8f: an empty database emits the header alone. |
| R-9 | Both exports arrive as downloaded files named for the local day: `trainlog-backup-YYYY-MM-DD.json` and `trainlog-history-YYYY-MM-DD.csv`. | AC-9: both downloads occur with the network off and their filenames carry the local date, matching `formatLocalDate`. |
| R-10 | No runtime network request is introduced. | AC-10: with the service worker active and the network cut, all three actions complete. The DevTools network panel records no request from them. |

## Contracts and Risk Controls

**New contract — the backup document.** It is a published format the moment a
lifter saves a file: a document exported today must restore into a later build.
`version` is the only compatibility lever, so:

- the document's version is a named constant in `domain/backup`, distinct from
  `SCHEMA_VERSION`; a Dexie index change need not invalidate saved backups, and
  a document reshape must bump it;
- `version > current` is refused with an explicit message — §18 is emphatic that
  ignoring unknown fields would permanently lose data;
- unknown *keys* inside a row are dropped by the Zod schema, matching how the
  routine file format tolerates additive fields.

**Preserved contracts.** `SCHEMA_V1` and `SCHEMA_VERSION` are unchanged — this
change adds no table and no index. Every domain type in `src/domain/types.ts` is
unchanged. `db/index.ts` remains the only persistence seam. `dexie` stays
imported only inside `src/db` (REQ-073).

**Risk controls, in force because restore is irreversible:**

1. **Validate the whole document, every row, before writing anything.** A
   shallow envelope check would let a malformed set into permanent history.
   `toId` explicitly does not validate, so restore must.
2. **One transaction over all eight tables.** A partial restore is a corrupt
   database, and the database is the only copy (`schema.ts:4`).
3. **Refuse rather than repair.** No coercion, no defaulting, no dropping of
   rows that fail. A backup that cannot be trusted whole is not restored.
4. **Confirmation is informed** — counts, not a generic "are you sure".

**Layering.** `features → db → domain`, one way. The document type, its schema,
its parser, the referential checks and the CSV text serializer are pure
`domain/`; reading and writing tables is `db/`; choosing files, downloading and
confirming is `features/`. No Dexie in `domain/`, no React in either.

## Quality Obligations

- **Tests** (`domain` unit tests carry the correctness; repositories run against
  `fake-indexeddb`):
  - `domain/backup` parser: valid round-trip; every rejection of AC-4a/4b/4c
    and AC-5; unknown-key tolerance; the `ExerciseSession` union both ways.
  - `domain/backup` CSV: header, quoting/escaping (AC-8e), empty input,
    entered-unit preservation.
  - `db/repositories/backup`: export completeness and catalog exclusion (AC-3);
    restore replacement across all eight tables (AC-7a); `settings` untouched
    (AC-7b); atomic abort (AC-7c).
  - Round-trip: export → restore into a reset database → each of the **eight
    restored tables** deep-equals the original. `settings` is excluded from the
    comparison by R-7, not overlooked. This is the single check that proves
    writer and reader agree.
- **QA (manual, in the browser):** import a routine, log a session, export;
  clear site data; restore; confirm the calendar and one exercise's history read
  as before. Repeat with the network off (R-10).
- **Static/build:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` —
  all four must pass.
- **Mutation:** `stryker.config.json` carries an explicit `mutate` allowlist
  (four domain modules) and `thresholds.break: 80`. Add `src/domain/backup/**`
  to that list and run `pnpm exec stryker run` — there is no npm script for it.
  The existing 80 break threshold applies unchanged. Surviving mutants in the
  validation path are defects here, not noise: a validator that passes its
  tests while accepting bad input is exactly the failure this reliability level
  exists to catch.

## Change Surface

Expected edits:

| Path | Change |
|---|---|
| `src/domain/backup/` (new) | Document type, Zod schema, parser, referential checks, CSV serializer, tests |
| `src/db/repositories/backup.ts` (new) | `exportBackup`, `restoreBackup`, restore summary counts |
| `src/db/repositories/backup.test.ts` (new) | Repository tests |
| `src/db/index.ts` | Re-export the new repository functions |
| `src/features/more/` (new) | `MoreScreen.tsx` and its hook |
| `src/features/shell/sections.ts` | Append the fourth entry |
| `src/App.tsx` | Add the `/more` route; amend the header comment |
| `stryker.config.json` | Add `src/domain/backup/**` to the `mutate` allowlist |
| `docs/PRD.md` §38 | Flip Backup, Restore and CSV export to ✅ |

Do not touch:

- `src/db/schema.ts` — no table, no index, no version change.
- `src/domain/types.ts` — restore serializes existing types; it does not shape them.
- `src/domain/catalog/` — the catalog is excluded structurally, not by editing it.
- `src/features/session/`, `src/features/import/` — no behavior of gym mode or
  the wizard changes.
- `AppShell`'s `SECTIONS[2]` binding — kept valid by appending.

Note for the same commit: §38 of the PRD also carries three rows that went stale
at `c84b117` (PWA ⬜, Offline ⬜, Rest timer 🟡). Correcting them is **not** part
of this change's scope and should not be smuggled into it.

## Planning Decision

**Plan required: Yes.**

Reason: export and restore are a writer/reader pair over one contract, and a
disagreement between them fails *silently* — a restored database that looks
plausible and is wrong. The document schema must therefore be frozen and owned
before either side is written, which is a real ordering constraint rather than a
preference. `plan.md` fixes the sequence (document contract → export → restore →
CSV → screen), assigns single ownership of `src/domain/backup/` so the two sides
cannot drift, and places the round-trip test as the integration gate.

## Stop Conditions

Implementation must stop rather than invent behavior if:

- the nine-table layout no longer matches §17 field for field — the "no
  translation layer" premise is then false and the contract needs re-deciding;
- a requirement would need a new table, index, or `SCHEMA_VERSION` bump;
- restore cannot be expressed as one Dexie transaction across the eight tables;
- validating a row would require coercing, defaulting, or dropping it;
- a §32 setting is needed to make `/more` coherent — Settings is excluded scope;
- the CSV needs a column not in DEC-B;
- unrelated working-tree changes overlap the write set above.
