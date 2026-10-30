# TrainLog Product Brief

Design size: standard

Retroactive package: TrainLog already exists, and its target state is the behaviour
the code has today. The code is the evidence. Where a document disagrees with the
code, the document is the drift.

## Problem

A lifter on structured programming needs a few things in the gym: what today's
workout prescribes, what they did last time on each exercise, and what load comes
next. Usually there is no reliable internet. Spreadsheets and notes apps lose that
link between plan and performance, and they leave the load maths to the lifter.

## Target Users and Context

- Primary user: the author. They train with weight, reps and RIR, and they revise
  their own routines from time to time (`PRODUCT.md:19-24`).
- Secondary users: lifters the author knows personally. There is no public or
  self-serve audience and no marketing surface (`PRODUCT.md:21-24`).
- Usage context: a phone at the gym, using the installed PWA, with no network assumed
  (`PRODUCT.md:26-27`).

## Desired Outcomes

- OUT-001 — A whole training block runs with no network request, no unrecorded set
  and no manual load maths (`PRODUCT.md:35-37`).
- OUT-002 — The lifter sees the previous performance and a load suggestion before
  each exercise.
- OUT-003 — Planned and actual training stay separate. History survives re-importing
  a corrected routine file (`AGENTS.MD:65-66`).
- OUT-004 — The lifter's data never leaves the device except by an explicit backup
  or CSV export they ask for (`PRODUCT.md:68`).

## Scope

Included. These capabilities exist today; routes are in `src/App.tsx:28-49`.

- Routine import from a YAML file, with a review step (`/import`). In-app routine
  authoring with the same wizard.
- Routine management: accepted routines take additions only (`/routines`).
- A calendar of Placements that the user controls (`/calendar`), plus Today (`/today`).
- Session execution (`/session`): set logging, a rest timer with wake lock, a
  stopwatch for timed sets, previous performance, and double progression.
- Nine measurement types, each declared on the Exercise.
- The shipped exercise catalog, user exercises (create, rename, delete-if-unused),
  and per-exercise history (`/exercises`, `/sessions/:id`).
- A progress dashboard: estimated 1RM, PRs, session effort, and muscle volume for the
  current week (`/progress`).
- Settings (`/settings`), including bodyweight.
- Backup and restore, optionally encrypted with a password. Restore replaces
  everything. CSV export.
- An installable PWA that is fully offline.

Excluded:

- Accounts, cloud sync, multi-device sync, social features, nutrition, wearables and
  AI coaching (`PRODUCT.md:79-80`).
- Any backend, telemetry or runtime network request (`AGENTS.MD:55-57`).
- Rest-timer notifications, and merge-on-restore.
- The V1.0 items still pending. They are not part of this baseline: workout volume,
  adherence, calendar statistics, advanced charts, warm-up sets, supersets, drop
  sets, deload, custom progression strategies, past-week muscle volume, and deleting
  a session (`docs/PRD.md:2520-2553`).

## Constraints

- CON-001 — Offline-first. The app has no backend and no runtime network requests,
  and the catalog ships inside the build (`PRODUCT.md:81-82`). A grep of non-test
  `src/` for network APIs found none.
- CON-002 — All data is stored locally in the browser, in IndexedDB
  (`src/db/schema.ts:27-42`).
- CON-003 — The routine file is YAML. Its format is the public contract in
  `docs/FORMAT.md`, and `version` accepts 1 or 2 (`src/domain/routine-file/schema.ts:55`).
- CON-004 — The backup document is at version 3 (`src/domain/backup/document.ts:16`).
  An encrypted backup is a `trainlog-encrypted-backup` envelope, version 1
  (`src/domain/backup/encryption.ts:3,20`). Old backups must keep restoring.
- CON-005 — Static deployment. The app is served as Cloudflare Workers static
  assets with an SPA fallback (`wrangler.jsonc:5-9`).
- CON-006 — The vocabulary in `CONTEXT.md` is binding on identifiers as well as on
  prose (`AGENTS.MD`).
- CON-007 — Repository artifacts are written in English. The UI is in English.

## Core Domain Language

`CONTEXT.md` is the authority for these terms. This table only indexes them.

| Term | Meaning |
|---|---|
| Routine | A complete programme. Once accepted it takes additions only. |
| Routine Draft | The editable Routine in the wizard, before Accept. Nothing about it is stored. |
| Workout | A reusable unit of programming with no date. |
| Placement | The assignment of a Workout to a date. The user owns it and may move or delete it. |
| Missed | A past Placement with no Session for it. Derived, never stored. |
| Session | One performed training. |
| Planned Exercise / Exercise Session | One exercise as programmed / as performed. |
| Completed Set | The atomic unit of history. An RIR of `null` is not 0. |
| Snapshot | A copy of the planned targets, taken when the Session starts. |
| Measurement | One of nine types, declared on the Exercise. |
| Progression Rule | How the load advances for a Planned Exercise. |
| Effort | Effort index: mean RPE × minutes. Derived, unitless. |

## Approved Product Decisions

