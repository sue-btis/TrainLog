/**
 * TST-409 (REQ-409, REQ-913) — targets entered outside the wizard are judged by
 * the wizard's own validator, and the synthetic file cannot raise an issue the
 * form has no field to answer.
 */

import { describe, expect, it } from 'vitest';
import {
  plannedExerciseDraftFile,
  plannedExerciseDraftRefusals,
  type PlannedExerciseDraft,
} from '@/domain/routine-file/planned-exercise-draft';
import { validateRoutineFile } from '@/domain/routine-file/validate';

function targets(overrides: Partial<PlannedExerciseDraft> = {}): PlannedExerciseDraft {
  return {
    name: 'Front Squat',
    sets: 4,
    minReps: 4,
    maxReps: 6,
    minRir: 1,
    maxRir: 2,
    restSeconds: 180,
    unit: 'kg',
    progression: { type: 'manual' },
    ...overrides,
  };
}

const codesOf = (draft: PlannedExerciseDraft): readonly string[] =>
  validateRoutineFile(plannedExerciseDraftFile(draft, 'Push')).map((issue) => issue.code);

describe('plannedExerciseDraftFile', () => {
  it('reports nothing for targets the wizard would accept', () => {
    expect(codesOf(targets())).toEqual([]);
  });

  it('reports the same issues the wizard reports, for the same numbers', () => {
    expect(codesOf(targets({ minReps: 8, maxReps: 5 }))).toEqual(['reps_range_inverted']);
    expect(codesOf(targets({ sets: 0 }))).toEqual(['sets_not_positive']);
    expect(codesOf(targets({ restSeconds: -30 }))).toEqual(['rest_seconds_negative']);
    expect(codesOf(targets({ minRir: 0, maxRir: 40 }))).toEqual(['rir_out_of_range']);
  });

  it('never raises an issue the form has no field to answer', () => {
    // Both of these are wizard-only concerns: there is no routine name on this
    // form, and the day-collision question is answered as a warning by the
    // add-Workout form instead (DEC-Q1, REQ-405).
    const every = [
      codesOf(targets()),
      codesOf(targets({ sets: 0, minReps: 9, maxReps: 2, restSeconds: -1 })),
    ].flat();

    expect(every).not.toContain('routine_name_blank');
    expect(every).not.toContain('routine_has_no_workouts');
    expect(every).not.toContain('suggested_day_shared');
  });

  it('carries a progression the engine implements, so it is never unrecognized', () => {
    expect(codesOf(targets({ progression: { type: 'manual' } }))).toEqual([]);
    expect(
      codesOf(targets({ progression: { type: 'double_progression', increment: 2.5 } })),
    ).toEqual([]);
  });

  it('omits an absent RIR range and an absent rest rather than defaulting them', () => {
    const file = plannedExerciseDraftFile(
      targets({ minRir: null, maxRir: null, restSeconds: null }),
      'Push',
    );
    const row = file.routine.workouts[0]!.exercises[0]!;

    expect('rir' in row).toBe(false);
    expect('rest_seconds' in row).toBe(false);
    expect(validateRoutineFile(file)).toEqual([]);
  });

  it('names the Workout it was built for, so an issue can say where it is', () => {
    const file = plannedExerciseDraftFile(targets(), 'Lower A');

    expect(file.routine.workouts).toHaveLength(1);
    expect(file.routine.workouts[0]!.name).toBe('Lower A');
    expect(file.routine.workouts[0]!.suggested_days).toEqual([]);
    expect(file.routine.name.trim()).not.toBe('');
  });
});

/**
 * TST-409b (REQ-409, REQ-417) — the two shapes only this form can produce are
 * refused here, because the shared validator has no code to refuse them with
 * and a stored row cannot be edited afterwards (REQ-415). That these same
 * values fail a restore is `backup/schema.test.ts`'s assertion, not this
 * file's — the rejection is asserted once, where the schema lives.
 */
describe('plannedExerciseDraftRefusals', () => {
  const rirOf = (o: Partial<PlannedExerciseDraft>) => plannedExerciseDraftRefusals(targets(o)).rir;
  const incrementOf = (o: Partial<PlannedExerciseDraft>) =>
    plannedExerciseDraftRefusals(targets(o)).increment;

  it('accepts a RIR range with both ends, and one with neither', () => {
    expect(rirOf({ minRir: 1, maxRir: 2 })).toBeNull();
    expect(rirOf({ minRir: null, maxRir: null })).toBeNull();
    expect(rirOf({ minRir: 0, maxRir: 0 })).toBeNull();
  });

  it('refuses a half RIR range from either end', () => {
    expect(rirOf({ minRir: -1, maxRir: null })).not.toBeNull();
    expect(rirOf({ minRir: null, maxRir: 3 })).not.toBeNull();
  });

  it('refuses an increment that does not increase, and leaves manual alone', () => {
    expect(incrementOf({ progression: { type: 'manual' } })).toBeNull();
    expect(
      incrementOf({ progression: { type: 'double_progression', increment: 2.5 } }),
    ).toBeNull();
    expect(
      incrementOf({ progression: { type: 'double_progression', increment: 0 } }),
    ).not.toBeNull();
    expect(
      incrementOf({ progression: { type: 'double_progression', increment: -2.5 } }),
    ).not.toBeNull();
  });

  it('lets the validator see a RIR end it would otherwise never look at', () => {
    // The omission was the bug: with one end blank the `rir` node was dropped,
    // so `rir_out_of_range` had nothing to judge and -1 reached the database.
    expect(codesOf(targets({ minRir: -1, maxRir: null }))).toEqual([]);
    expect(rirOf({ minRir: -1, maxRir: null })).not.toBeNull();
    expect(codesOf(targets({ minRir: -1, maxRir: -1 }))).toEqual(['rir_out_of_range']);
  });
});
