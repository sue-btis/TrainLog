/**
 * Accepting an import (REQ-074, §11.1).
 *
 * §11.1 is explicit that a routine "no se almacena hasta que el usuario
 * acepta". Acceptance is therefore a single Dexie transaction over the Routine,
 * its Workouts, its PlannedExercises, the user Exercises the import had to
 * create, and the generated Placements. Any failure aborts the whole
 * transaction and leaves no partial routine behind (AC-075).
 *
 * The draft and the placements are produced by the domain
 * (`routineFileToDomain`, `generatePlacements`) and arrive fully formed: this
 * function decides nothing, it only writes.
 *
 * The one thing it does decide is which Routine is current. A draft always
 * arrives `active` — an import is the user saying "this is what I am running
 * now" — and at most one Routine may be active (REQ-076, §11.2), so the
 * previously active one is archived in the same transaction. Archiving keeps
 * its Sessions and its history intact (§37); only deletion is refused.
 */

import { db } from '@/db/database';
import type { Placement } from '@/domain/types';
import type { RoutineDraft } from '@/domain/routine-file';
import type { RoutineId } from '@/domain/ids';

/**
 * Writes an accepted import atomically and returns the new Routine's id.
 *
 * `bulkAdd` rather than `bulkPut` throughout: every id in a draft is freshly
 * generated, so a key that already exists means the caller handed us something
 * it did not generate, and failing loudly inside the transaction is the
 * correct outcome.
 *
 * `createdExercises` holds user-created Exercises only — catalog Exercises are
 * never written to the table (DEC-007, REQ-071, AC-022) because
 * `routineFileToDomain` marks them as not created.
 */
export async function importRoutine(
  draft: RoutineDraft,
  placements: readonly Placement[],
): Promise<RoutineId> {
  await db.transaction(
    'rw',
    [db.routines, db.workouts, db.plannedExercises, db.exercises, db.placements],
    async () => {
      if (draft.routine.status === 'active') {
        const active = await db.routines.where('status').equals('active').toArray();
        for (const routine of active) {
          await db.routines.update(routine.id, { status: 'archived' });
        }
      }
      await db.routines.add(draft.routine);
      await db.workouts.bulkAdd(draft.workouts);
      await db.plannedExercises.bulkAdd(draft.plannedExercises);
      await db.exercises.bulkAdd(draft.createdExercises);
      await db.placements.bulkAdd(placements);
    },
  );

  return draft.routine.id;
}
