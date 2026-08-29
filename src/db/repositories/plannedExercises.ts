import { db } from '@/db/database';
import { newId, type PlannedExerciseId, type WorkoutId } from '@/domain/ids';
import type { PlannedExercise } from '@/domain/types';

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

export async function listPlannedExercisesByWorkout(
  workoutId: WorkoutId,
): Promise<PlannedExercise[]> {
  const planned = await db.plannedExercises.where('workoutId').equals(workoutId).toArray();
  return planned.sort((a, b) => a.order - b.order);
}

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
