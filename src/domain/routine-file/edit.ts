/**
 * Editing a routine file inside the import wizard (§11.1 steps 1 and 2).
 *
 * §11.1 lets the user correct the file before accepting it, and only before:
 * a Routine is immutable once stored (AGENTS.MD). So the wizard edits the
 * parsed file, re-runs `validateRoutineFile` over the result, and maps to
 * domain objects once, at Accept.
 *
 * Every function here is pure and total: it returns a new `RoutineFile` and
 * leaves its input untouched, and an index that names nothing returns the file
 * unchanged rather than throwing — the wizard must not be able to crash a
 * lifter's import by racing a delete against a keystroke.
 */

import type {
  RoutineFile,
  RoutineFileExercise,
  RoutineFileWeekday,
  RoutineFileWorkout,
} from '@/domain/routine-file/schema';

/** Where an exercise sits: its Workout's position, then its own. */
export interface ExerciseRef {
  readonly workout: number;
  readonly exercise: number;
}

/** Which way `moveExercise` walks the list. */
export type MoveDirection = -1 | 1;

/**
 * Replaces fields of one exercise. The patch is shallow, so a rep range is
 * passed whole (`{ reps: { ...exercise.reps, min: 5 } }`) rather than by leaf.
 */
export function editExercise(
  file: RoutineFile,
  ref: ExerciseRef,
  patch: Partial<RoutineFileExercise>,
): RoutineFile {
  return replaceExercises(file, ref.workout, (exercises) =>
    exercises[ref.exercise] === undefined
      ? exercises
      : exercises.map((exercise, index) =>
          index === ref.exercise ? { ...exercise, ...patch } : exercise,
        ),
  );
}

/**
 * Removes one exercise. A Workout may end up with none: the file still
 * describes a real training week, and §11.1 gives the wizard no way to add an
 * exercise back, so refusing the last deletion would only trap the user.
 */
export function deleteExercise(file: RoutineFile, ref: ExerciseRef): RoutineFile {
  return replaceExercises(file, ref.workout, (exercises) =>
    exercises[ref.exercise] === undefined
      ? exercises
      : exercises.filter((_, index) => index !== ref.exercise),
  );
}

/**
 * Swaps an exercise with its neighbour. Order is meaning here — it becomes
 * `PlannedExercise.order`, the order the Workout is performed in — so moving
 * past either end is a no-op, not a wrap.
 */
export function moveExercise(
  file: RoutineFile,
  ref: ExerciseRef,
  direction: MoveDirection,
): RoutineFile {
  const target = ref.exercise + direction;
  return replaceExercises(file, ref.workout, (exercises) => {
    const moved = exercises[ref.exercise];
    const displaced = exercises[target];
    if (moved === undefined || displaced === undefined) return exercises;
    return exercises.map((exercise, index) => {
      if (index === ref.exercise) return displaced;
      if (index === target) return moved;
      return exercise;
    });
  });
}

/**
 * Adds or removes one suggested day (§11.1 step 2).
 *
 * A toggle rather than a replacement, so the caller never has to read the
 * current list to write the next one — two taps in quick succession cannot
 * lose one another. Claiming a day another Workout already claims is allowed
 * and stays a semantic issue: the wizard shows the clash and blocks `Accept`,
 * which is what §12 asks for.
 */
export function toggleSuggestedDay(
  file: RoutineFile,
  workoutIndex: number,
  day: RoutineFileWeekday,
): RoutineFile {
  return replaceWorkout(file, workoutIndex, (workout) => ({
    ...workout,
    suggested_days: workout.suggested_days.includes(day)
      ? workout.suggested_days.filter((existing) => existing !== day)
      : [...workout.suggested_days, day],
  }));
}

/** Replaces the Routine's duration, which decides how many Placements exist. */
export function setWeeks(file: RoutineFile, weeks: number): RoutineFile {
  return { ...file, routine: { ...file.routine, weeks } };
}

function replaceExercises(
  file: RoutineFile,
  workoutIndex: number,
  map: (exercises: RoutineFileExercise[]) => RoutineFileExercise[],
): RoutineFile {
  return replaceWorkout(file, workoutIndex, (workout) => {
    const exercises = map(workout.exercises);
    return exercises === workout.exercises ? workout : { ...workout, exercises };
  });
}

function replaceWorkout(
  file: RoutineFile,
  workoutIndex: number,
  map: (workout: RoutineFileWorkout) => RoutineFileWorkout,
): RoutineFile {
  const current = file.routine.workouts[workoutIndex];
  if (current === undefined) return file;

  const replacement = map(current);
  if (replacement === current) return file;

  return {
    ...file,
    routine: {
      ...file.routine,
      workouts: file.routine.workouts.map((workout, index) =>
        index === workoutIndex ? replacement : workout,
      ),
    },
  };
}
