/**
 * What the logger decides before a set is stored (FR-14, §32, REQ-106, REQ-110).
 *
 * Four seams, and each is a place a measurement type is consulted rather than
 * guessed at: which window the fields are marked against (`targetsOf`), whether
 * the green button is allowed at all (`isComplete`), which values reach the
 * domain and which become `null` (`valuesFor`), and the way back from a stored
 * set into the form (`valuesOf`).
 *
 * The three per-type tables below are keyed by `Measurement`, so a tenth type
 * added to the union fails to compile here before it can slip through untested.
 *
 * The failures these guard against are the quiet ones: a `null` RIR range read
 * as a range, which would mark every RIR a lifter enters as "off plan" against
 * a plan that never asked for one; and a plank refused because it logged no
 * reps.
 */

import { describe, expect, it } from 'vitest';
import { toId } from '@/domain/ids';
import type {
  CompletedSetId,
  ExerciseId,
  ExerciseSessionId,
  PlannedExerciseId,
  SessionId,
} from '@/domain/ids';
import { MEASUREMENTS, type Measurement } from '@/domain/measurement';
import type { CompletedSet, ExerciseSession } from '@/domain/types';
import {
  EMPTY_VALUES,
  isComplete,
  NO_TARGETS,
  targetsOf,
  valuesFor,
  valuesOf,
  type SetValues,
} from '@/features/session/SetLogger';

const planned: ExerciseSession = {
  id: toId<ExerciseSessionId>('es-1'),
  sessionId: toId<SessionId>('se-1'),
  exerciseId: toId<ExerciseId>('back-squat'),
  order: 0,
  status: 'performed',
  measurement: 'weight_reps',
  plannedExerciseId: toId<PlannedExerciseId>('pe-1'),
  plannedUnit: 'kg',
  plannedSets: 4,
  plannedMinReps: 4,
  plannedMaxReps: 6,
  plannedMinTarget: null,
  plannedMaxTarget: null,
  plannedMinRir: 1,
  plannedMaxRir: 2,
  plannedRestSeconds: 210,
  plannedProgression: { type: 'double_progression', increment: 2.5 },
};

describe('targetsOf (FR-14)', () => {
  it('takes both windows off the snapshot', () => {
    expect(targetsOf(planned)).toEqual({ primary: [4, 6], rir: [1, 2] });
  });

  it('leaves RIR unbounded when the programme stated none (§32)', () => {
    expect(targetsOf({ ...planned, plannedMinRir: null, plannedMaxRir: null })).toEqual({
      primary: [4, 6],
      rir: null,
    });
  });

  it('leaves RIR unbounded when only one end is stated', () => {
    expect(targetsOf({ ...planned, plannedMaxRir: null }).rir).toBeNull();
  });

  it('gives an unplanned exercise nothing to deviate from', () => {
    const unplanned: ExerciseSession = {
      id: toId<ExerciseSessionId>('es-2'),
      sessionId: toId<SessionId>('se-1'),
      exerciseId: toId<ExerciseId>('curl'),
      order: 1,
      status: 'performed',
      measurement: 'weight_reps',
      plannedExerciseId: null,
    };
    expect(targetsOf(unplanned)).toEqual(NO_TARGETS);
  });

  it('REQ-139: reads a non-rep window off the target pair', () => {
    expect(
      targetsOf({
        ...planned,
        measurement: 'duration',
        plannedMinReps: null,
        plannedMaxReps: null,
        plannedMinTarget: 45,
        plannedMaxTarget: 60,
      }).primary,
    ).toEqual([45, 60]);
  });

  it('REQ-139: the measurement decides which pair is read, not which is non-null', () => {
    // A rep-axis type with the *target* pair populated instead: reading whichever
    // field happens to be non-null would yield [45, 60]; reading the measurement
    // yields nothing, which is the truth — this plan states no rep window.
    expect(
      targetsOf({
        ...planned,
        plannedMinReps: null,
        plannedMaxReps: null,
        plannedMinTarget: 45,
        plannedMaxTarget: 60,
      }).primary,
    ).toBeNull();
  });
});

/**
 * The field each type's primary axis is read from, named for all nine. A tenth
 * type cannot be added to the union without stating its answer here.
 */
const primaryField: { readonly [M in Measurement]: 'reps' | 'durationSeconds' | 'distance' } = {
  weight_reps: 'reps',
  bodyweight_reps: 'reps',
  weighted_bodyweight: 'reps',
  assisted_bodyweight: 'reps',
  duration: 'durationSeconds',
  duration_weight: 'durationSeconds',
  distance_duration: 'distance',
  weight_distance: 'distance',
  distance: 'distance',
};

