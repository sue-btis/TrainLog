/**
 * Completed Sets (§14.8, §11.7, REQ-054, NFR-03).
 *
 * The durability guarantee of the whole product lives in `saveLoggedSet`: a set
 * is on disk the moment it is logged, not at session end, so a phone dying
 * mid-workout costs nothing already entered (§35).
 */

import { db } from '@/db/database';
import type { CompletedSetId, ExerciseSessionId } from '@/domain/ids';
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

/**
 * R-4 — overwrites a set corrected by `editSet`.
 *
 * A correction touches nothing but the row itself: the set still belongs to the
 * same exercise at the same position, and no status can change, because the
 * exercise still holds exactly the sets it held before.
 */
export async function saveEditedSet(set: CompletedSet): Promise<void> {
  await db.completedSets.put(set);
}

/**
 * R-4 — removes a set and stores what `removeSet` returned with it (§37).
 *
 * One transaction, because a deletion is three facts that are only true
 * together: the row is gone, the survivors have closed ranks into a contiguous
 * `1..n`, and an exercise left with no sets counts as undone again. Written
 * separately, a failure between them could leave two sets sharing position 2,
 * or an exercise reading `performed` while holding nothing — which
 * `deriveSessionStatus` would then let a Session finish `completed` on
 * (DEC-009).
 *
 * `removed` is what the caller asked to delete. When `removeSet` found no such
 * set it returns the list untouched, and the guard below turns the whole call
 * into a no-op rather than opening a transaction to write what is already there.
 */
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
