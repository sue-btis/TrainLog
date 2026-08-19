/**
 * TST-001 — the §12 example parses into the expected domain objects
 * (REQ-030, REQ-033, AC-030, AC-034).
 * TST-004 — exercise resolution (REQ-022, AC-023, AC-024, AC-025) and the
 * default unit (REQ-034, AC-035).
 */

import { describe, expect, it } from 'vitest';
import {
  parseRoutineFile,
  resolveFileExercise,
  routineFileToDomain,
} from '@/domain/routine-file';
import { EXAMPLE_YAML, aFile, anExercise, aWorkout } from '@/domain/routine-file/fixtures';
import type { RoutineFile } from '@/domain/routine-file';
import type { Exercise } from '@/domain/types';
import { toId, type ExerciseId } from '@/domain/ids';

const CREATED_AT = 1_755_000_000_000;

function parsed(text: string): RoutineFile {
  const result = parseRoutineFile(text);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.file;
}

describe('routineFileToDomain — the §12 example (TST-001)', () => {
  const draft = routineFileToDomain(parsed(EXAMPLE_YAML), {
    defaultUnit: 'lb',
    existingExercises: [],
    createdAt: CREATED_AT,
  });

  it('yields one Routine with the file values (AC-030)', () => {
    expect(draft.routine.name).toBe('Hybrid Strength - September');
    expect(draft.routine.weeks).toBe(4);
    expect(draft.routine.status).toBe('active');
    expect(draft.routine.createdAt).toBe(CREATED_AT);
    expect(draft.routine.id).toBeTruthy();
  });

  it('yields one Workout carrying its suggested days and order', () => {
    expect(draft.workouts).toHaveLength(1);
    const workout = draft.workouts[0];
    expect(workout?.name).toBe('Push - Quad + Shoulder Strength');
    expect(workout?.suggestedDays).toEqual(['monday', 'friday']);
    expect(workout?.order).toBe(0);
    expect(workout?.routineId).toBe(draft.routine.id);
  });

  it('yields one PlannedExercise with every mapped field', () => {
    expect(draft.plannedExercises).toHaveLength(1);
    const planned = draft.plannedExercises[0];
    expect(planned).toMatchObject({
      workoutId: draft.workouts[0]?.id,
      exerciseId: 'front-squat',
      sets: 4,
      minReps: 4,
      maxReps: 6,
      minRir: 1,
      maxRir: 2,
      restSeconds: 210,
      unit: 'kg',
      focus: 'Quadriceps Strength',
      notes: ['Maintain upright torso', 'Avoid technical failure'],
      order: 0,
      progression: { type: 'double_progression', increment: 2.5 },
    });
  });

  it('creates no user Exercise for a catalog reference (AC-022)', () => {
    expect(draft.createdExercises).toEqual([]);
  });

  it('assigns order from list position (AC-034)', () => {
    const file = aFile([
      aWorkout({
        name: 'A',
        exercises: [
          anExercise({ name: 'Front Squat' }),
          anExercise({ name: 'Bench Press' }),
          anExercise({ name: 'Barbell Row' }),
        ],
      }),
      aWorkout({ name: 'B', exercises: [anExercise({ name: 'Deadlift' })] }),
    ]);
    const result = routineFileToDomain(file, {
      defaultUnit: 'kg',
      existingExercises: [],
      createdAt: CREATED_AT,
    });
    expect(result.workouts.map((w) => [w.name, w.order])).toEqual([
      ['A', 0],
      ['B', 1],
    ]);
    const first = result.workouts[0]?.id;
    expect(
      result.plannedExercises.filter((p) => p.workoutId === first).map((p) => p.order),
    ).toEqual([0, 1, 2]);
  });

  it('adopts the default unit when the file omits one (AC-035)', () => {
    const result = routineFileToDomain(aFile(), {
      defaultUnit: 'lb',
      existingExercises: [],
      createdAt: CREATED_AT,
    });
    expect(result.plannedExercises[0]?.unit).toBe('lb');
  });

  it('falls back to manual for an unrecognized progression type', () => {
    const result = routineFileToDomain(
      aFile([
        aWorkout({
          exercises: [anExercise({ progression: { type: 'wave_loading' } })],
        }),
      ]),
      { defaultUnit: 'kg', existingExercises: [], createdAt: CREATED_AT },
    );
    expect(result.plannedExercises[0]?.progression).toEqual({ type: 'manual' });
  });
});

describe('resolveFileExercise (TST-004)', () => {
  it('resolves exercise_id against the catalog (AC-023)', () => {
    const resolved = resolveFileExercise(
      anExercise({ name: 'Anything At All', exercise_id: 'front-squat' }),
      [],
    );
    expect(resolved.created).toBe(false);
    expect(resolved.exercise.id).toBe('front-squat');
    expect(resolved.exercise.name).toBe('Front Squat');
  });

  it('resolves a normalized name against the catalog (AC-024)', () => {
    const resolved = resolveFileExercise(anExercise({ name: '  front   SQUAT ' }), []);
    expect(resolved.created).toBe(false);
    expect(resolved.exercise.id).toBe('front-squat');
  });

  it('resolves a normalized name against known user exercises', () => {
    const mine: Exercise = {
      id: toId<ExerciseId>('user-1'),
      name: 'Zercher Good Morning',
      category: null,
      equipment: null,
    };
    const resolved = resolveFileExercise(
      anExercise({ name: 'zercher  good morning' }),
      [mine],
    );
    expect(resolved.created).toBe(false);
    expect(resolved.exercise).toBe(mine);
  });

  it('creates a user Exercise when nothing matches', () => {
    const resolved = resolveFileExercise(
      anExercise({ name: 'Zercher Good Morning', category: 'hamstrings' }),
      [],
    );
    expect(resolved.created).toBe(true);
    expect(resolved.exercise.name).toBe('Zercher Good Morning');
    expect(resolved.exercise.category).toBe('hamstrings');
    expect(resolved.exercise.equipment).toBeNull();
    expect(resolved.exercise.id).not.toBe('');
  });

  it('creates one user Exercise and reuses it within the same file (AC-025)', () => {
    const draft = routineFileToDomain(
      aFile([
        aWorkout({
          name: 'A',
          exercises: [anExercise({ name: 'Zercher Good Morning' })],
        }),
        aWorkout({
          name: 'B',
          exercises: [anExercise({ name: '  zercher   good MORNING ' })],
        }),
      ]),
      { defaultUnit: 'kg', existingExercises: [], createdAt: CREATED_AT },
    );
    expect(draft.createdExercises).toHaveLength(1);
    const created = draft.createdExercises[0];
    expect(draft.plannedExercises.map((p) => p.exerciseId)).toEqual([
      created?.id,
      created?.id,
    ]);
  });

  it('reuses an existing user Exercise instead of creating one', () => {
    const mine: Exercise = {
      id: toId<ExerciseId>('user-1'),
      name: 'Zercher Good Morning',
      category: null,
      equipment: null,
    };
    const draft = routineFileToDomain(
      aFile([aWorkout({ exercises: [anExercise({ name: 'Zercher Good Morning' })] })]),
      { defaultUnit: 'kg', existingExercises: [mine], createdAt: CREATED_AT },
    );
    expect(draft.createdExercises).toEqual([]);
    expect(draft.plannedExercises[0]?.exerciseId).toBe('user-1');
  });
});
