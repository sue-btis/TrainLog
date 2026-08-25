/**
 * TST-025 — the wizard's edit operations (§11.1 steps 1 and 2).
 *
 * Two properties matter beyond the obvious ones: every operation leaves its
 * input file untouched, because the wizard holds the previous file in React
 * state; and every operation is total, because an index can name an exercise
 * that a previous edit already removed.
 */

import { describe, expect, it } from 'vitest';
import {
  addExercise,
  addWorkout,
  blankRoutineFile,
  deleteExercise,
  editExercise,
  moveExercise,
  setRoutineName,
  setWeeks,
  setWorkoutName,
  toggleSuggestedDay,
} from '@/domain/routine-file/edit';
import { routineFileToDomain } from '@/domain/routine-file/to-domain';
import { validateRoutineFile } from '@/domain/routine-file/validate';
import { aFile, anExercise, aWorkout } from '@/domain/routine-file/fixtures';

const named = (name: string) => anExercise({ name });

const threeExercises = () =>
  aFile([
    aWorkout({
      exercises: [named('Front Squat'), named('Bench Press'), named('Row')],
    }),
  ]);

const namesOf = (file: ReturnType<typeof aFile>, workout = 0) =>
  file.routine.workouts[workout]?.exercises.map((exercise) => exercise.name);

describe('editExercise', () => {
  it('replaces the named fields and leaves the rest alone', () => {
    const file = aFile([aWorkout({ exercises: [anExercise()] })]);
    const edited = editExercise(file, { workout: 0, exercise: 0 }, {
      sets: 5,
      unit: 'lb',
      reps: { min: 6, max: 10 },
    });

    const exercise = edited.routine.workouts[0]?.exercises[0];
    expect(exercise?.sets).toBe(5);
    expect(exercise?.unit).toBe('lb');
    expect(exercise?.reps).toEqual({ min: 6, max: 10 });
    expect(exercise?.name).toBe('Front Squat');
  });

  it('does not mutate the file it was given', () => {
    const file = aFile([aWorkout({ exercises: [anExercise({ sets: 4 })] })]);
    editExercise(file, { workout: 0, exercise: 0 }, { sets: 5 });
    expect(file.routine.workouts[0]?.exercises[0]?.sets).toBe(4);
  });

  it('returns the file unchanged for an exercise that is not there', () => {
    const file = threeExercises();
    expect(editExercise(file, { workout: 0, exercise: 9 }, { sets: 5 })).toBe(file);
    expect(editExercise(file, { workout: 9, exercise: 0 }, { sets: 5 })).toBe(file);
  });
});

describe('deleteExercise', () => {
  it('removes one exercise and keeps the order of the rest', () => {
    const edited = deleteExercise(threeExercises(), { workout: 0, exercise: 1 });
    expect(namesOf(edited)).toEqual(['Front Squat', 'Row']);
  });

  it('allows a Workout to be emptied', () => {
    const file = aFile([aWorkout({ exercises: [anExercise()] })]);
    const edited = deleteExercise(file, { workout: 0, exercise: 0 });
    expect(namesOf(edited)).toEqual([]);
  });

  it('does not mutate the file it was given', () => {
    const file = threeExercises();
    deleteExercise(file, { workout: 0, exercise: 1 });
    expect(namesOf(file)).toEqual(['Front Squat', 'Bench Press', 'Row']);
  });

  it('returns the file unchanged for an exercise that is not there', () => {
    const file = threeExercises();
    expect(deleteExercise(file, { workout: 0, exercise: 9 })).toBe(file);
  });
});

