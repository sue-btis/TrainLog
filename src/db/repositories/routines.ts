/**
 * Routines (§11.2, §37, REQ-075, REQ-076).
 *
 * A Routine is immutable once accepted — importing again creates a new one —
 * so the only writes here are the lifecycle ones: activate, archive, delete.
 */

import { db } from '@/db/database';
import type { RoutineId } from '@/domain/ids';
import type { Routine, RoutineStatus } from '@/domain/types';

/**
 * Thrown when `deleteRoutine` is refused because Sessions reference the
 * Routine. Deleting it would destroy history (§25), so §37 offers archiving
 * instead, and the message says so — callers surface it verbatim.
 */
export class RoutineHasSessionsError extends Error {
  readonly routineId: RoutineId;
  readonly sessionCount: number;

  constructor(routineId: RoutineId, sessionCount: number) {
    super(
      `Routine ${routineId} cannot be deleted: ${sessionCount} session(s) reference it. Archive it instead.`,
    );
    this.name = 'RoutineHasSessionsError';
    this.routineId = routineId;
    this.sessionCount = sessionCount;
  }
}

export function getRoutine(id: RoutineId): Promise<Routine | undefined> {
  return db.routines.get(id);
}

/** Every Routine, newest import first (§11.2 list). */
export async function listRoutines(): Promise<Routine[]> {
  const routines = await db.routines.toArray();
  return routines.sort((a, b) => b.createdAt - a.createdAt);
}

/** Index: status. */
export function listRoutinesByStatus(status: RoutineStatus): Promise<Routine[]> {
  return db.routines.where('status').equals(status).toArray();
}

/** The active Routine, or `undefined`. At most one exists (REQ-076). Index: status. */
export function getActiveRoutine(): Promise<Routine | undefined> {
  return db.routines.where('status').equals('active').first();
}

/**
 * Makes `id` the active Routine and archives every other active one, so at
 * most one Routine is `active` afterwards (REQ-076, AC-078). One transaction,
 * so the invariant never has a window where it is false.
 */
export async function activateRoutine(id: RoutineId): Promise<void> {
  await db.transaction('rw', db.routines, async () => {
    const active = await db.routines.where('status').equals('active').toArray();
    for (const routine of active) {
      if (routine.id !== id) await db.routines.update(routine.id, { status: 'archived' });
    }
    await db.routines.update(id, { status: 'active' });
  });
}

/** Archiving is the alternative §37 offers to deletion. Sessions are untouched. */
export async function archiveRoutine(id: RoutineId): Promise<void> {
  await db.routines.update(id, { status: 'archived' });
}

/**
 * Deletes a Routine and its planning rows, and is refused while any Session
 * references it (REQ-075, §11.2, §37).
 *
 * Exercises are deliberately left behind: they are independent of any Routine
 * and history is tracked against them (§14.1, §26).
 */
export async function deleteRoutine(id: RoutineId): Promise<void> {
  await db.transaction(
    'rw',
    [db.routines, db.workouts, db.plannedExercises, db.placements, db.sessions],
    async () => {
      const sessionCount = await db.sessions.where('routineId').equals(id).count();
      if (sessionCount > 0) throw new RoutineHasSessionsError(id, sessionCount);

      const workoutIds = (await db.workouts.where('routineId').equals(id).toArray()).map(
        (workout) => workout.id,
      );
      await db.plannedExercises.where('workoutId').anyOf(workoutIds).delete();
      await db.workouts.where('routineId').equals(id).delete();
      await db.placements.where('routineId').equals(id).delete();
      await db.routines.delete(id);
    },
  );
}
