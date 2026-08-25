/**
 * Routine file → domain objects (REQ-022, REQ-033, REQ-034).
 *
 * Pure and free of persistence: it generates ids, assigns `order` from list
 * position, and hands back the user Exercises it had to create so the caller
 * can write them in the same transaction as the Routine (REQ-074).
 *
 * Exercise resolution is domain logic, so the user's existing Exercises are
 * passed in rather than read from a database (§26, AGENTS.MD layering).
 */

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

/** An Exercise for a file entry, and whether it had to be created. */
export interface ResolvedExercise {
  readonly exercise: Exercise;
  readonly created: boolean;
}

/**
 * Resolves one file exercise, in the order of §26 (REQ-022):
 *
 *   1. `exercise_id` against the catalog;
 *   2. otherwise `findExerciseByName` — the normalized name against the
 *      catalog, then against `knownExercises`, which holds the user's
 *      Exercises including any created earlier in the same import;
 *   3. otherwise a new user Exercise with a generated id.
 *
 * An `exercise_id` that names nothing in the catalog falls through to name
 * resolution rather than failing: the file still describes a real movement.
 *
 * Step 2 lives in `@/domain/catalog` rather than here because the create screen
 * asks the same question before it writes a row (REQ-102). This function is now
 * that lookup plus the mint, and the mint is the only part it owns — which is
 * what keeps the two creation paths from drifting apart on what counts as the
 * same movement.
 */
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
      // The file's declaration applies only where the import mints the
      // Exercise (REQ-131): the return above hands back an incumbent and
      // never restates its type.
      measurement: declaredMeasurement(fileExercise),
    },
  };
}

/**
 * The type an entry declares, or the one it means by saying nothing.
 *
 * Omitted means weight x reps, which is what every version-1 file has always
 * meant (REQ-130, DEC-K) and what 81 of the catalog's 100 rows are. Stated
 * here rather than at each reader, so the mint and the screen that shows a
 * lifter what the mint will do cannot disagree about the default.
 *
 * This is the *declared* type. Where the entry resolves to an Exercise that
 * already exists, that Exercise's own type wins (REQ-131).
 */
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

/** What the caller must supply that the file does not carry. */
export interface RoutineFileToDomainOptions {
  /** The unit an exercise adopts when the file omits one (§12, REQ-034). */
  readonly defaultUnit: Unit;
  /** The user's Exercises, for name resolution. The catalog is not included. */
  readonly existingExercises: readonly Exercise[];
  /** The instant of the import; the function reads no clock. */
  readonly createdAt: Timestamp;
}

/** The domain objects an import would write. Nothing here is persisted yet. */
export interface RoutineDraft {
  readonly routine: Routine;
  readonly workouts: readonly Workout[];
  readonly plannedExercises: readonly PlannedExercise[];
  /** User Exercises created by this import, to be written with the Routine. */
  readonly createdExercises: readonly Exercise[];
}

/**
 * Maps a parsed routine file onto its domain objects (REQ-033).
 *
 * Call `validateRoutineFile` first: a semantically invalid file still maps,
 * which is what lets the wizard show it, but it must not be accepted.
 */
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
  // Grows as the file is walked, so one new name resolves once (AC-025).
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
        // file happened to write (REQ-139).
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

/**
 * An unrecognized progression type is a semantic issue, not a parse failure,
 * so it still has to map to something: it falls back to `manual`, the rule §28
 * says must always exist. Such a file cannot be accepted while the issue stands.
 */
function toProgressionRule(progression: RoutineFileProgression): ProgressionRule {
  if (progression.type === 'double_progression' && progression.increment !== undefined) {
    return { type: 'double_progression', increment: progression.increment };
  }
  return { type: 'manual' };
}
