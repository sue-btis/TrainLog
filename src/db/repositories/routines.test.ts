import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import {
  RoutineHasSessionsError,
  activateRoutine,
  archiveRoutine,
  deleteRoutine,
  getActiveRoutine,
  listRoutines,
  listRoutinesByStatus,
} from '@/db/repositories/routines';
import { listWorkoutsByRoutine } from '@/db/repositories/workouts';
import { listPlannedExercisesByWorkout } from '@/db/repositories/plannedExercises';
import { listPlacementsByRoutine } from '@/db/repositories/placements';
import { importRoutine } from '@/db/repositories/import';
import { aFile, anExercise, aWorkout } from '@/domain/routine-file/fixtures';
import { routineFileToDomain, type RoutineDraft } from '@/domain/routine-file';
import { generatePlacements } from '@/domain/scheduling';
import { toLocalDate } from '@/domain/dates';
import { newId, type SessionId } from '@/domain/ids';
import type { RoutineId } from '@/domain/ids';
import type { Session } from '@/domain/types';

const ANCHOR = toLocalDate('2026-09-07');

async function importFixture(name: string, createdAt: number): Promise<RoutineDraft> {
  const file = aFile([
    aWorkout({
      name: 'Push',
      suggested_days: ['monday'],
      exercises: [anExercise({ name: 'Front Squat', exercise_id: 'front-squat' })],
    }),
  ]);
  const draft = routineFileToDomain(
    { ...file, routine: { ...file.routine, name } },
    { defaultUnit: 'kg', existingExercises: [], createdAt },
  );
  await importRoutine(
    draft,
    generatePlacements({
      workouts: draft.workouts,
      weeks: draft.routine.weeks,
      anchorDate: ANCHOR,
    }),
  );
  return draft;
}

async function addSessionFor(routineId: RoutineId, workoutId: RoutineDraft['workouts'][number]['id']) {
  const session: Session = {
    id: newId<SessionId>(),
    routineId,
    workoutId,
    startedAt: 1_757_300_000_000,
    completedAt: null,
    status: 'in_progress',
    bodyweightKg: null,
  };
  await db.sessions.add(session);
  return session;
}

beforeEach(resetDatabase);

describe('TST-020 activateRoutine', () => {
  it('leaves exactly one active Routine', async () => {
    const first = await importFixture('August Hybrid', 1_754_000_000_000);
    const second = await importFixture('September Hybrid', 1_757_000_000_000);
    await db.routines.update(first.routine.id, { status: 'active' });
    expect(await listRoutinesByStatus('active')).toHaveLength(2);

    await activateRoutine(second.routine.id);

    const active = await listRoutinesByStatus('active');
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe(second.routine.id);
    expect((await getActiveRoutine())?.name).toBe('September Hybrid');
    expect((await db.routines.get(first.routine.id))?.status).toBe('archived');
  });

  it('is idempotent for the already-active Routine', async () => {
    const only = await importFixture('September Hybrid', 1_757_000_000_000);

    await activateRoutine(only.routine.id);
    await activateRoutine(only.routine.id);

    expect(await listRoutinesByStatus('active')).toHaveLength(1);
    expect((await getActiveRoutine())?.id).toBe(only.routine.id);
  });

  it('lists routines newest first', async () => {
    await importFixture('August Hybrid', 1_754_000_000_000);
    await importFixture('September Hybrid', 1_757_000_000_000);

    expect((await listRoutines()).map((routine) => routine.name)).toEqual([
      'September Hybrid',
      'August Hybrid',
    ]);
  });
});

describe('TST-019 deleteRoutine', () => {
  it('is refused while a Session references the Routine, and names archiving', async () => {
    const draft = await importFixture('September Hybrid', 1_757_000_000_000);
    const workout = draft.workouts[0];
    if (!workout) throw new Error('fixture must generate a workout');
    await addSessionFor(draft.routine.id, workout.id);

    await expect(deleteRoutine(draft.routine.id)).rejects.toBeInstanceOf(RoutineHasSessionsError);
    await expect(deleteRoutine(draft.routine.id)).rejects.toThrow(/Archive it instead/);

    expect(await db.routines.get(draft.routine.id)).toBeDefined();
    expect(await listWorkoutsByRoutine(draft.routine.id)).toHaveLength(1);
    expect(await listPlacementsByRoutine(draft.routine.id)).toHaveLength(4);
    expect(await db.sessions.count()).toBe(1);
  });

  it('archiving is the alternative, and leaves Sessions untouched', async () => {
    const draft = await importFixture('September Hybrid', 1_757_000_000_000);
    const workout = draft.workouts[0];
    if (!workout) throw new Error('fixture must generate a workout');
    const session = await addSessionFor(draft.routine.id, workout.id);

    await archiveRoutine(draft.routine.id);

    expect((await db.routines.get(draft.routine.id))?.status).toBe('archived');
    expect(await db.sessions.get(session.id)).toEqual(session);
  });

  it('is permitted once no Session references it, and removes its planning rows', async () => {
    const draft = await importFixture('September Hybrid', 1_757_000_000_000);
    const workout = draft.workouts[0];
    if (!workout) throw new Error('fixture must generate a workout');
    const session = await addSessionFor(draft.routine.id, workout.id);
    await db.sessions.delete(session.id);

    await deleteRoutine(draft.routine.id);

    expect(await db.routines.get(draft.routine.id)).toBeUndefined();
    expect(await listWorkoutsByRoutine(draft.routine.id)).toEqual([]);
    expect(await listPlannedExercisesByWorkout(workout.id)).toEqual([]);
    expect(await listPlacementsByRoutine(draft.routine.id)).toEqual([]);
  });

  it('leaves another Routine intact', async () => {
    const doomed = await importFixture('August Hybrid', 1_754_000_000_000);
    const kept = await importFixture('September Hybrid', 1_757_000_000_000);

    await deleteRoutine(doomed.routine.id);

    expect(await db.routines.get(kept.routine.id)).toBeDefined();
    expect(await listWorkoutsByRoutine(kept.routine.id)).toHaveLength(1);
    expect(await listPlacementsByRoutine(kept.routine.id)).toHaveLength(4);
  });
});
