/**
 * `describeIssue` over the synthetic file the add-exercise form builds.
 *
 * The form used to show `issue.message` raw, which names a file path — Workout
 * and exercise indices — that a lifter adding to a stored Routine never saw,
 * and stops at the problem. `describeIssue` is what the wizard's fields show:
 * the numbers as typed, then what to do. The seam worth guarding is that these
 * two halves still fit — `describeIssue` reads the row's own fields, and
 * `plannedExerciseDraftFile` is what shapes that row.
 */

import { describe, expect, it } from 'vitest';
import {
  plannedExerciseDraftFile,
  type PlannedExerciseDraft,
} from '@/domain/routine-file/planned-exercise-draft';
import { validateRoutineFile } from '@/domain/routine-file/validate';
import { describeIssue } from '@/features/import/issues';

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

/** What the form's flagged field says, for the given targets. */
function fieldSays(overrides: Partial<PlannedExerciseDraft>): string {
  const file = plannedExerciseDraftFile(targets(overrides), 'Push');
  const issues = validateRoutineFile(file);
  expect(issues).toHaveLength(1);
  return describeIssue(issues[0]!, file.routine.workouts[0]!.exercises[0]!);
}

describe('describeIssue, on the add-exercise form’s file', () => {
  it('states the numbers as typed, not the path they were written to', () => {
    expect(fieldSays({ sets: 0 })).toBe('Sets is 0. Enter at least 1 set.');
    expect(fieldSays({ minReps: 8, maxReps: 5 })).toBe(
      'Min reps (8) is above max reps (5). Lower min reps, or raise max reps, so min is not above max.',
    );
    expect(fieldSays({ restSeconds: -30 })).toBe('Rest is -30 seconds. Enter 0 seconds or more.');
    expect(fieldSays({ minRir: 0, maxRir: 40 })).toBe(
      'RIR 0–40 falls outside 0–10. Set both ends of the range between 0 and 10.',
    );
  });

  it('never falls back to the raw message for a code this form can raise', () => {
    for (const overrides of [
      { sets: 0 },
      { minReps: 8, maxReps: 5 },
      { restSeconds: -30 },
      { minRir: 0, maxRir: 40 },
    ]) {
      expect(fieldSays(overrides)).not.toContain('routine.workouts');
      expect(fieldSays(overrides)).not.toContain('Push →');
    }
  });
});
