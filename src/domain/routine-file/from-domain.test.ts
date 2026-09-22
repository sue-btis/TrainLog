import { describe, expect, it } from 'vitest';
import { getCatalogExercise } from '@/domain/catalog';
import { toId, type ExerciseId } from '@/domain/ids';
import {
  parseRoutineFile,
  routineFileToDomain,
  routineToFile,
  stringifyRoutineFile,
  validateRoutineFile,
  type RoutineDraft,
  type RoutineFile,
} from '@/domain/routine-file';

const FRONT_SQUAT = toId<ExerciseId>('front-squat');

const SOURCE: RoutineFile = {
  version: 2,
  routine: {
    name: 'Fuerza: Básica #1',
    weeks: 6,
    workouts: [
      {
        name: 'Push',
        suggested_days: ['monday', 'thursday'],
        exercises: [
          {
            name: 'Front Squat',
            exercise_id: 'front-squat',
            unit: 'kg',
            sets: 4,
            reps: { min: 4, max: 6 },
            rir: { min: 1, max: 2 },
            rest_seconds: 210,
            focus: 'Quad strength',
            notes: ['Upright torso', 'No grinding'],
            progression: { type: 'double_progression', increment: 2.5 },
          },
          {
            name: 'Garage Wall Sit Hold',
            category: 'quadriceps',
            measurement: 'duration',
            unit: 'lb',
            sets: 3,
            target: { min: 30, max: 45 },
            notes: [],
            progression: { type: 'manual' },
          },
        ],
      },
      { name: 'Pull', suggested_days: [], exercises: [] },
    ],
  },
};

function imported(file: RoutineFile): RoutineDraft {
  return routineFileToDomain(file, { defaultUnit: 'kg', existingExercises: [], createdAt: 1 });
}

function withoutIds(draft: RoutineDraft) {
  return {
    routine: { name: draft.routine.name, weeks: draft.routine.weeks },
    workouts: draft.workouts.map(({ name, suggestedDays, order }) => ({ name, suggestedDays, order })),
    planned: draft.plannedExercises.map((it) => ({
      ...it,
      id: null,
      workoutId: null,
      exerciseId: null,
    })),
    created: draft.createdExercises.map((it) => ({ ...it, id: null })),
  };
}

describe('routineToFile', () => {
  const draft = imported(SOURCE);
  const exercises = new Map(
    [...draft.createdExercises, getCatalogExercise(FRONT_SQUAT)!].map((it) => [it.id, it]),
  );
  // Reversed so the export has to restore order rather than inherit it.
  const text = stringifyRoutineFile(
    routineToFile(
      draft.routine,
      [...draft.workouts].reverse(),
      [...draft.plannedExercises].reverse(),
      exercises,
    ),
  );
  const result = parseRoutineFile(text);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));

  it('writes a file that another device imports with no issues', () => {
    expect(validateRoutineFile(result.file, { knownExercises: [] })).toEqual([]);
  });

  it('imports back to the same routine, workouts and planned exercises', () => {
    expect(withoutIds(imported(result.file))).toEqual(withoutIds(draft));
  });

  it('binds catalog exercises by slug and never exports a user exercise id', () => {
    const [squat, hold] = result.file.routine.workouts[0]!.exercises;
    expect(squat?.exercise_id).toBe('front-squat');
    expect(hold?.exercise_id).toBeUndefined();
    expect(imported(result.file).plannedExercises[0]?.exerciseId).toBe(FRONT_SQUAT);
  });
});
