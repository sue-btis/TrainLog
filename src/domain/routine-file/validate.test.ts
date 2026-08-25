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

  it('reports a routine that declares no Workouts, addressed to no field', () => {
    const issues = validateRoutineFile(aFile([]));
    expect(issues.map((i) => i.code)).toEqual(['routine_has_no_workouts']);
    // No field to jump to: the issue is that none exists. `indexIssues` skips
    // an issue with no paths and `jumpToIssue` returns early on one.
    expect(pathsOf(issues)).toEqual([]);
  });

  it('accepts a Workout with no exercises — only the routine must be non-empty', () => {
    expect(validateRoutineFile(aFile([aWorkout({ exercises: [] })]))).toEqual([]);
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

  it('refuses an exercise stating both a rep range and a target range (TST-128, REQ-139, AC-166)', () => {
    const issues = validateRoutineFile(
      aFile([
        aWorkout({
          exercises: [
            anExercise({ reps: { min: 8, max: 12 }, target: { min: 45, max: 60 } }),
          ],
        }),
      ]),
    );
    expect(issues.map((i) => i.code)).toEqual(['target_pair_ambiguous']);
    expect(pathsOf(issues)).toEqual([
      'routine.workouts[0].exercises[0].reps',
      'routine.workouts[0].exercises[0].target',
    ]);
  });

  it('refuses an exercise stating neither range (TST-128, REQ-139, AC-166)', () => {
    const issues = validateRoutineFile(
      aFile([aWorkout({ exercises: [anExercise({ reps: undefined })] })]),
    );
    expect(issues.map((i) => i.code)).toEqual(['target_pair_missing']);
    expect(pathsOf(issues)).toEqual(['routine.workouts[0].exercises[0].reps']);
  });

  it('reports a target range that runs backwards', () => {
    const issues = validateRoutineFile(
      aFile([
        aWorkout({
          exercises: [anExercise({ reps: undefined, target: { min: 60, max: 45 } })],
        }),
      ]),
    );
    expect(issues.map((i) => i.code)).toEqual(['target_range_inverted']);
    expect(pathsOf(issues)).toEqual(['routine.workouts[0].exercises[0].target']);
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