describe('moveExercise', () => {
  it('swaps an exercise with the one above it', () => {
    const edited = moveExercise(threeExercises(), { workout: 0, exercise: 1 }, -1);
    expect(namesOf(edited)).toEqual(['Bench Press', 'Front Squat', 'Row']);
  });

  it('swaps an exercise with the one below it', () => {
    const edited = moveExercise(threeExercises(), { workout: 0, exercise: 1 }, 1);
    expect(namesOf(edited)).toEqual(['Front Squat', 'Row', 'Bench Press']);
  });

  it('does not move the first exercise up', () => {
    const file = threeExercises();
    expect(moveExercise(file, { workout: 0, exercise: 0 }, -1)).toBe(file);
  });

  it('does not move the last exercise down, and does not wrap', () => {
    const file = threeExercises();
    expect(moveExercise(file, { workout: 0, exercise: 2 }, 1)).toBe(file);
  });

  it('does not mutate the file it was given', () => {
    const file = threeExercises();
    moveExercise(file, { workout: 0, exercise: 0 }, 1);
    expect(namesOf(file)).toEqual(['Front Squat', 'Bench Press', 'Row']);
  });

  it('returns the file unchanged for an exercise that is not there', () => {
    const file = threeExercises();
    expect(moveExercise(file, { workout: 9, exercise: 0 }, 1)).toBe(file);
    expect(moveExercise(file, { workout: 0, exercise: 9 }, -1)).toBe(file);
  });
});

describe('toggleSuggestedDay', () => {
  it('adds a day the Workout did not claim', () => {
    const file = aFile([aWorkout({ suggested_days: ['monday'] })]);
    const edited = toggleSuggestedDay(file, 0, 'thursday');
    expect(edited.routine.workouts[0]?.suggested_days).toEqual(['monday', 'thursday']);
  });

  it('removes a day the Workout already claimed', () => {
    const file = aFile([aWorkout({ suggested_days: ['monday', 'thursday'] })]);
    const edited = toggleSuggestedDay(file, 0, 'monday');
    expect(edited.routine.workouts[0]?.suggested_days).toEqual(['thursday']);
  });

  it('touches one Workout only', () => {
    const file = aFile([
      aWorkout({ name: 'Push', suggested_days: ['monday'] }),
      aWorkout({ name: 'Pull', suggested_days: ['friday'] }),
    ]);
    const edited = toggleSuggestedDay(file, 0, 'monday');
    expect(edited.routine.workouts[0]?.suggested_days).toEqual([]);
    expect(edited.routine.workouts[1]?.suggested_days).toEqual(['friday']);
  });

  it('accepts a day another Workout claims, leaving it to validation', () => {
    const file = aFile([
      aWorkout({ name: 'Push', suggested_days: ['monday'] }),
      aWorkout({ name: 'Pull', suggested_days: [] }),
    ]);
    const edited = toggleSuggestedDay(file, 1, 'monday');
    expect(edited.routine.workouts[1]?.suggested_days).toEqual(['monday']);
  });

  it('composes, so two toggles in a row cannot lose one another', () => {
    const file = aFile([aWorkout({ suggested_days: [] })]);
    const edited = toggleSuggestedDay(toggleSuggestedDay(file, 0, 'monday'), 0, 'friday');
    expect(edited.routine.workouts[0]?.suggested_days).toEqual(['monday', 'friday']);
  });

  it('does not mutate the file it was given', () => {
    const file = aFile([aWorkout({ suggested_days: ['monday'] })]);
    toggleSuggestedDay(file, 0, 'friday');
    expect(file.routine.workouts[0]?.suggested_days).toEqual(['monday']);
  });

  it('returns the file unchanged for a Workout that is not there', () => {
    const file = aFile();
    expect(toggleSuggestedDay(file, 9, 'monday')).toBe(file);
  });
});

describe('setWeeks', () => {
  it('replaces the duration without touching the workouts', () => {
    const file = threeExercises();
    const edited = setWeeks(file, 2);
    expect(edited.routine.weeks).toBe(2);
    expect(edited.routine.workouts).toBe(file.routine.workouts);
  });

  it('does not mutate the file it was given', () => {
    const file = aFile();
    setWeeks(file, 8);
    expect(file.routine.weeks).toBe(4);
  });
});

