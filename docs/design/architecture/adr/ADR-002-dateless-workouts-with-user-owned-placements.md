# ADR-002 — Dateless Workouts with user-owned Placements

Status: Accepted
Date: 2026-10-30
Decision owners: Josue
Accepted by: Josue, 2026-10-30, «ADR-002 Sin fecha,ADR-003 Snapshot,ADR-004 IndexedDB/Dexie,ADR-005 Backup»
Related: FR-010–FR-013, FR-026–FR-028, FR-030, BR-008–BR-011
Reversibility: one-way — keying Workouts by date would change the routine file
contract and every stored Placement.

## Context

A routine file has to say when each Workout is trained. Lifters routinely move one
session to another day. They train the same Workout twice in a week, or rotate more
Workouts than they have training days.

## Decision Drivers

- Moving a single session must not change the programme (FR-027, BR-008).
- A missed day must not need a background job or stored state (BR-009).
- A file must be able to express rotations and repeats (CON-003).

## Options Considered

### Option A — Workouts keyed by weekday, plus a routine start date

- Benefits:
  - A simple file.
- Costs/risks:
  - It cannot express the same Workout twice a week, a rotation longer than the
    week, or two Workouts in one day.
  - Moving a session becomes an edit of the programme.
- Ruled out by: evidence — the primary behaviour is moving individual sessions.

### Option B — Recurrence rules ("Pull every Monday")

- Benefits:
  - A compact schedule.
- Costs/risks:
  - Every move becomes an exception to the pattern.
- Ruled out by: evidence — this models the primary behaviour worst.

### Option C — Dateless Workouts with advisory suggested days, which seed individual Placements

- Benefits:
  - Placements are plain rows the lifter moves or deletes.
  - Missed is derived from the absence of a Session.
- Costs/risks:
  - The calendar ends where the generated block ends (`weeks`).

## Decision

Option C. A file declares Workouts in order, with advisory `suggested_days` and no
start date. The import wizard generates Placements bounded by `weeks`. From then on,
the lifter owns them.

## Consequences

### Positive

- `scheduled` and `skipped` are not stored states.
- Missed is computed at query time, with no background job.

### Negative / Trade-offs

- A Placement past the end of the block has to be added by adding a Workout, or by
  importing again.

## Verification / Revisit Trigger

- The `domain/scheduling` tests cover generation, early-session coverage and Missed.
- Revisit if recurring open-ended programmes become a product requirement.
