import { db } from '@/db/database';
import { formatLocalDate, type LocalDate } from '@/domain/dates';
import type { Placement } from '@/domain/types';
import type { RoutineDraft } from '@/domain/routine-file';
import type { RoutineId } from '@/domain/ids';

export interface ImportOptions {
  /**
   * Remove the placements of the Routines this import archives that fall on or
   * after this date and that no Session answered. Sessions are never touched.
   */
  readonly removePlacementsFrom?: LocalDate;
}

/** Writes an accepted import atomically. */
export async function importRoutine(
  draft: RoutineDraft,
  placements: readonly Placement[],
  options: ImportOptions = {},
): Promise<RoutineId> {
  await db.transaction(
    'rw',
    [db.routines, db.workouts, db.plannedExercises, db.exercises, db.placements, db.sessions],
    async () => {
      if (draft.routine.status === 'active') {
        const active = await db.routines.where('status').equals('active').toArray();
        for (const routine of active) {
          await db.routines.update(routine.id, { status: 'archived' });
        }
        if (options.removePlacementsFrom !== undefined) {
          await removeUnanswered(
            active.map((routine) => routine.id),
            options.removePlacementsFrom,
          );
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

async function removeUnanswered(routineIds: readonly RoutineId[], from: LocalDate): Promise<void> {
  if (routineIds.length === 0) return;
  const sessions = await db.sessions.where('routineId').anyOf(routineIds).toArray();
  const answered = new Set(
    sessions.map(
      (session) => `${session.workoutId}|${formatLocalDate(new Date(session.startedAt))}`,
    ),
  );
  const doomed = (await db.placements.where('routineId').anyOf(routineIds).toArray())
    .filter(
      (placement) =>
        placement.date >= from && !answered.has(`${placement.workoutId}|${placement.date}`),
    )
    .map((placement) => placement.id);
  await db.placements.bulkDelete(doomed);
}
