# ADR-004 — IndexedDB, through Dexie, as the only store

Status: Accepted
Date: 2026-10-30
Decision owners: Josue
Accepted by: Josue, 2026-10-30, «ADR-002 Sin fecha,ADR-003 Snapshot,ADR-004 IndexedDB/Dexie,ADR-005 Backup»
Related: ADR-001, CON-002, NFR-003, NFR-005, NFR-006, FR-079
Reversibility: one-way — changing engines means migrating every device's stored
history in place.

## Context

ADR-001 keeps all data in the browser. Something has to hold about nine related
record kinds. Each logged set must be written immediately and survive a crash.
Restore must replace everything in one step, and the UI must update when data
changes.

## Decision Drivers

- Each set is durable as soon as it is logged (NFR-003, NFR-005).
- Restore replaces all training data atomically (FR-079).
- Schema changes move forward on devices that already hold data.
- Local actions take under 100 ms (NFR-006).

## Options Considered

### Option A — localStorage

- Benefits:
  - Trivial to use.
- Costs/risks:
  - Synchronous.
  - Holds strings only.
  - No transactions or indexes.
  - A small quota.
- Ruled out by: evidence — no atomic multi-record writes, needed for FR-079.

### Option B — SQLite compiled to WebAssembly, on the Origin Private File System

- Benefits:
  - SQL and relational constraints.
- Costs/risks:
  - Needs a worker and a large WebAssembly payload.
  - Browser support for its persistent mode is uneven (assumed, not probed).

### Option C — IndexedDB through Dexie, with live queries

- Benefits:
  - Native in every target browser.
  - Transactional and indexed.
  - Versioned schema upgrades.
  - Reactive reads through `useLiveQuery`.
  - `fake-indexeddb` lets the repositories be tested in Node.
- Costs/risks:
  - No relational integrity. References are enforced in the repositories.

## Decision

Option C. Nine stores are defined in `src/db/schema.ts`, with forward upgrades per
schema version. Only `db/` touches the stores, and `domain/` stays pure.

## Consequences

### Positive

- Session state lives in the database, so an interrupted Session resumes from it.

### Negative / Trade-offs

- Referential rules, such as delete-if-unused and one Session in progress, live in
  repository code and need tests.

## Verification / Revisit Trigger

- The repository tests run against `fake-indexeddb`.
- Each schema version has an upgrade test.
- Revisit if the queries outgrow indexed lookups, for example cross-entity analytics
  that are too slow in memory.
