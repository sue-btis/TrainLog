import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import {
  deleteCompletedSet,
  listCompletedSetsByExerciseSession,
  saveEditedSet,
  saveLoggedSet,
} from '@/db/repositories/completedSets';
import { getExerciseSession } from '@/db/repositories/exerciseSessions';
import { editSet, logSet, removeSet, startPlannedExercise } from '@/domain/session';
import { toId } from '@/domain/ids';
import type {
  CompletedSetId,
  ExerciseId,
  PlannedExerciseId,
  SessionId,
  WorkoutId,
} from '@/domain/ids';
import type { CompletedSet, PlannedExercise, PlannedExerciseSession } from '@/domain/types';
import { toKg } from '@/domain/units';

const measurement = 'weight_reps' as const;

const sessionId = toId<SessionId>('session-1');
const workoutId = toId<WorkoutId>('workout-1');

const planned: PlannedExercise = {
  id: toId<PlannedExerciseId>('pe-1'),
  workoutId,
  exerciseId: toId<ExerciseId>('back-squat'),
  sets: 4,
  minReps: 4,
  maxReps: 6,
  minTarget: null,
  maxTarget: null,
  minRir: 1,
  maxRir: 2,
  restSeconds: 180,
  unit: 'kg',
  focus: null,
  notes: [],
  order: 0,
  progression: { type: 'double_progression', increment: 2.5 },
};

async function seed(count: number): Promise<{
  exercise: PlannedExerciseSession;
  sets: CompletedSet[];
}> {
  let exercise = startPlannedExercise({ measurement, sessionId, planned, order: 0 });
  await db.exerciseSessions.add(exercise);

  const sets: CompletedSet[] = [];
  for (let index = 0; index < count; index++) {
    const logged = logSet({
      exerciseSession: exercise,
      setNumber: index + 1,
      weight: 100,
      unit: 'kg',
      reps: 6 - index,
      rir: 2,
      completedAt: 2_000 + index,
    });
    await saveLoggedSet(logged);
    sets.push(logged.set);
    exercise = logged.exerciseSession;
  }
  return { exercise, sets };
}

beforeEach(async () => {
  await resetDatabase();
});

describe('saveEditedSet (R-4, AC-11)', () => {
  it('overwrites the set in place, weightKg included', async () => {
    const { sets } = await seed(1);

    await saveEditedSet(editSet({ set: sets[0]!, weight: 60, unit: 'lb', reps: 3, rir: 0 }));

    db.close();
    await db.open();

    const [stored] = await listCompletedSetsByExerciseSession(sets[0]!.exerciseSessionId);
    expect(stored).toMatchObject({
      id: sets[0]!.id,
      weight: 60,
      unit: 'lb',
      weightKg: toKg(60, 'lb'),
      reps: 3,
      rir: 0,
      setNumber: 1,
    });
  });

  it('does not multiply the set', async () => {
    const { sets } = await seed(2);

    await saveEditedSet(editSet({ set: sets[0]!, weight: 105, unit: 'kg', reps: 5, rir: 1 }));

    expect(await db.completedSets.count()).toBe(2);
  });
});

describe('deleteCompletedSet (R-4, AC-12, AC-13)', () => {
  it('removes the set and renumbers the survivors, in one transaction (AC-12)', async () => {
    const { exercise, sets } = await seed(3);
    const removal = removeSet({ exerciseSession: exercise, sets, setId: sets[1]!.id });

    await deleteCompletedSet({ removed: sets[1]!.id, ...removal });

    db.close();
    await db.open();

    const stored = await listCompletedSetsByExerciseSession(exercise.id);
    expect(stored.map((it) => it.setNumber)).toEqual([1, 2]);
    expect(stored.map((it) => it.id)).toEqual([sets[0]!.id, sets[2]!.id]);
    expect(await db.completedSets.count()).toBe(2);
  });

  it('returns the exercise to pending when the last set goes (AC-13)', async () => {
    const { exercise, sets } = await seed(1);
    expect((await getExerciseSession(exercise.id))?.status).toBe('performed');

    const removal = removeSet({ exerciseSession: exercise, sets, setId: sets[0]!.id });
    await deleteCompletedSet({ removed: sets[0]!.id, ...removal });

    db.close();
    await db.open();

    expect(await listCompletedSetsByExerciseSession(exercise.id)).toEqual([]);
    expect((await getExerciseSession(exercise.id))?.status).toBe('pending');
  });

  it('leaves the exercise performed while sets remain', async () => {
    const { exercise, sets } = await seed(2);
    const removal = removeSet({ exerciseSession: exercise, sets, setId: sets[0]!.id });

    await deleteCompletedSet({ removed: sets[0]!.id, ...removal });

    expect((await getExerciseSession(exercise.id))?.status).toBe('performed');
  });

  it('writes nothing when the domain found nothing to remove', async () => {
    const { exercise, sets } = await seed(2);
    const removal = removeSet({
      exerciseSession: exercise,
      sets,
      setId: toId<CompletedSetId>('nope'),
    });

    await deleteCompletedSet({ removed: toId<CompletedSetId>('nope'), ...removal });

    const stored = await listCompletedSetsByExerciseSession(exercise.id);
    expect(stored.map((it) => it.setNumber)).toEqual([1, 2]);
    expect(await db.completedSets.count()).toBe(2);
  });

  it('leaves the original sets intact when the write fails partway', async () => {
    const { exercise, sets } = await seed(3);
    const removal = removeSet({ exerciseSession: exercise, sets, setId: sets[1]!.id });

    // The transaction must remove the deleted row and preserve contiguous survivors.
    const corrupt = {
      removed: sets[1]!.id,
      sets: removal.sets,
      exerciseSession: { ...removal.exerciseSession, id: undefined as never },
    };

    await expect(deleteCompletedSet(corrupt)).rejects.toThrow();

    db.close();
    await db.open();

    expect(await db.completedSets.count()).toBe(3);
    const stored = await listCompletedSetsByExerciseSession(exercise.id);
    expect(stored.map((it) => it.setNumber)).toEqual([1, 2, 3]);
  });
});
