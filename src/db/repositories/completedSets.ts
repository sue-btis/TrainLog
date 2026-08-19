/**
 * Completed Sets (§14.8, §11.7, REQ-054, NFR-03).
 *
 * The durability guarantee of the whole product lives in `saveLoggedSet`: a set
 * is on disk the moment it is logged, not at session end, so a phone dying
 * mid-workout costs nothing already entered (§35).
 */

import { db } from '@/db/database';
import type { ExerciseSessionId } from '@/domain/ids';
import type { CompletedSet, ExerciseSession } from '@/domain/types';

/**
 * Persists the pair `logSet` returned: the CompletedSet and the ExerciseSession
 * it moved to `performed` (REQ-054, REQ-056, DEC-009).
 *
 * One transaction, because the two are one fact. A set stored without its
 * status transition would leave an exercise reading `pending` while holding
 * sets; the transition stored without its set would claim work that was lost.
 */
export async function saveLoggedSet(logged: {
  readonly set: CompletedSet;
  readonly exerciseSession: ExerciseSession;
}): Promise<void> {
  await db.transaction('rw', [db.completedSets, db.exerciseSessions], async () => {
    await db.completedSets.add(logged.set);
    await db.exerciseSessions.put(logged.exerciseSession);
  });
}

/** The sets of one exercise, in set order. Index: exerciseSessionId. */
export async function listCompletedSetsByExerciseSession(
  exerciseSessionId: ExerciseSessionId,
): Promise<CompletedSet[]> {
  const sets = await db.completedSets
    .where('exerciseSessionId')
    .equals(exerciseSessionId)
    .toArray();
  return sets.sort((a, b) => a.setNumber - b.setNumber);
}

/** The sets of several exercises at once, grouped by ExerciseSession id. Index: exerciseSessionId. */
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
