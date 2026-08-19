/** Workouts (§14.3). Read-only: a Routine is immutable once accepted (§11.2). */

import { db } from '@/db/database';
import type { RoutineId, WorkoutId } from '@/domain/ids';
import type { Workout } from '@/domain/types';

export function getWorkout(id: WorkoutId): Promise<Workout | undefined> {
  return db.workouts.get(id);
}

/** A Routine's Workouts in rotation order (`order`, §11.4). Index: routineId. */
export async function listWorkoutsByRoutine(routineId: RoutineId): Promise<Workout[]> {
  const workouts = await db.workouts.where('routineId').equals(routineId).toArray();
  return workouts.sort((a, b) => a.order - b.order);
}
