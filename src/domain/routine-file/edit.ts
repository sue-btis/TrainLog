/**
 * Editing a routine file inside the import wizard (§11.1 steps 1 and 2).
 *
 * §11.1 lets the user shape the file before accepting it. Everything here acts
 * on the draft and only on the draft — nothing in this module can reach a
 * stored Routine, which takes additions only and never a rewrite or a deletion
 * (AGENTS.MD). So the wizard edits the parsed file, re-runs
 * `validateRoutineFile` over the result, and maps to domain objects once, at
 * Accept.
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

/**
 * Adds a Workout, named at creation, after every Workout already in the file
 * (REQ-001).
 *
 * It arrives with no suggested days and no exercises, and both absences are
 * deliberate. No days means it cannot collide with another Workout on arrival,
 * so adding one never raises `suggested_day_shared`; no exercises is a state
 * the app already runs end to end, and step 2 is where days are chosen anyway.
 *
 * Append, never insert: list position becomes `Workout.order`, which is the
 * rotation, so inserting would silently renumber Workouts the lifter has not
 * touched.
 */
export function addWorkout(file: RoutineFile, name: string): RoutineFile {
  return {
    ...file,
    routine: {
      ...file.routine,
      workouts: [...file.routine.workouts, { name, suggested_days: [], exercises: [] }],
    },
  };
}

/**
 * Adds one exercise to a Workout, at the end of its list (REQ-003).
 *
 * It takes a whole `RoutineFileExercise` rather than a name because only the
 * caller knows what the row's identity is: a bundled-catalog pick carries its
 * permanent slug in `exercise_id`, and everything else carries a name alone.
 * A name-only verb here would have to invent the rest, and inventing it is how
 * a catalog pick loses its slug and gets re-matched as a stranger (§26).
 *
 * The row is appended verbatim. This function composes no defaults.
 */
export function addExercise(
  file: RoutineFile,
  workoutIndex: number,
  exercise: RoutineFileExercise,
): RoutineFile {
  return replaceExercises(file, workoutIndex, (exercises) => [...exercises, exercise]);
}

/** Replaces the Routine's name (REQ-008). Mirrors `setWeeks`. */
export function setRoutineName(file: RoutineFile, name: string): RoutineFile {
  return { ...file, routine: { ...file.routine, name } };
}

/**
 * Replaces one Workout's name (REQ-012).
 *
 * Scoped to the draft, like every verb here. Authoring from scratch is the
 * first thing in the app that can *create* a Workout, so it is the first that
 * can misspell one — and there is no verb that removes a Workout, so without
 * this the only way out of a typo would be discarding the whole draft. A
 * Workout already stored gains nothing: an accepted Routine takes additions
 * only.
 */
export function setWorkoutName(
  file: RoutineFile,
  workoutIndex: number,
  name: string,
): RoutineFile {
  return replaceWorkout(file, workoutIndex, (workout) => ({ ...workout, name }));
}

/**
 * The draft a from-scratch Routine opens on (REQ-014).
 *
 * Empty name, no Workouts — so it opens *blocked*, carrying exactly the two
 * semantic issues that say what is missing, and `Accept` stays disabled until
 * both are answered. That is the intended first frame, not a defect: the wizard
 * already knows how to show a lifter what stands between them and Accept.
 *
 * `weeks` is a parameter rather than a constant because the bounds it sits
 * inside (`MIN_WEEKS`/`MAX_WEEKS`) belong to the wizard, and the domain does
 * not read feature constants.
 */
export function blankRoutineFile(weeks: number): RoutineFile {
  return { version: 1, routine: { name: '', weeks, workouts: [] } };
}
