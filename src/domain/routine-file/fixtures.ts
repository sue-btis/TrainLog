/**
 * Fixtures shared by the routine-file tests. Imported only from `*.test.ts`.
 */

import type {
  RoutineFile,
  RoutineFileExercise,
  RoutineFileWorkout,
} from '@/domain/routine-file/schema';

/** The §12 example, verbatim. TST-001 parses this. */
export { EXAMPLE_ROUTINE_YAML as EXAMPLE_YAML } from '@/domain/routine-file/example';

/** A valid parsed exercise, as the schema produces it. */
export function anExercise(
  overrides: Partial<RoutineFileExercise> = {},
): RoutineFileExercise {
  return {
    name: 'Front Squat',
    sets: 4,
    reps: { min: 4, max: 6 },
    notes: [],
    progression: { type: 'manual' },
    ...overrides,
  };
}

/** A valid parsed workout. */
export function aWorkout(
  overrides: Partial<RoutineFileWorkout> = {},
): RoutineFileWorkout {
  return {
    name: 'Push',
    suggested_days: [],
    exercises: [anExercise()],
    ...overrides,
  };
}

/** A valid parsed routine file. */
export function aFile(workouts: RoutineFileWorkout[] = [aWorkout()]): RoutineFile {
  return {
    version: 1,
    routine: { name: 'Hybrid Strength', weeks: 4, workouts },
  };
}
