# ADR-003 — Snapshot planned targets when a Session starts

Status: Accepted
Date: 2026-10-30
Decision owners: Josue
Accepted by: Josue, 2026-10-30, «ADR-002 Sin fecha,ADR-003 Snapshot,ADR-004 IndexedDB/Dexie,ADR-005 Backup»
Related: FR-036, FR-022, FR-023, BR-001, BR-002, BR-004, BR-006
Reversibility: one-way — dropping the snapshot means past Sessions lose the plan
they were performed against.

## Context

A past Session must keep saying what was planned, even after the Routine changes:
additions, a re-import, or future editing. The product separates planned training
from actual training (BR-001).

## Decision Drivers

- History must not be rewritten by later template changes (BR-002).
- Additions to an active Routine must be safe (BR-004).
- A corrected re-import must not reset progression (BR-006).

## Options Considered

### Option A — Reference the Planned Exercise by id

- Benefits:
  - No duplication.
- Costs/risks:
  - Any later template edit rewrites what past Sessions claim was planned.
- Ruled out by: BR-001 and BR-002.

### Option B — Copy-on-write versioning of Planned Exercises

- Benefits:
  - History stays true.
- Costs/risks:
  - Lineage, version resolution, and rows that exist only for old data to point at.

### Option C — Copy the targets into an Exercise Session for each exercise when the Session starts

- Benefits:
  - A past Session renders from itself alone.
  - Templates become safely editable without versioning.
- Costs/risks:
  - A little duplicated data per Exercise Session.

## Decision

Option C. When a Session starts, one Exercise Session is created for each Planned
Exercise of its Workout. Each one receives a copy of that exercise's sets, target
range, RIR range, rest, unit, progression rule and measurement type
(`startWorkout` in `src/domain/session/index.ts`). An unplanned exercise is created
when it is added.
Progression is keyed by Exercise, not by Planned Exercise.

## Consequences

### Positive

- No Routine versioning is needed. Additions shipped without it.

### Negative / Trade-offs

- Changing the snapshot shape needs a database migration and a new backup version
  (see ADR-004 and ADR-005).

## Verification / Revisit Trigger

- No read path rebuilds a past Session by joining it to its Planned Exercises. The
  history and session tests cover this.
