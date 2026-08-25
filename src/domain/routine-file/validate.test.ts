/**
 * TST-003 — one case per semantic check of §11.1, each asserting the field
 * path, plus a clean file producing no issues (REQ-032, AC-032, AC-033).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatPath, parseRoutineFile, validateRoutineFile } from '@/domain/routine-file';
import type {
  RoutineFile,
  RoutineFileExercise,
  SemanticIssue,
} from '@/domain/routine-file';
import { aFile, anExercise, aWorkout } from '@/domain/routine-file/fixtures';
import { toId, type ExerciseId } from '@/domain/ids';
import type { Exercise } from '@/domain/types';

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

// ------------------------------------------------------- TST-129, REQ-139

/**
 * The axis check (REQ-139, AC-166). A range on the wrong axis is the one
 * semantic problem the file cannot reveal on its own: `reps` under a movement
 * measured in seconds maps to a PlannedExercise with *neither* pair populated,
 * which imports without complaint and only surfaces later, when the lifter's
 * own backup refuses to restore. So it is checked here, against the Exercise
 * the import will actually bind to — and only when the caller can supply one.
 */

/** A v2 file holding one Workout of `exercises`; v2 is where `target` exists. */
const v2 = (...exercises: RoutineFileExercise[]): RoutineFile => ({
  ...aFile([aWorkout({ exercises })]),
  version: 2,
});

const mismatches = (issues: readonly SemanticIssue[]) =>
  issues.filter((i) => i.code === 'target_axis_mismatch');

/** The lifter's own Exercise: not in the catalog, and typed by them, not by a file. */
const MY_LONG_HOLD: Exercise = {
  id: toId<ExerciseId>('user-long-hold'),
  name: 'My Long Hold',
  category: null,
  equipment: null,
  measurement: 'duration',
};

