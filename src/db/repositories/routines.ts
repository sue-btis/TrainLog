import { db } from '@/db/database';
import type { RoutineId } from '@/domain/ids';
import type { Routine, RoutineStatus } from '@/domain/types';

/** Deletion is refused while Sessions reference the Routine, preserving history. */
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

export async function listRoutines(): Promise<Routine[]> {
  const routines = await db.routines.toArray();
  return routines.sort((a, b) => b.createdAt - a.createdAt);
}

export function listRoutinesByStatus(status: RoutineStatus): Promise<Routine[]> {
  return db.routines.where('status').equals(status).toArray();
}

export function getActiveRoutine(): Promise<Routine | undefined> {
  return db.routines.where('status').equals('active').first();
}

/** Activates one Routine and archives the others in one transaction. */
export async function activateRoutine(id: RoutineId): Promise<void> {
  await db.transaction('rw', db.routines, async () => {
    const active = await db.routines.where('status').equals('active').toArray();
    for (const routine of active) {
      if (routine.id !== id) await db.routines.update(routine.id, { status: 'archived' });
    }
    await db.routines.update(id, { status: 'active' });
  });
}

/** Archive without changing its Sessions. */
export async function archiveRoutine(id: RoutineId): Promise<void> {
  await db.routines.update(id, { status: 'archived' });
}

/**
 * Deletes planning rows only when no Session references the Routine.
 * Exercises remain because history is keyed by exerciseId.
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
