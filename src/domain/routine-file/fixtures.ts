/**
 * Fixtures shared by the routine-file tests. Imported only from `*.test.ts`.
 */

import type {
  RoutineFile,
  RoutineFileExercise,
  RoutineFileWorkout,
} from '@/domain/routine-file/schema';

/** The §12 example, verbatim. TST-001 parses this. */
export const EXAMPLE_YAML = `version: 1

routine:
  name: "Hybrid Strength - September"
  weeks: 4

  workouts:
    - name: "Push - Quad + Shoulder Strength"
      suggested_days: [monday, friday]

      exercises:

        - name: "Front Squat"
          exercise_id: "front-squat"
          category: "quadriceps"
          goal: "strength"
          unit: "kg"

          sets: 4

          reps:
            min: 4
            max: 6

          rir:
            min: 1
            max: 2

          rest_seconds: 210

          focus: "Quadriceps Strength"

          notes:
            - "Maintain upright torso"
            - "Avoid technical failure"

          progression:
            type: "double_progression"
            increment: 2.5
`;

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