describe('validateRoutineFile — target axis mismatch (TST-129, REQ-139, AC-166)', () => {
  it('reports a rep range on a movement the catalog measures in seconds', () => {
    // No `exercise_id`, so "Plank" resolves by name to the catalog's duration
    // row — the exact shape the shipped blocks used to be written in.
    const issues = validateRoutineFile(
      v2(anExercise({ name: 'Plank', reps: { min: 1, max: 1 } })),
      { knownExercises: [] },
    );

    expect(issues.map((i) => i.code)).toEqual(['target_axis_mismatch']);
    expect(pathsOf(issues)).toEqual(['routine.workouts[0].exercises[0].reps']);
    // The message must name the movement and the unit, or the lifter is told a
    // field is wrong without being told what to write in it.
    expect(issues[0]?.message).toContain('Plank');
    expect(issues[0]?.message).toContain('seconds');
    expect(issues[0]?.message).toContain('target');
  });

  it('reports a target range on a movement the catalog counts in repetitions', () => {
    const issues = validateRoutineFile(
      v2(anExercise({ reps: undefined, target: { min: 45, max: 60 } })),
      { knownExercises: [] },
    );

    expect(issues.map((i) => i.code)).toEqual(['target_axis_mismatch']);
    expect(pathsOf(issues)).toEqual(['routine.workouts[0].exercises[0].target']);
    expect(issues[0]?.message).toContain('Front Squat');
    expect(issues[0]?.message).toContain('counted in repetitions');
  });

  // Presence of `knownExercises` is the opt-in, and an empty array is a
  // meaningful answer — a lifter who owns no Exercise of their own — not a way
  // of saying "do not check". The catalog is consulted either way.
  it('skips the check when the caller passes no options at all', () => {
    const file = v2(anExercise({ name: 'Plank', reps: { min: 1, max: 1 } }));
    expect(mismatches(validateRoutineFile(file))).toEqual([]);
  });

  it('runs the check for a lifter with an empty exercise list', () => {
    const file = v2(anExercise({ name: 'Plank', reps: { min: 1, max: 1 } }));
    expect(mismatches(validateRoutineFile(file, { knownExercises: [] }))).toHaveLength(1);
  });

  it('stays silent when the axis and the range agree', () => {
    const clean = [
      // A catalog duration movement stating seconds.
      anExercise({ name: 'Plank', reps: undefined, target: { min: 30, max: 60 } }),
      // A catalog rep movement stating reps.
      anExercise(),
      // A movement the import will mint, declaring its own type (REQ-130).
      anExercise({
        name: 'Weighted Sled Drag',
        measurement: 'duration',
        reps: undefined,
        target: { min: 20, max: 40 },
      }),
      // A movement the import will mint with no declaration: weight x reps,
      // which is what every version-1 file has always meant (DEC-K).
      anExercise({ name: 'Some Novel Press', reps: { min: 8, max: 12 } }),
    ];

    for (const exercise of clean) {
      expect(mismatches(validateRoutineFile(v2(exercise), { knownExercises: [] }))).toEqual([]);
    }
  });

  // `exercise_id` is consulted before the name (§26), so the id decides the
  // axis even when the name alone would have pointed somewhere else.
  it('judges by exercise_id rather than by a name that would resolve elsewhere', () => {
    const byId = { name: 'Plank', exercise_id: 'front-squat' };

    expect(
      mismatches(
        validateRoutineFile(v2(anExercise({ ...byId, reps: { min: 5, max: 8 } })), {
          knownExercises: [],
        }),
      ),
    ).toEqual([]);

    const issues = mismatches(
      validateRoutineFile(
        v2(anExercise({ ...byId, reps: undefined, target: { min: 30, max: 45 } })),
        { knownExercises: [] },
      ),
    );
    expect(pathsOf(issues)).toEqual(['routine.workouts[0].exercises[0].target']);
  });

  // A file cannot retype an Exercise that already exists (REQ-131): the
  // incumbent's measurement decides the axis, and `measurement:` in the file is
  // only ever read where the import mints something new.
  it('reads the axis from the lifter own Exercise rather than minting a new one', () => {
    const options = { knownExercises: [MY_LONG_HOLD] };

    const flagged = mismatches(
      validateRoutineFile(
        v2(anExercise({ name: 'My Long Hold', reps: { min: 1, max: 1 } })),
        options,
      ),
    );
    expect(pathsOf(flagged)).toEqual(['routine.workouts[0].exercises[0].reps']);
    expect(flagged[0]?.message).toContain('seconds');

    expect(
      mismatches(
        validateRoutineFile(
          v2(anExercise({ name: 'My Long Hold', reps: undefined, target: { min: 30, max: 60 } })),
          options,
        ),
      ),
    ).toEqual([]);
  });

  // Two pairs or none is a different problem with a different fix, and saying
  // both at once would ask the lifter to correct the axis of a field they have
  // not decided on yet.
  it('leaves an ambiguous or missing pair to its own check, adding nothing', () => {
    const both = validateRoutineFile(
      v2(anExercise({ name: 'Plank', reps: { min: 1, max: 1 }, target: { min: 30, max: 60 } })),
      { knownExercises: [] },
    );
    expect(both.map((i) => i.code)).toEqual(['target_pair_ambiguous']);

    const neither = validateRoutineFile(
      v2(anExercise({ name: 'Plank', reps: undefined })),
      { knownExercises: [] },
    );
    expect(neither.map((i) => i.code)).toEqual(['target_pair_missing']);
  });
});

/**
 * The regression that matters: the three files the lifter actually imports.
 * They are read from disk the way `to-domain.test.ts` reads them, rather than
 * restated here — a copy would keep passing after the originals rotted.
 */
describe('the shipped files validate clean with the axis check on (TST-129, REQ-139)', () => {
  it.each([
    'bloque-a-acumulacion.yaml',
    'bloque-b-intensificacion.yaml',
    'examples/hibrido-v2.yaml',
  ])('%s', (name) => {
    const text = readFileSync(
      fileURLToPath(new URL(`../../../docs/${name}`, import.meta.url)),
      'utf8',
    );
    const result = parseRoutineFile(text);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));

    expect(validateRoutineFile(result.file, { knownExercises: [] })).toEqual([]);
  });
});
