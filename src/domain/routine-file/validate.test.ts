/**
 * TST-003 — one case per semantic check of §11.1, each asserting the field
 * path, plus a clean file producing no issues (REQ-032, AC-032, AC-033).
 */

import { describe, expect, it } from 'vitest';
import { formatPath, validateRoutineFile } from '@/domain/routine-file';
import type { SemanticIssue } from '@/domain/routine-file';
import { aFile, anExercise, aWorkout } from '@/domain/routine-file/fixtures';

const pathsOf = (issues: readonly SemanticIssue[]) =>
  issues.flatMap((i) => i.paths.map(formatPath));

describe('validateRoutineFile — semantic checks (TST-003)', () => {
  it('reports nothing for a valid file', () => {
    expect(validateRoutineFile(aFile())).toEqual([]);
  });

  it('reports min_reps greater than max_reps, at the exercise reps (AC-032)', () => {
    const file = aFile([
      aWorkout({ exercises: [anExercise({ reps: { min: 8, max: 6 } })] }),
    ]);
    const issues = validateRoutineFile(file);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('reps_range_inverted');
    expect(pathsOf(issues)).toEqual([
      'routine.workouts[0].exercises[0].reps',
    ]);
  });

  it('reports RIR outside 0–10', () => {
    const issues = validateRoutineFile(
      aFile([aWorkout({ exercises: [anExercise({ rir: { min: 1, max: 11 } })] })]),
    );
    expect(issues.map((i) => i.code)).toEqual(['rir_out_of_range']);
    expect(pathsOf(issues)).toEqual(['routine.workouts[0].exercises[0].rir']);
  });

  it('reports a negative rest_seconds', () => {
    const issues = validateRoutineFile(
      aFile([aWorkout({ exercises: [anExercise({ rest_seconds: -1 })] })]),
    );
    expect(issues.map((i) => i.code)).toEqual(['rest_seconds_negative']);
    expect(pathsOf(issues)).toEqual([
      'routine.workouts[0].exercises[0].rest_seconds',
    ]);
  });

  it('reports sets less than or equal to zero', () => {
    const issues = validateRoutineFile(
      aFile([aWorkout({ exercises: [anExercise({ sets: 0 })] })]),
    );
    expect(issues.map((i) => i.code)).toEqual(['sets_not_positive']);
    expect(pathsOf(issues)).toEqual(['routine.workouts[0].exercises[0].sets']);
  });

  it('reports an unrecognized progression type', () => {
    const issues = validateRoutineFile(
      aFile([
        aWorkout({
          exercises: [anExercise({ progression: { type: 'wave_loading' } })],
        }),
      ]),
    );
    expect(issues.map((i) => i.code)).toEqual(['progression_unrecognized']);
    expect(pathsOf(issues)).toEqual([
      'routine.workouts[0].exercises[0].progression.type',
    ]);
  });

  it('reports two Workouts sharing a suggested_day, naming both (AC-033)', () => {
    const issues = validateRoutineFile(
      aFile([
        aWorkout({ name: 'Push', suggested_days: ['monday'] }),
        aWorkout({ name: 'Pull', suggested_days: ['monday', 'friday'] }),
      ]),
    );
    expect(issues.map((i) => i.code)).toEqual(['suggested_day_shared']);
    expect(pathsOf(issues)).toEqual([
      'routine.workouts[0].suggested_days[0]',
      'routine.workouts[1].suggested_days[0]',
    ]);
    expect(issues[0]?.message).toContain('monday');
  });

  it('reports every issue in a file that violates several checks', () => {
    const issues = validateRoutineFile(
      aFile([
        aWorkout({
          exercises: [
            anExercise({ sets: 0, reps: { min: 8, max: 6 } }),
            anExercise({ rest_seconds: -30 }),
          ],
        }),
      ]),
    );
    expect(issues.map((i) => i.code).sort()).toEqual([
      'reps_range_inverted',
      'rest_seconds_negative',
      'sets_not_positive',
    ]);
  });
});