/** TST-001, TST-002, TST-007 — adding a Workout (REQ-001, REQ-002, REQ-007). */
describe('addWorkout', () => {
  it('appends a named Workout with no days and no exercises', () => {
    const file = aFile([aWorkout({ name: 'Push' })]);
    const edited = addWorkout(file, 'Pull');

    expect(edited.routine.workouts.map((w) => w.name)).toEqual(['Push', 'Pull']);
    expect(edited.routine.workouts[1]).toEqual({
      name: 'Pull',
      suggested_days: [],
      exercises: [],
    });
  });

  it('leaves the input untouched and reuses the existing Workouts by reference', () => {
    const file = aFile([aWorkout({ name: 'Push' })]);
    const edited = addWorkout(file, 'Pull');

    expect(file.routine.workouts).toHaveLength(1);
    expect(edited.routine.workouts[0]).toBe(file.routine.workouts[0]);
  });

  it('raises no issue of its own, and clears the no-Workouts one', () => {
    expect(validateRoutineFile(addWorkout(aFile(), 'Pull'))).toEqual([]);

    const blank = blankRoutineFile(4);
    expect(validateRoutineFile(blank).map((i) => i.code)).toEqual([
      'routine_name_blank',
      'routine_has_no_workouts',
    ]);
    expect(validateRoutineFile(addWorkout(blank, 'Pull')).map((i) => i.code)).toEqual([
      'routine_name_blank',
    ]);
  });
});

/** TST-003, TST-005, TST-006 — adding an exercise (REQ-003, REQ-005, REQ-006). */
describe('addExercise', () => {
  it('appends the given row verbatim and leaves other Workouts alone', () => {
    const file = aFile([
      aWorkout({ name: 'Push', exercises: [named('Bench')] }),
      aWorkout({ name: 'Pull' }),
    ]);
    const row = anExercise({ name: 'Dip', exercise_id: 'dip' });
    const edited = addExercise(file, 0, row);

    expect(edited.routine.workouts[0]?.exercises[1]).toBe(row);
    expect(edited.routine.workouts[1]).toBe(file.routine.workouts[1]);
    expect(validateRoutineFile(edited)).toEqual([]);
  });

  it('returns the same file when the Workout index names nothing', () => {
    const file = aFile();
    expect(addExercise(file, 9, named('Dip'))).toBe(file);
  });

  it('does not mutate its input', () => {
    const file = aFile([aWorkout({ exercises: [named('Bench')] })]);
    addExercise(file, 0, named('Dip'));
    expect(file.routine.workouts[0]?.exercises).toHaveLength(1);
  });

  it('mints one Exercise when the same new name is added to two Workouts (26)', () => {
    const two = aFile([
      aWorkout({ name: 'Push', exercises: [] }),
      aWorkout({ name: 'Pull', exercises: [] }),
    ]);
    const file = addExercise(
      addExercise(two, 0, named('Zercher Good Morning')),
      1,
      named('zercher good morning'),
    );

    const draft = routineFileToDomain(file, {
      defaultUnit: 'kg',
      existingExercises: [],
      createdAt: 0,
    });

    expect(draft.createdExercises).toHaveLength(1);
    expect(new Set(draft.plannedExercises.map((p) => p.exerciseId)).size).toBe(1);
  });

  // TST-009 (REQ-011, REQ-901) — the point of REQ-011 is that adding a row buys
  // no second validator. Breaking an added row raises the *existing* issue, at
  // that row's own path — not the first row's, which is what a path built from
  // the wrong index would give and what nothing else here would catch.
  it('is judged by the existing rules, at the added row own path', () => {
    const file = aFile([
      aWorkout({ name: 'Push', exercises: [named('Bench')] }),
      aWorkout({ name: 'Pull', exercises: [named('Row')] }),
    ]);
    const added = addExercise(file, 1, named('Chin-up'));
    const broken = editExercise(added, { workout: 1, exercise: 1 }, { sets: 0 });

    const issues = validateRoutineFile(broken);
    expect(issues.map((issue) => issue.code)).toEqual(['sets_not_positive']);
    expect(issues[0]?.paths).toEqual([['routine', 'workouts', 1, 'exercises', 1, 'sets']]);
    expect(issues[0]?.message).toBe('Pull → Chin-up: sets must be greater than zero.');

    // And the row as added is clean, so the issue above is the edit's doing.
    expect(validateRoutineFile(added)).toEqual([]);
  });

  it('assigns order from list position, leaving earlier rows where they were', () => {
    const file = addExercise(aFile([aWorkout({ exercises: [named('Bench')] })]), 0, named('Dip'));
    const draft = routineFileToDomain(file, {
      defaultUnit: 'kg',
      existingExercises: [],
      createdAt: 0,
    });

    expect(draft.plannedExercises.map((p) => p.order)).toEqual([0, 1]);
    expect(draft.workouts.map((w) => w.order)).toEqual([0]);
  });
});

