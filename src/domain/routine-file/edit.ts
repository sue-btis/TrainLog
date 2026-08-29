
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

export function addWorkout(file: RoutineFile, name: string): RoutineFile {
  return {
    ...file,
    routine: {
      ...file.routine,
      workouts: [...file.routine.workouts, { name, suggested_days: [], exercises: [] }],
    },
  };
}

export function addExercise(
  file: RoutineFile,
  workoutIndex: number,
  exercise: RoutineFileExercise,
): RoutineFile {
  return replaceExercises(file, workoutIndex, (exercises) => [...exercises, exercise]);
}

export function setRoutineName(file: RoutineFile, name: string): RoutineFile {
  return { ...file, routine: { ...file.routine, name } };
}

export function setWorkoutName(
  file: RoutineFile,
  workoutIndex: number,
  name: string,
): RoutineFile {
  return replaceWorkout(file, workoutIndex, (workout) => ({ ...workout, name }));
}

export function blankRoutineFile(weeks: number): RoutineFile {
  return { version: 1, routine: { name: '', weeks, workouts: [] } };
}