These are the stakeholder's choices in this conversation, made on 2026-10-30.

- The baseline documents the system as it exists. No product change is planned.
- The real training blocks (`bloque-*.yaml`) stay in `docs/examples/` as fixtures.
- `docs/PRD-DMS.md` and `docs/PRD-TEMPLATE.md` are not TrainLog documents and are
  removed.
- Dateless Workouts with Placements the user owns (`docs/adr/0001-*`), and planned
  targets snapshotted when a session starts (`docs/adr/0002-*`). Both ADRs remain in
  force.

## Open Product Decisions

These decisions moved to PRD §15, which is now their only register. PD-A became
PD-004, which is Decided. PD-B became PD-005, which is still Open.

## Discovery

Depth: none. This is a retroactive baseline built on known patterns, and every
question here can be answered from the repository.

| ID | Evidence question | Unblocks |
|---|---|---|
| — | None | — |

## Artifact Applicability

| Artifact | Required? | Reason |
|---|---:|---|
| PRD | Yes | Product authority. It replaces `docs/PRD.md` (PD-A). |
| Domain model | Yes | Invariants (additions only, derived Missed, unit per set, Snapshot) live today in AGENTS.MD and CONTEXT.md. CONTEXT.md stays the glossary. |
| Structurizr DSL | Yes | One container (the SPA, its service worker and IndexedDB), the static host, and the layering rule `features → db → domain`. |
| ADR | Yes | Keep 0001 and 0002. Add ADRs only for decisions that are already consequential, such as local-only storage with no backend, and backup encryption. |
| DBML | Yes | Nine Dexie tables at schema v3, with their upgrades (`src/db/schema.ts:30-66`). |
| OpenAPI | No | There is no HTTP API. |
| AsyncAPI | No | There are no event contracts. |
| Mermaid flows | Yes | The import→review→accept flow, session execution with progression, and backup/restore. |
| HTML prototype | No | The app exists. The screenshots in `docs/screenshots/` cover the visuals. |
| Quality attributes | Yes | Offline operation, data durability (storage eviction and the backup cadence), backup confidentiality, and installability. |
| File contracts | Yes, existing | `docs/FORMAT.md` stays the authority for the routine file, and the manifest declares it. Its YAML blocks are checked by `format-doc.test.ts`. |

## Drifts (retroactive packages only)

Here the target is the code, so each drift is a document that has gone stale. The
package fixes each one where it supersedes that document.

| ID | What differs from the target | Evidence | Affects |
|---|---|---|---|
| DR-001 | PRODUCT.md says no application code, screenshots or deployment exist. All three do. | `PRODUCT.md:128-129` vs `src/App.tsx:28`, `docs/screenshots/`, `README.MD:11` | PRD overview |
| DR-002 | PRODUCT.md says the unit is fixed per Exercise. In the code, the unit belongs to the Completed Set, and the Planned Exercise only seeds it. | `PRODUCT.md:88-89` vs `AGENTS.MD:78-81` | Weight/unit rules |
| DR-003 | PRODUCT.md says only `completed` Sessions feed progression. A `partial` Session in which the exercise was fully performed also counts. | `PRODUCT.md:92` vs `AGENTS.MD:66-68` | Progression rules |
| DR-004 | The MVP scope in PRODUCT.md leaves out in-app authoring, measurement types and encrypted backup, all of which ship. | `PRODUCT.md:75-78` vs `README.MD:82-95`, `src/domain/backup/encryption.ts:3` | Scope |
| DR-005 | The PRD names Cloudflare Pages as the host. The repo deploys as Workers static assets. | `docs/PRD.md:239,357` vs `wrangler.jsonc:5-9` | Deployment NFRs |
| DR-006 | The PRD's backup example shows version 1. The code writes version 3. | `docs/PRD.md:1584` vs `src/domain/backup/document.ts:16` | Backup contract |
| DR-007 | The PRD status table is headed "verificado 2026-08-21" but contains rows from 2026-10-23, and it links to the deleted `docs/changes/` folders. | `docs/PRD.md:2447,2530-2556` | Status traceability |

| DR-008 | The PRD says the rest timer is rebuilt from a stored timestamp. Only the countdown from the logged set survives a reload; pause and added time are component state and are lost. | `docs/PRD.md:2378-2379` vs `src/features/session/RestTimer.tsx:25-27` | FR-050, NFR-004 |
| DR-009 | The PRD lists eight semantic checks. The code and FORMAT.md have twelve. | `docs/PRD.md:572-581` vs `src/domain/routine-file/validate.ts:7-19` | FR-003 |
| DR-010 | The PRD says the timer cue is vibration and sound. The sound defaults to off. The PRD also lists Delete Session and Clear Data as confirmed actions, but neither exists in the app. | `docs/PRD.md:2413-2417` vs `src/db/repositories/settings.ts:8-17`, `README.MD:102-108` | UX-005 |

Not verified: the PRD's §11–§48 were not read in full, so this list of drifts may be
incomplete. `designing-system` should check the PRD's requirements against the code
when it writes the domain model and the DBML.
