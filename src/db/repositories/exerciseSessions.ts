import { db } from '@/db/database';
import type { ExerciseSessionId, SessionId } from '@/domain/ids';
import type { ExerciseSession } from '@/domain/types';

export function getExerciseSession(
  id: ExerciseSessionId,
): Promise<ExerciseSession | undefined> {
  return db.exerciseSessions.get(id);
}

export async function addExerciseSession(exerciseSession: ExerciseSession): Promise<void> {
  await db.exerciseSessions.add(exerciseSession);
}

// The performed transition is written with its first set by saveLoggedSet.
export async function saveExerciseSession(exerciseSession: ExerciseSession): Promise<void> {
  await db.exerciseSessions.put(exerciseSession);
}

// Reordering writes all positions together so duplicate orders are not visible.
export async function saveExerciseSessions(
  exerciseSessions: readonly ExerciseSession[],
): Promise<void> {
  if (exerciseSessions.length === 0) return;
  await db.exerciseSessions.bulkPut([...exerciseSessions]);
}

export async function listExerciseSessionsBySession(
  sessionId: SessionId,
): Promise<ExerciseSession[]> {
  const exercises = await db.exerciseSessions.where('sessionId').equals(sessionId).toArray();
  return exercises.sort((a, b) => a.order - b.order);
}

export function listExerciseSessionsByExercise(
  exerciseId: ExerciseSession['exerciseId'],
): Promise<ExerciseSession[]> {
  return db.exerciseSessions.where('exerciseId').equals(exerciseId).toArray();
}
