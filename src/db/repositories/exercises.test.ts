/**
 * REQ-071 / DEC-007 — resolving an `exerciseId` to an Exercise consults the
 * catalog first and the `exercises` table second, so no caller has to know
 * that catalog Exercises are never stored.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import {
  getExercise,
  getExerciseName,
  getExerciseNames,
  listUserExercises,
} from '@/db/repositories/exercises';
import { toId, type ExerciseId } from '@/domain/ids';
import type { Exercise } from '@/domain/types';

const userExercise: Exercise = {
  id: toId<ExerciseId>('7f1a1c6e-0d6e-4a1e-9f5d-2f4b6d8a0c11'),
  name: 'Sandbag Bear Hug Carry',
  category: null,
  equipment: null,
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
