/**
 * Planned Exercises (§14.4).
 *
 * Additive, like the Routine that owns them (DEC-B): a Planned Exercise may be
 * added to a Workout of the active Routine, and nothing already stored is
 * rewritten, reordered or removed. A Session that has already run keeps the
 * targets it snapshotted (ADR 0002), so an addition here cannot change what any
 * past training says it was.
 */

import { db } from '@/db/database';
import { newId, type PlannedExerciseId, type WorkoutId } from '@/domain/ids';
import type { PlannedExercise } from '@/domain/types';

/** Thrown when the Workout an add names does not exist (REQ-411). */
export class WorkoutNotFoundError extends Error {
  constructor(workoutId: WorkoutId) {
    super(`Workout ${workoutId} does not exist.`);
    this.name = 'WorkoutNotFoundError';
  }
}

export function getPlannedExercise(
  id: PlannedExerciseId,
): Promise<PlannedExercise | undefined> {
  return db.plannedExercises.get(id);
}

/** One Workout's exercises in file order (`order`). Index: workoutId. */
export async function listPlannedExercisesByWorkout(
  workoutId: WorkoutId,
): Promise<PlannedExercise[]> {
  const planned = await db.plannedExercises.where('workoutId').equals(workoutId).toArray();
  return planned.sort((a, b) => a.order - b.order);
}

/**
 * Adds a Planned Exercise to the end of a Workout (REQ-407, REQ-408, REQ-411,
 * REQ-412).
 *
 * One transaction over the two tables it touches. The Workout is read inside
 * it, both to refuse an id that names nothing and because `order` is computed
 * from its siblings — a value that goes stale the moment another add lands.
 *
 * It creates no Exercise. `exerciseId` arrives already resolved to a catalog
 * entry or to one the lifter owns, which is why this path cannot split a
 * movement in two: there is no name to match and therefore no matching to get
 * wrong (§26).
 *
 * The targets are not re-checked here. `min_reps > max_reps` and its siblings
 * are semantic issues, and DEC-Q1 puts them in the form — which checks them
 * with `validateRoutineFile` itself, through `plannedExerciseDraftFile`, rather
 * than with a second implementation that would drift from the wizard's.
 */
export async function addPlannedExercise(
  workoutId: WorkoutId,
  input: Omit<PlannedExercise, 'id' | 'workoutId' | 'order'>,
): Promise<PlannedExerciseId> {
  return db.transaction('rw', [db.workouts, db.plannedExercises], async () => {
    const workout = await db.workouts.get(workoutId);
    if (workout === undefined) throw new WorkoutNotFoundError(workoutId);

    const siblings = await db.plannedExercises.where('workoutId').equals(workoutId).toArray();
    const order = siblings.reduce(
      (highest, planned) => Math.max(highest, planned.order + 1),
      0,
    );

    const planned: PlannedExercise = { ...input, id: newId<PlannedExerciseId>(), workoutId, order };
    await db.plannedExercises.add(planned);
    return planned.id;
  });
}