/** TST-008, TST-012 — naming (REQ-008, REQ-012). */
describe('setRoutineName and setWorkoutName', () => {
  it('replaces the routine name and keeps the Workouts referentially identical', () => {
    const file = aFile();
    const edited = setRoutineName(file, 'Hybrid Strength II');

    expect(edited.routine.name).toBe('Hybrid Strength II');
    expect(edited.routine.workouts).toBe(file.routine.workouts);
    expect(file.routine.name).toBe('Hybrid Strength');
  });

  it('replaces one Workout name, leaving its contents and the others alone', () => {
    const file = aFile([
      aWorkout({ name: 'Push', exercises: [named('Bench')] }),
      aWorkout({ name: 'Pull' }),
    ]);
    const edited = setWorkoutName(file, 0, 'Upper');

    expect(edited.routine.workouts.map((w) => w.name)).toEqual(['Upper', 'Pull']);
    expect(edited.routine.workouts[0]?.exercises).toBe(file.routine.workouts[0]?.exercises);
    expect(edited.routine.workouts[1]).toBe(file.routine.workouts[1]);
    expect(file.routine.workouts[0]?.name).toBe('Push');
  });

  it('returns the same file when the Workout index names nothing', () => {
    const file = aFile();
    expect(setWorkoutName(file, 9, 'Upper')).toBe(file);
  });
});

/** TST-014, TST-015 — the blank draft (REQ-014, REQ-203, REQ-210). */
describe('blankRoutineFile', () => {
  it('is version 1, unnamed, no Workouts, at the weeks it was given', () => {
    expect(blankRoutineFile(4)).toEqual({
      version: 1,
      routine: { name: '', weeks: 4, workouts: [] },
    });
  });

  it('opens blocked on exactly two problems, and nothing else', () => {
    expect(validateRoutineFile(blankRoutineFile(4)).map((i) => i.code)).toEqual([
      'routine_name_blank',
      'routine_has_no_workouts',
    ]);
  });

  it('says "This routine" rather than opening with a space while unnamed', () => {
    const issues = validateRoutineFile(blankRoutineFile(4));
    expect(issues[1]?.message).toBe('This routine declares no Workouts.');
    expect(issues[0]?.paths.map((p) => p.join('.'))).toEqual(['routine.name']);
  });

  it('unblocks once it is named and given one Workout', () => {
    const built = addWorkout(setRoutineName(blankRoutineFile(4), 'Winter Block'), 'Push');
    expect(validateRoutineFile(built)).toEqual([]);
  });
});

/** TST-013 — the blank-name rule on any draft, not only a scratch one. */
describe('routine_name_blank', () => {
  it('fires for an empty and a whitespace-only name, at routine.name', () => {
    for (const name of ['', '   ']) {
      const issues = validateRoutineFile(setRoutineName(aFile(), name));
      expect(issues.map((i) => i.code)).toEqual(['routine_name_blank']);
      expect(issues[0]?.paths.map((p) => p.join('.'))).toEqual(['routine.name']);
    }
  });

  it('does not fire for a real name', () => {
    expect(validateRoutineFile(setRoutineName(aFile(), 'Winter Block'))).toEqual([]);
  });
});

/** TST-010 — delete then add, in one draft (REQ-009, REQ-511). */
describe('emptying a Workout and putting an exercise back', () => {
  it('round-trips', () => {
    const file = aFile([aWorkout({ exercises: [named('Bench')] })]);
    const emptied = deleteExercise(file, { workout: 0, exercise: 0 });
    expect(emptied.routine.workouts[0]?.exercises).toEqual([]);
    expect(validateRoutineFile(emptied)).toEqual([]);

    const refilled = addExercise(emptied, 0, named('Dip'));
    expect(refilled.routine.workouts[0]?.exercises.map((e) => e.name)).toEqual(['Dip']);
  });
});
