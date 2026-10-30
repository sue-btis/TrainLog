# ADR-001 — System shape: a local-only installable web app

Status: Accepted
Date: 2026-10-30
Decision owners: Josue
Accepted by: Josue, 2026-10-30, «A. Como está hoy (Recommended)»
Related: CON-001, CON-002, CON-004, G-005, NFR-001, NFR-002, NFR-003, NG-001, NG-007
Reversibility: one-way — adding a server means building accounts and sync, and
moving every lifter's local data into it.

## Context

The product has to work at the gym with no connectivity. It must keep the lifter's
data on their device, and it must require no backend, no account and no recurring
cost. This is a retroactive package: option A is the system as it was built.

## Decision Drivers

- The app works fully offline (NFR-001).
- The app sends no data off the device (NFR-002, CON-002).
- No backend, account or paid service (CON-001, G-005).
- Distribution as static files (CON-004).
- A logged set survives the app being killed (NFR-003).

## Options Considered

### Option A — An installable web app that keeps all data in the browser

- Benefits:
  - No running cost and no operations.
  - Data never leaves the device.
  - One codebase serves every phone.
- Costs/risks:
  - The browser may evict the stored data under storage pressure.
  - No background notifications (NG-007).
  - No multi-device use.

### Option B — The same web app, plus a backend with a database and sync

- Benefits:
  - Multi-device use and an automatic off-device copy.
- Costs/risks:
  - Server, accounts, security surface and a monthly cost.
- Ruled out by: CON-001 and NG-001 (no backend, no accounts).

### Option C — A native app from the stores, with an on-device database

- Benefits:
  - Background timer notifications.
  - The operating system does not evict its storage.
- Costs/risks:
  - Store publication and two platforms.
  - A paid Apple developer account; the price is assumed, not verified.
- Ruled out by: CON-004 (static files) and G-005 (no recurring cost).

## Decision

Option A. A single-page app is installed from a static host. All state lives in
browser storage on the device. A service worker serves the app shell offline.

## Consequences

### Positive

- There is nothing to operate, and cost is limited to static hosting.
- Privacy holds by construction: there is no endpoint that could receive data.

### Negative / Trade-offs

- Data durability depends on the browser. The app compensates by requesting
  persistent storage, warning when storage is best-effort, and prompting for
  backups (FR-084, FR-088, FR-089).
- Moving to another device is a manual backup and restore (J-005).

## Verification / Revisit Trigger

- On a real iPhone and a real Android phone, the installed app reports persisted
  storage after a finished Session.
- Revisit if the product decides to support multi-device use or cloud sync. That
  would first need a PRD §15 decision that lifts NG-001.
