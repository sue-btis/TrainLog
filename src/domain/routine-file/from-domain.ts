import { stringify } from 'yaml';
import { getCatalogExercise } from '@/domain/catalog';
import { targetsReps } from '@/domain/measurement';
import type { ExerciseId } from '@/domain/ids';
import type { Exercise, PlannedExercise, Routine, Workout } from '@/domain/types';
import type { RoutineFile, RoutineFileExercise } from '@/domain/routine-file/schema';

/**
 * The inverse of `routineFileToDomain`: a stored Routine as a file another
 * device can import. Placements are left out because the import schedules its own.
 */
export function routineToFile(
  routine: Routine,
  workouts: readonly Workout[],
  plannedExercises: readonly PlannedExercise[],
  exercises: ReadonlyMap<ExerciseId, Exercise>,
): RoutineFile {
  return {
    // Version 2 because every entry declares its measurement.
    version: 2,
    routine: {
      name: routine.name,
      weeks: routine.weeks,
      workouts: [...workouts]
        .sort((a, b) => a.order - b.order)
        .map((workout) => ({
          name: workout.name,
          suggested_days: [...workout.suggestedDays],
          exercises: plannedExercises
            .filter((planned) => planned.workoutId === workout.id)
            .sort((a, b) => a.order - b.order)
            .map((planned) => toFileExercise(planned, exercises)),
        })),
    },
  };
}

export function stringifyRoutineFile(file: RoutineFile): string {
  return stringify(file);
}

function toFileExercise(
  planned: PlannedExercise,
  exercises: ReadonlyMap<ExerciseId, Exercise>,
): RoutineFileExercise {
  const exercise = exercises.get(planned.exerciseId);
  if (exercise === undefined) {
    throw new Error(`Exercise ${planned.exerciseId} is planned but does not exist.`);
  }
  const onReps = targetsReps(exercise.measurement);
  const [min, max] = onReps
    ? [planned.minReps, planned.maxReps]
    : [planned.minTarget, planned.maxTarget];
  const range =
    min === null || max === null ? {} : onReps ? { reps: { min, max } } : { target: { min, max } };

  return {
    name: exercise.name,
    // A user Exercise's id is a UUID no other device has; only catalog slugs travel.
    ...(getCatalogExercise(exercise.id) ? { exercise_id: exercise.id } : {}),
    ...(exercise.category === null ? {} : { category: exercise.category }),
    measurement: exercise.measurement,
    unit: planned.unit,
    sets: planned.sets,
    ...range,
    ...(planned.minRir === null || planned.maxRir === null
      ? {}
      : { rir: { min: planned.minRir, max: planned.maxRir } }),
    ...(planned.restSeconds === null ? {} : { rest_seconds: planned.restSeconds }),
    ...(planned.focus === null ? {} : { focus: planned.focus }),
    notes: [...planned.notes],
    progression:
      planned.progression.type === 'double_progression'
        ? { type: 'double_progression', increment: planned.progression.increment }
        : { type: 'manual' },
  };
}