describe('isComplete (TST-125, REQ-110, AC-115)', () => {
  it.each(MEASUREMENTS)('TST-125: %s refuses a set with nothing on its primary axis', (m) => {
    expect(isComplete(m, EMPTY_VALUES)).toBe(false);
    expect(isComplete(m, { ...EMPTY_VALUES, [primaryField[m]]: 0 })).toBe(false);
  });

  it.each(MEASUREMENTS)('TST-125: %s logs a set that has its primary axis', (m) => {
    expect(isComplete(m, { ...EMPTY_VALUES, [primaryField[m]]: 30 })).toBe(true);
  });

  it('AC-115: a plank held for no seconds is not a set', () => {
    expect(isComplete('duration', { ...EMPTY_VALUES, durationSeconds: 0 })).toBe(false);
  });

  it('AC-115: a plank held 30 seconds for zero reps is — reps is no longer the guard', () => {
    expect(isComplete('duration', { ...EMPTY_VALUES, durationSeconds: 30, reps: 0 })).toBe(true);
  });

  it('AC-115: a jump of no distance is not a set', () => {
    expect(isComplete('distance', { ...EMPTY_VALUES, distance: 0 })).toBe(false);
  });

  it('REQ-110: a loaded set with no reps is not a set', () => {
    expect(isComplete('weight_reps', { ...EMPTY_VALUES, weight: 60, reps: 0 })).toBe(false);
  });

  it('REQ-110: five reps at no load is — a bodyweight exercise is real training', () => {
    expect(isComplete('weight_reps', { ...EMPTY_VALUES, weight: 0, reps: 5 })).toBe(true);
  });
});

describe('valuesFor (REQ-106, AC-107, AC-167)', () => {
  const entered: SetValues = {
    weight: 60,
    reps: 5,
    rir: 1,
    durationSeconds: 30,
    distance: 5,
    distanceUnit: 'km',
  };

  /** The projection, named for all nine — every field of every type, stated. */
  const projected: { readonly [M in Measurement]: ReturnType<typeof valuesFor> } = {
    weight_reps: { weight: 60, reps: 5, durationSeconds: null, distance: null, distanceUnit: null },
    bodyweight_reps: {
      weight: 0,
      reps: 5,
      durationSeconds: null,
      distance: null,
      distanceUnit: null,
    },
    weighted_bodyweight: {
      weight: 60,
      reps: 5,
      durationSeconds: null,
      distance: null,
      distanceUnit: null,
    },
    assisted_bodyweight: {
      weight: 60,
      reps: 5,
      durationSeconds: null,
      distance: null,
      distanceUnit: null,
    },
    duration: { weight: 0, reps: null, durationSeconds: 30, distance: null, distanceUnit: null },
    duration_weight: {
      weight: 60,
      reps: null,
      durationSeconds: 30,
      distance: null,
      distanceUnit: null,
    },
    distance_duration: {
      weight: 0,
      reps: null,
      durationSeconds: 30,
      distance: 5,
      distanceUnit: 'km',
    },
    weight_distance: {
      weight: 60,
      reps: null,
      durationSeconds: null,
      distance: 5,
      distanceUnit: 'km',
    },
    distance: { weight: 0, reps: null, durationSeconds: null, distance: 5, distanceUnit: 'km' },
  };

  it.each(MEASUREMENTS)('REQ-106: %s carries its own fields and nulls the rest', (m) => {
    expect(valuesFor(m, entered)).toEqual(projected[m]);
  });

  it('AC-107: a duration type stores seconds, and no reps, distance or unit', () => {
    expect(valuesFor('duration', entered)).toEqual({
      weight: 0,
      reps: null,
      durationSeconds: 30,
      distance: null,
      distanceUnit: null,
    });
  });

  it('AC-107: a distance type stores a distance and its unit, and no reps or seconds', () => {
    expect(valuesFor('distance', entered)).toEqual({
      weight: 0,
      reps: null,
      durationSeconds: null,
      distance: 5,
      distanceUnit: 'km',
    });
  });

  it('AC-167: weight_reps stores reps, and none of the three new fields', () => {
    expect(valuesFor('weight_reps', entered)).toEqual({
      weight: 60,
      reps: 5,
      durationSeconds: null,
      distance: null,
      distanceUnit: null,
    });
  });

  it('AC-109: the distance is kept as entered, in its own unit — the metres are derived', () => {
    const run = valuesFor('distance_duration', entered);
    expect(run.distance).toBe(5);
    expect(run.distanceUnit).toBe('km');
  });
});

describe('valuesOf', () => {
  const set: CompletedSet = {
    id: toId<CompletedSetId>('cs-1'),
    exerciseSessionId: toId<ExerciseSessionId>('es-1'),
    setNumber: 1,
    weight: 60,
    unit: 'kg',
    weightKg: 60,
    reps: 5,
    rir: 2,
    durationSeconds: null,
    distance: null,
    distanceUnit: null,
    distanceM: null,
    completedAt: 1_755_100_000_000,
  };

  it('round-trips a logged set into form values, the nulls as zeros', () => {
    expect(valuesOf(set)).toEqual({
      weight: 60,
      reps: 5,
      rir: 2,
      durationSeconds: 0,
      distance: 0,
      distanceUnit: 'm',
    });
  });

  it('keeps the distance and the unit a run was logged in', () => {
    expect(
      valuesOf({
        ...set,
        reps: null,
        durationSeconds: 1800,
        distance: 5,
        distanceUnit: 'km',
        distanceM: 5000,
      }),
    ).toEqual({
      weight: 60,
      reps: 0,
      rir: 2,
      durationSeconds: 1800,
      distance: 5,
      distanceUnit: 'km',
    });
  });
});
