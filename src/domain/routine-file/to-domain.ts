
import { findExerciseByName, getCatalogExercise } from '@/domain/catalog';
import { targetsReps, type Measurement } from '@/domain/measurement';
import { newId, toId } from '@/domain/ids';
import type {
  ExerciseId,
  PlannedExerciseId,
  RoutineId,
  WorkoutId,
} from '@/domain/ids';
import type {
  Exercise,
  PlannedExercise,
  ProgressionRule,
  Routine,
  Timestamp,
  Unit,
  Workout,
} from '@/domain/types';
import type {
  RoutineFile,
  RoutineFileExercise,
  RoutineFileProgression,
} from '@/domain/routine-file/schema';

export interface ResolvedExercise {
  readonly exercise: Exercise;
  readonly created: boolean;
}

export function resolveFileExercise(
  fileExercise: RoutineFileExercise,
  knownExercises: readonly Exercise[],
): ResolvedExercise {
  const incumbent = resolvedFileExercise(fileExercise, knownExercises);
  if (incumbent) return { exercise: incumbent, created: false };

  return {
    created: true,
    exercise: {
      id: newId<ExerciseId>(),
      name: fileExercise.name.trim(),
      category: fileExercise.category ?? null,
      equipment: null,
      measurement: declaredMeasurement(fileExercise),
    },
  };
}

export function declaredMeasurement(fileExercise: RoutineFileExercise): Measurement {
  return fileExercise.measurement ?? 'weight_reps';
}

/**
 * The Exercise a file entry binds to, or `undefined` where the import would
 * mint one for it.
 *
 * The lookup half of `resolveFileExercise`, without the mint. A caller that
 * only wants to know *whether* an entry names something the app already has —
 * the wizard, deciding whether its measurement is still the lifter's to
 * choose — gets an answer without a discarded id being generated for every
 * keystroke, and gets it from the one rule rather than a second copy of it.
 */
export function resolvedFileExercise(
  fileExercise: RoutineFileExercise,
  knownExercises: readonly Exercise[],
): Exercise | undefined {
  if (fileExercise.exercise_id !== undefined) {
    const fromCatalog = getCatalogExercise(toId<ExerciseId>(fileExercise.exercise_id));
    if (fromCatalog) return fromCatalog;
  }
  return findExerciseByName(fileExercise.name, knownExercises);
}

export interface RoutineFileToDomainOptions {
  readonly defaultUnit: Unit;
  readonly existingExercises: readonly Exercise[];
  readonly createdAt: Timestamp;
}

export interface RoutineDraft {
  readonly routine: Routine;
  readonly workouts: readonly Workout[];
  readonly plannedExercises: readonly PlannedExercise[];
  readonly createdExercises: readonly Exercise[];
}

export function routineFileToDomain(
  file: RoutineFile,
  options: RoutineFileToDomainOptions,
): RoutineDraft {
  const routineId = newId<RoutineId>();
  const routine: Routine = {
    id: routineId,
    name: file.routine.name,
    weeks: file.routine.weeks,
    status: 'active',
    createdAt: options.createdAt,
  };

  const workouts: Workout[] = [];
  const plannedExercises: PlannedExercise[] = [];
  const createdExercises: Exercise[] = [];
  const knownExercises: Exercise[] = [...options.existingExercises];

  file.routine.workouts.forEach((fileWorkout, workoutOrder) => {
    const workoutId = newId<WorkoutId>();
    workouts.push({
      id: workoutId,
      routineId,
      name: fileWorkout.name,
      suggestedDays: fileWorkout.suggested_days,
      order: workoutOrder,
    });

    fileWorkout.exercises.forEach((fileExercise, exerciseOrder) => {
      const resolved = resolveFileExercise(fileExercise, knownExercises);
      if (resolved.created) {
        createdExercises.push(resolved.exercise);
        knownExercises.push(resolved.exercise);
      }
      const onReps = targetsReps(resolved.exercise.measurement);

      plannedExercises.push({
        id: newId<PlannedExerciseId>(),
        workoutId,
        exerciseId: resolved.exercise.id,
        sets: fileExercise.sets,
        // Exactly one of the two pairs is populated, and which one is
        // decided by the Exercise's measurement rather than by which key the
        minReps: onReps ? (fileExercise.reps?.min ?? null) : null,
        maxReps: onReps ? (fileExercise.reps?.max ?? null) : null,
        minTarget: onReps ? null : (fileExercise.target?.min ?? null),
        maxTarget: onReps ? null : (fileExercise.target?.max ?? null),
        minRir: fileExercise.rir?.min ?? null,
        maxRir: fileExercise.rir?.max ?? null,
        restSeconds: fileExercise.rest_seconds ?? null,
        unit: fileExercise.unit ?? options.defaultUnit,
        focus: fileExercise.focus ?? null,
        notes: fileExercise.notes,
        order: exerciseOrder,
        progression: toProgressionRule(fileExercise.progression),
      });
    });
  });

  return { routine, workouts, plannedExercises, createdExercises };
}

function toProgressionRule(progression: RoutineFileProgression): ProgressionRule {
  if (progression.type === 'double_progression' && progression.increment !== undefined) {
    return { type: 'double_progression', increment: progression.increment };
  }
  return { type: 'manual' };
}
