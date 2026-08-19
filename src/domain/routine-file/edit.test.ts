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
  deleteExercise,
  editExercise,
  moveExercise,
  toggleSuggestedDay,
  setWeeks,
} from '@/domain/routine-file/edit';
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
