import { db } from '@/db/database';
import type { Placement } from '@/domain/types';
import type { RoutineDraft } from '@/domain/routine-file';
import type { RoutineId } from '@/domain/ids';

/** Writes an accepted import atomically. */
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
