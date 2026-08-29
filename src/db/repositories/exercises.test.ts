import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import {
  ExerciseHasLoggedSetsError,
  ExerciseNameRequiredError,
  ExerciseNotCorrectableError,
  correctExerciseMeasurement,
  createUserExercise,
  getExercise,
  getExerciseName,
  getExerciseNames,
  listUserExercises,
} from '@/db/repositories/exercises';
import { resolveFileExercise } from '@/domain/routine-file';
import {
  toId,
  type CompletedSetId,
  type ExerciseId,
  type ExerciseSessionId,
  type SessionId,
} from '@/domain/ids';
import type { CompletedSet, Exercise, ExerciseSession } from '@/domain/types';

const userExercise: Exercise = {
  id: toId<ExerciseId>('7f1a1c6e-0d6e-4a1e-9f5d-2f4b6d8a0c11'),
  name: 'Sandbag Bear Hug Carry',
  category: null,
  equipment: null,
  measurement: 'weight_reps',
};

beforeEach(async () => {
  await resetDatabase();
  await db.exercises.add(userExercise);
});

describe('exercise resolution', () => {
  it('resolves a catalog slug without touching the table', async () => {
    expect((await getExercise(toId<ExerciseId>('front-squat')))?.name).toBe('Front Squat');
    expect(await listUserExercises()).toEqual([userExercise]);
  });

  it('resolves a user Exercise from the table', async () => {
    expect(await getExerciseName(userExercise.id)).toBe('Sandbag Bear Hug Carry');
  });

  it('returns undefined for an id nothing knows', async () => {
    expect(await getExercise(toId<ExerciseId>('no-such-exercise'))).toBeUndefined();
    expect(await getExerciseName(toId<ExerciseId>('no-such-exercise'))).toBeUndefined();
  });

  it('resolves a mixed batch of catalog and user ids', async () => {
    const names = await getExerciseNames([
      toId<ExerciseId>('front-squat'),
      userExercise.id,
      toId<ExerciseId>('no-such-exercise'),
    ]);

    expect(names.get(toId<ExerciseId>('front-squat'))).toBe('Front Squat');
    expect(names.get(userExercise.id)).toBe('Sandbag Bear Hug Carry');
    expect(names.has(toId<ExerciseId>('no-such-exercise'))).toBe(false);
  });
});

describe('createUserExercise', () => {
  it('writes one row, trimmed, with the casing the lifter typed', async () => {
    const result = await createUserExercise({
      name: '  Zercher Good Morning  ',
      category: 'legs',
      equipment: 'barbell',
    });

    expect(result.created).toBe(true);
    expect(result.exercise.name).toBe('Zercher Good Morning');
    expect(await db.exercises.count()).toBe(2);
  });

  it('binds a case-and-whitespace variant to the incumbent instead of minting', async () => {
    const first = await createUserExercise({
      name: 'Zercher Good Morning',
      category: null,
      equipment: null,
    });
    const again = await createUserExercise({
      name: '  zercher   GOOD morning ',
      category: 'legs',
      equipment: 'barbell',
    });

    expect(again.created).toBe(false);
    expect(again.exercise.id).toBe(first.exercise.id);
    expect(again.exercise.category).toBeNull();
    expect(await db.exercises.count()).toBe(2);
  });

  it('resolves a catalog name to its slug and writes nothing (DEC-007)', async () => {
    const before = await db.exercises.count();
    const result = await createUserExercise({
      name: 'front squat',
      category: null,
      equipment: null,
    });

    expect(result.created).toBe(false);
    expect(result.exercise.id).toBe('front-squat');
    expect(result.exercise.name).toBe('Front Squat');
    expect(await db.exercises.count()).toBe(before);
  });

  it('produces one row when two creates of the same name race', async () => {
    const [a, b] = await Promise.all([
      createUserExercise({ name: 'Sled Drag', category: null, equipment: null }),
      createUserExercise({ name: 'sled drag', category: null, equipment: null }),
    ]);

    expect(a.exercise.id).toBe(b.exercise.id);
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
    expect(await db.exercises.where('id').equals(a.exercise.id).count()).toBe(1);
  });

  it('is reused by a later import naming it in different casing (REQ-103)', async () => {
    const created = await createUserExercise({
      name: 'Zercher Good Morning',
      category: null,
      equipment: null,
    });

    const resolved = resolveFileExercise(
      { name: '  ZERCHER good   morning', sets: 3, reps: { min: 8, max: 12 }, notes: [], progression: { type: 'manual' } },
      await listUserExercises(),
    );

    expect(resolved.created).toBe(false);
    expect(resolved.exercise.id).toBe(created.exercise.id);
  });

  it('refuses a blank or whitespace-only name and writes nothing', async () => {
    const before = await db.exercises.count();

    await expect(
      createUserExercise({ name: '   ', category: null, equipment: null }),
    ).rejects.toBeInstanceOf(ExerciseNameRequiredError);
    await expect(
      createUserExercise({ name: '', category: null, equipment: null }),
    ).rejects.toBeInstanceOf(ExerciseNameRequiredError);

    expect(await db.exercises.count()).toBe(before);
  });

  it('defaults an unsaid measurement to weight_reps (AC-151)', async () => {
    const silent = await createUserExercise({
      name: 'Zercher Good Morning',
      category: null,
      equipment: null,
    });
    const stated = await createUserExercise({
      name: 'Wall Sit',
      category: null,
      equipment: null,
      measurement: 'duration',
    });

    expect(silent.exercise.measurement).toBe('weight_reps');
    expect((await getExercise(silent.exercise.id))?.measurement).toBe('weight_reps');
    expect((await getExercise(stated.exercise.id))?.measurement).toBe('duration');
  });

  it('round-trips category and equipment, including null for either', async () => {
    const both = await createUserExercise({
      name: 'Sled Push Heavy',
      category: 'legs',
      equipment: 'sled',
    });
    const neither = await createUserExercise({
      name: 'Odd Object Carry',
      category: null,
      equipment: null,
    });

    const stored = await listUserExercises();
    expect(stored.find((e) => e.id === both.exercise.id)).toMatchObject({
      category: 'legs',
      equipment: 'sled',
    });
    expect(stored.find((e) => e.id === neither.exercise.id)).toMatchObject({
      category: null,
      equipment: null,
    });
    expect((await getExercise(both.exercise.id))?.name).toBe('Sled Push Heavy');
  });
});

