import { db } from '@/db/database';
import type { CompletedSetId, ExerciseSessionId } from '@/domain/ids';
import type { CompletedSet, ExerciseSession } from '@/domain/types';

// The set and its performed transition must become visible together.
export async function saveLoggedSet(logged: {
  readonly set: CompletedSet;
  readonly exerciseSession: ExerciseSession;
}): Promise<void> {
  await db.transaction('rw', [db.completedSets, db.exerciseSessions], async () => {
    await db.completedSets.add(logged.set);
    await db.exerciseSessions.put(logged.exerciseSession);
  });
}

export async function saveEditedSet(set: CompletedSet): Promise<void> {
  await db.completedSets.put(set);
}

// Deleting a set, closing ranks, and reverting an empty exercise are one fact.
export async function deleteCompletedSet(removal: {
  readonly removed: CompletedSetId;
  readonly sets: readonly CompletedSet[];
  readonly exerciseSession: ExerciseSession;
}): Promise<void> {
  const { removed, sets, exerciseSession } = removal;

  await db.transaction('rw', [db.completedSets, db.exerciseSessions], async () => {
    const existing = await db.completedSets.get(removed);
    if (existing === undefined) return;

    await db.completedSets.delete(removed);
    if (sets.length > 0) await db.completedSets.bulkPut([...sets]);
    await db.exerciseSessions.put(exerciseSession);
  });
}

export async function listCompletedSetsByExerciseSession(
  exerciseSessionId: ExerciseSessionId,
): Promise<CompletedSet[]> {
  const sets = await db.completedSets
    .where('exerciseSessionId')
    .equals(exerciseSessionId)
    .toArray();
  return sets.sort((a, b) => a.setNumber - b.setNumber);
}

export async function groupCompletedSetsByExerciseSession(
  exerciseSessionIds: readonly ExerciseSessionId[],
): Promise<Map<ExerciseSessionId, CompletedSet[]>> {
  const grouped = new Map<ExerciseSessionId, CompletedSet[]>();
  for (const id of exerciseSessionIds) grouped.set(id, []);
  if (exerciseSessionIds.length === 0) return grouped;

  const sets = await db.completedSets
    .where('exerciseSessionId')
    .anyOf([...exerciseSessionIds])
    .toArray();
  for (const set of sets) grouped.get(set.exerciseSessionId)?.push(set);
  for (const list of grouped.values()) list.sort((a, b) => a.setNumber - b.setNumber);
  return grouped;
}
