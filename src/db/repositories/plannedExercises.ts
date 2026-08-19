/** Planned Exercises (§14.4). Read-only, like the Routine that owns them. */

import { db } from '@/db/database';
import type { PlannedExerciseId, WorkoutId } from '@/domain/ids';
import type { PlannedExercise } from '@/domain/types';

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