describe('correctExerciseMeasurement', () => {
  async function logOneSet(): Promise<void> {
    const exerciseSession: ExerciseSession = {
      id: toId<ExerciseSessionId>('es-correct-1'),
      sessionId: toId<SessionId>('s-correct-1'),
      exerciseId: userExercise.id,
      order: 0,
      status: 'performed',
      measurement: 'weight_reps',
      plannedExerciseId: null,
    };
    const set: CompletedSet = {
      id: toId<CompletedSetId>('cs-correct-1'),
      exerciseSessionId: exerciseSession.id,
      setNumber: 1,
      weight: 60,
      unit: 'kg',
      weightKg: 60,
      reps: 8,
      rir: 2,
      durationSeconds: null,
      distance: null,
      distanceUnit: null,
      distanceM: null,
      completedAt: 1_755_100_500_000,
    };
    await db.exerciseSessions.add(exerciseSession);
    await db.completedSets.add(set);
  }

  it('corrects the measurement while no set has been logged (AC-152)', async () => {
    const corrected = await correctExerciseMeasurement(userExercise.id, 'duration');

    expect(corrected.measurement).toBe('duration');
    expect((await getExercise(userExercise.id))?.measurement).toBe('duration');
  });

  it('corrects it with an ExerciseSession but still no set (AC-152)', async () => {
    await db.exerciseSessions.add({
      id: toId<ExerciseSessionId>('es-correct-empty'),
      sessionId: toId<SessionId>('s-correct-empty'),
      exerciseId: userExercise.id,
      order: 0,
      status: 'pending',
      measurement: 'weight_reps',
      plannedExerciseId: null,
    });

    await correctExerciseMeasurement(userExercise.id, 'distance');
    expect((await getExercise(userExercise.id))?.measurement).toBe('distance');
  });

  it('refuses once one set references it, and writes nothing (AC-153)', async () => {
    await logOneSet();

    await expect(correctExerciseMeasurement(userExercise.id, 'duration')).rejects.toThrow(
      'Sets are already logged for this exercise, so how it is measured can no longer be changed.',
    );
    await expect(
      correctExerciseMeasurement(userExercise.id, 'duration'),
    ).rejects.toBeInstanceOf(ExerciseHasLoggedSetsError);

    expect((await getExercise(userExercise.id))?.measurement).toBe('weight_reps');
  });

  it('refuses a catalog Exercise, which is never in the table (AC-154)', async () => {
    await expect(
      correctExerciseMeasurement(toId<ExerciseId>('front-squat'), 'duration'),
    ).rejects.toBeInstanceOf(ExerciseNotCorrectableError);
    await expect(
      correctExerciseMeasurement(toId<ExerciseId>('front-squat'), 'duration'),
    ).rejects.toThrow('Only an exercise you created can have its measurement corrected.');

    expect((await getExercise(toId<ExerciseId>('front-squat')))?.measurement).toBe('weight_reps');
    expect(await db.exercises.count()).toBe(1);
  });
});
