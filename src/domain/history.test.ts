import { describe, expect, it } from 'vitest';
import {
  better,
  compareProgress,
  estimateOneRepMaxKg,
  exerciseSeries,
  measurementOf,
  recordSetOf,
  summarizeExercise,
} from '@/domain/history';
import {
  toId,
  type CompletedSetId,
  type ExerciseId,
  type ExerciseSessionId,
  type PlannedExerciseId,
  type RoutineId,
  type SessionId,
  type WorkoutId,
} from '@/domain/ids';
import type { Measurement } from '@/domain/measurement';
import type { SessionHistory } from '@/domain/progression';
import type { CompletedSet, Session, SessionStatus } from '@/domain/types';
import { toKg, type Unit } from '@/domain/units';

const routineId = toId<RoutineId>('routine-1');
const workoutId = toId<WorkoutId>('workout-1');
const exerciseId = toId<ExerciseId>('front-squat');

let counter = 0;

/**
 * One CompletedSet. `values` carries the fields a non-`weight_reps` type
 * collects — seconds, distance — and `reps` takes `null` for a type counting
 * none.
 */
function set(
  weight: number,
  reps: number | null,
  unit: Unit = 'kg',
  rir = 2,
  values: Partial<
    Pick<CompletedSet, 'durationSeconds' | 'distance' | 'distanceUnit' | 'distanceM'>
  > = {},
): CompletedSet {
  counter += 1;
  return {
    id: toId<CompletedSetId>(`set-${counter}`),
    exerciseSessionId: toId<ExerciseSessionId>('es-1'),
    setNumber: counter,
    weight,
    unit,
    weightKg: toKg(weight, unit),
    reps,
    rir,
    durationSeconds: null,
    distance: null,
    distanceUnit: null,
    distanceM: null,
    completedAt: 1_000 + counter,
    ...values,
  };
}

/** A set of `seconds` seconds and no reps — a plank, a hang. */
function held(seconds: number): CompletedSet {
  return set(0, null, 'kg', 0, { durationSeconds: seconds });
}

/** A set covering `metres`, optionally in `seconds` — a run, a jump. */
function covered(metres: number, seconds: number | null = null): CompletedSet {
  return set(0, null, 'kg', 0, {
    distance: metres,
    distanceUnit: 'm',
    distanceM: metres,
    durationSeconds: seconds,
  });
}

/** One Session with one exercise and the sets given. `startedAt` orders them. */
function session(
  status: SessionStatus,
  startedAt: number,
  sets: readonly CompletedSet[],
  measurement: Measurement = 'weight_reps',
): SessionHistory {
  const record: Session = {
    id: toId<SessionId>(`session-${startedAt}`),
    routineId,
    workoutId,
    startedAt,
    completedAt: status === 'in_progress' ? null : startedAt + 1,
    status,
    bodyweightKg: null,
  };
  return {
    session: record,
    exercises: [
      {
        exerciseSession: {
          id: toId<ExerciseSessionId>(`es-${startedAt}`),
          sessionId: record.id,
          exerciseId,
          order: 0,
          status: 'performed',
          measurement,
          plannedExerciseId: toId<PlannedExerciseId>('pe-1'),
          plannedUnit: 'kg',
          plannedSets: 4,
          plannedMinReps: 4,
          plannedMaxReps: 6,
          plannedMinTarget: null,
          plannedMaxTarget: null,
          plannedMinRir: 1,
          plannedMaxRir: 2,
          plannedRestSeconds: 180,
          plannedProgression: { type: 'double_progression', increment: 2.5 },
        },
        sets,
      },
    ],
  };
}

describe('summarizeExercise (§11.10, R-6)', () => {
  it('reports nothing for an exercise never performed (AC-19)', () => {
    const summary = summarizeExercise([]);

    expect(summary).toEqual({
      measurement: 'weight_reps',
      sessions: 0,
      workingWeight: null,
      bestSet: null,
      heaviest: null,
      lightest: null,
      lastPerformed: null,
    });
  });

  it('counts only sessions that actually hold sets for the exercise', () => {
    const summary = summarizeExercise([
      session('completed', 3_000, [set(100, 5)]),
      session('completed', 2_000, []),
      session('partial', 1_000, [set(90, 8)]),
    ]);

    expect(summary.sessions).toBe(2);
  });

  it('takes the best set by load, breaking a tie on reps (A-1)', () => {
    const summary = summarizeExercise([
      session('completed', 2_000, [set(100, 5), set(100, 8), set(95, 12)]),
    ]);

    expect(summary.bestSet).toMatchObject({ weight: 100, reps: 8 });
  });

  it('keeps the earlier set when it is the one with more reps at that load', () => {
    const summary = summarizeExercise([
      session('completed', 2_000, [set(100, 8), set(100, 5)]),
    ]);

    expect(summary.bestSet).toMatchObject({ weight: 100, reps: 8 });
  });

  it('reads the working weight from the latest completed session only (A-2)', () => {
    const summary = summarizeExercise([
      // Newest, but partial — it shows in history and is ignored here (§11.9).
      session('partial', 3_000, [set(120, 3)]),
      session('completed', 2_000, [set(100, 5), set(105, 4)]),
    ]);

    expect(summary.workingWeight).toMatchObject({ weight: 105, unit: 'kg' });
  });

  // The repository hands history over newest-first, so "the latest completed
  // session" and "the last one in the array" agree by accident. Both orders are
  // asserted here, because the day they stop agreeing the working weight would
  // silently become whichever session happened to be last.
  it.each([
    ['newest first', [3_000, 1_000]],
    ['oldest first', [1_000, 3_000]],
  ])('takes the working weight from the most recent completed session, given %s', (_, order) => {
    const byStart = new Map([
      [3_000, session('completed', 3_000, [set(100, 5)])],
      [1_000, session('completed', 1_000, [set(80, 5)])],
    ]);

    const summary = summarizeExercise(order.map((at) => byStart.get(at)!));

    expect(summary.workingWeight).toMatchObject({ weight: 100 });
  });

  it('has no working weight when nothing has been completed', () => {
    const summary = summarizeExercise([session('partial', 1_000, [set(80, 5)])]);

    expect(summary.workingWeight).toBeNull();
    expect(summary.bestSet).not.toBeNull();
  });

  it('spans every session, of any status, for heaviest and lightest (A-3)', () => {
    const summary = summarizeExercise([
      session('completed', 3_000, [set(100, 5)]),
      session('partial', 2_000, [set(130, 1)]),
      session('completed', 1_000, [set(70, 12)]),
    ]);

    expect(summary.heaviest?.weight).toBe(130);
    expect(summary.lightest?.weight).toBe(70);
  });

  it('compares in kilograms, so a pound set is not mistaken for a heavy one', () => {
    const summary = summarizeExercise([
      session('completed', 2_000, [set(100, 5, 'lb'), set(50, 5, 'kg')]),
    ]);

    // 100 lb is 45.36 kg — lighter than 50 kg despite the larger number.
    expect(summary.heaviest).toMatchObject({ weight: 50, unit: 'kg' });
    expect(summary.lightest).toMatchObject({ weight: 100, unit: 'lb' });
  });

  it('reports the most recent session that holds sets as last performed', () => {
    const summary = summarizeExercise([
      session('completed', 5_000, []),
      session('completed', 4_000, [set(100, 5)]),
    ]);

    expect(summary.lastPerformed).toBe(4_000);
  });
});

describe('exerciseSeries (§11.11, R-1)', () => {
  it('returns nothing for an exercise never performed (AC-1f)', () => {
    expect(exerciseSeries([])).toEqual([]);
  });

  it('reads oldest first, whatever order it is handed (AC-1a)', () => {
    // `listExerciseHistory` returns newest first; a chart reads left to right.
    const series = exerciseSeries([
      session('completed', 3_000, [set(100, 5)]),
      session('completed', 1_000, [set(80, 5)]),
      session('completed', 2_000, [set(90, 5)]),
    ]);

    expect(series.map((point) => point.startedAt)).toEqual([1_000, 2_000, 3_000]);
  });

  it('sums the reps and the volume of a session, and takes its top load (AC-1b)', () => {
    const series = exerciseSeries([session('completed', 2_000, [set(100, 5), set(100, 3)])]);

    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ topSetKg: 100, reps: 8, volume: 800 });
  });

  it('skips a session that holds no sets for the exercise (AC-1c)', () => {
    const series = exerciseSeries([
      session('completed', 2_000, [set(100, 5)]),
      session('completed', 1_000, []),
    ]);

    expect(series).toHaveLength(1);
    expect(series[0]?.startedAt).toBe(2_000);
  });

  it('collapses two exercise sessions of the same exercise into one point (AC-1d)', () => {
    // Planned, then the same movement again as an unplanned exercise. It is one
    // session's work and it is one point on the chart.
    const twice = session('completed', 2_000, [set(100, 5)]);
    const series = exerciseSeries([
      {
        ...twice,
        exercises: [...twice.exercises, ...session('completed', 2_000, [set(60, 10)]).exercises],
      },
    ]);

    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ topSetKg: 100, reps: 15, volume: 1_100 });
  });

  it('takes the top set by load, breaking a tie on reps (AC-1e)', () => {
    const series = exerciseSeries([session('completed', 2_000, [set(100, 3), set(100, 6)])]);

    expect(series[0]).toMatchObject({ topSetKg: 100, topSetReps: 6 });
  });

  it('dates a point by the local day the session started', () => {
    const at = new Date(2026, 7, 18, 19, 30).getTime();
    const series = exerciseSeries([session('completed', at, [set(100, 5)])]);

    expect(series[0]?.date).toBe('2026-08-18');
  });

  it('counts sessions of every status that hold sets (AC-2)', () => {
    const series = exerciseSeries([
      session('completed', 3_000, [set(100, 5)]),
      session('partial', 2_000, [set(90, 5)]),
      session('in_progress', 1_000, [set(80, 5)]),
    ]);

    expect(series).toHaveLength(3);
  });

  it('measures in kilograms, so a pound set is not mistaken for a heavy one (AC-3)', () => {
    const series = exerciseSeries([session('completed', 2_000, [set(100, 5, 'lb'), set(50, 5)])]);

    // 100 lb is 45.36 kg — lighter than 50 kg despite the larger number.
    expect(series[0]?.topSetKg).toBe(50);
    expect(series[0]?.volume).toBeCloseTo(50 * 5 + toKg(100, 'lb') * 5, 6);
  });
});

describe('estimateOneRepMaxKg', () => {
  // Epley over reps *and* RIR (§30): a set stopped short of failure demonstrates
  // more than its reps alone say, and the app records how short on purpose.
  it.each([
    [100, 5, 0, 116.67],
    [100, 1, 0, 103.33],
    [100, 5, 2, 123.33],
    [100, 0, 0, 100],
  ])('estimates %d kg x %d @ RIR %d as %d', (weight, reps, rir, expected) => {
    expect(estimateOneRepMaxKg(set(weight, reps, 'kg', rir), 'weight_reps')).toBeCloseTo(
      expected,
      2,
    );
  });

  it('reads weightKg, so a pound set is not estimated from its own number', () => {
    const pounds = set(225, 5, 'lb', 0);
    expect(estimateOneRepMaxKg(pounds, 'weight_reps')).toBeCloseTo(
      pounds.weightKg * (1 + 5 / 30),
      6,
    );
    expect(estimateOneRepMaxKg(pounds, 'weight_reps')).toBeLessThan(225);
  });
});

describe('exerciseSeries — estimated 1RM and records', () => {
  it('takes the best estimate of the session, not the estimate of the top set', () => {
    // better() picks the heavier set; under Epley the lighter one demonstrates
    // more. Reading the estimate off the top set would throw that day away.
    const [point] = exerciseSeries([
      session('completed', 1, [set(100, 5, 'kg', 0), set(110, 1, 'kg', 0)]),
    ]);
    expect(point!.topSetKg).toBe(110);
    expect(point!.estimatedOneRepMaxKg).toBeCloseTo(116.67, 2);
  });

  it('never estimates below the load actually lifted', () => {
    const points = exerciseSeries([
      session('completed', 1, [set(60, 12, 'kg', 3)]),
      session('completed', 2, [set(140, 1, 'kg', 0)]),
    ]);
    for (const point of points) {
      expect(point.estimatedOneRepMaxKg).toBeGreaterThanOrEqual(point.topSetKg);
    }
  });

  it('marks a record only when it beats every earlier session', () => {
    // 100, 105, 105, 103, 110 — the repeat is not a record, the dip is not, and
    // the opening session has nothing to beat.
    const points = exerciseSeries([
      session('completed', 1, [set(100, 0, 'kg', 0)]),
      session('completed', 2, [set(105, 0, 'kg', 0)]),
      session('completed', 3, [set(105, 0, 'kg', 0)]),
      session('completed', 4, [set(103, 0, 'kg', 0)]),
      session('completed', 5, [set(110, 0, 'kg', 0)]),
    ]);
    expect(points.map((point) => point.isRecord)).toEqual([false, true, false, false, true]);
  });

  it('never marks the first session, even alone', () => {
    const points = exerciseSeries([session('completed', 1, [set(100, 5)])]);
    expect(points.map((point) => point.isRecord)).toEqual([false]);
  });

  it('judges records after sorting, not in the order handed over', () => {
    // The repository returns history newest first; a running maximum read in
    // that order would mark the oldest session and miss the newest.
    const points = exerciseSeries([
      session('completed', 3, [set(110, 0, 'kg', 0)]),
      session('completed', 1, [set(100, 0, 'kg', 0)]),
      session('completed', 2, [set(105, 0, 'kg', 0)]),
    ]);
    expect(points.map((point) => point.isRecord)).toEqual([false, true, true]);
  });

  it('holds a record in an unfinished session, on the rule the series already uses', () => {
    const points = exerciseSeries([
      session('completed', 1, [set(100, 0, 'kg', 0)]),
      session('in_progress', 2, [set(120, 0, 'kg', 0)]),
    ]);
    expect(points.map((point) => point.isRecord)).toEqual([false, true]);
  });
});

describe('better — the two inverted axes (TST-103, REQ-103, REQ-113)', () => {
  it('TST-103: prefers the less assisted set for assisted_bodyweight', () => {
    const less = set(15, 5);
    const more = set(20, 5);

    expect(better(less, more, 'assisted_bodyweight')).toBe(less);
    expect(better(more, less, 'assisted_bodyweight')).toBe(less);
  });

  it('TST-103: breaks a tie in assistance on reps — the more work at that band', () => {
    const fewer = set(20, 5);
    const further = set(20, 8);

    expect(better(fewer, further, 'assisted_bodyweight')).toBe(further);
    expect(better(further, fewer, 'assisted_bodyweight')).toBe(further);
  });

  it('TST-103: prefers the lower pace for distance_duration', () => {
    // 1000 m in 300 s is 0.30 s/m; the same kilometre in 360 s is 0.36.
    const faster = covered(1_000, 300);
    const slower = covered(1_000, 360);

    expect(better(faster, slower, 'distance_duration')).toBe(faster);
    expect(better(slower, faster, 'distance_duration')).toBe(faster);
  });

  it('TST-103: breaks a tie in pace on distance — the longer run at that pace', () => {
    const shorter = covered(1_000, 300);
    const longer = covered(2_000, 600);

    expect(better(shorter, longer, 'distance_duration')).toBe(longer);
    expect(better(longer, shorter, 'distance_duration')).toBe(longer);
  });

  it('AC-168: the longer broad jump is the better set for distance', () => {
    const short = covered(210);
    const long = covered(240);

    expect(better(short, long, 'distance')).toBe(long);
    expect(better(long, short, 'distance')).toBe(long);
  });

  it('compareProgress orders a value pair in the type own direction', () => {
    expect(compareProgress(15, 20, 'assisted_bodyweight')).toBeGreaterThan(0);
    expect(compareProgress(20, 15, 'assisted_bodyweight')).toBeLessThan(0);
    expect(compareProgress(0.28, 0.3, 'distance_duration')).toBeGreaterThan(0);
    expect(compareProgress(110, 100, 'weight_reps')).toBeGreaterThan(0);
    // A set carrying nothing on the axis loses to any value there is.
    expect(compareProgress(null, 100, 'weight_reps')).toBeLessThan(0);
  });
});

describe('exerciseSeries — no record for a worse value on an inverted axis (TST-104)', () => {
  it('TST-104: assistance falling then rising records only the fall', () => {
    // 20 kg of band, then 15, then 25. A running *maximum* would crown the 25 kg
    // session — the most assisted, which is the worst there has been.
    const points = exerciseSeries([
      session('completed', 1, [set(20, 5)], 'assisted_bodyweight'),
      session('completed', 2, [set(15, 5)], 'assisted_bodyweight'),
      session('completed', 3, [set(25, 5)], 'assisted_bodyweight'),
    ]);

    expect(points.map((point) => point.progressValue)).toEqual([20, 15, 25]);
    expect(points.map((point) => point.isRecord)).toEqual([false, true, false]);
  });

  it('TST-104: pace quickening then slowing records only the quickening', () => {
    const points = exerciseSeries([
      session('completed', 1, [covered(1_000, 300)], 'distance_duration'),
      session('completed', 2, [covered(1_000, 280)], 'distance_duration'),
      session('completed', 3, [covered(1_000, 320)], 'distance_duration'),
    ]);

    expect(points.map((point) => point.pace)).toEqual([0.3, 0.28, 0.32]);
    expect(points.map((point) => point.isRecord)).toEqual([false, true, false]);
  });

  it('AC-168: a jump longer than every earlier session is a record', () => {
    const points = exerciseSeries([
      session('completed', 1, [covered(210)], 'distance'),
      session('completed', 2, [covered(250)], 'distance'),
      session('completed', 3, [covered(230)], 'distance'),
    ]);

    expect(points.map((point) => point.isRecord)).toEqual([false, true, false]);
  });
});

describe('estimateOneRepMaxKg — the seven types with none (TST-106, REQ-114, DEC-P)', () => {
  const withoutEstimate = [
    'bodyweight_reps',
    'assisted_bodyweight',
    'duration',
    'duration_weight',
    'distance_duration',
    'weight_distance',
    'distance',
  ] as const satisfies readonly Measurement[];

  it.each(withoutEstimate)('TST-106: %s has no estimate and no substitute', (measurement) => {
    expect(estimateOneRepMaxKg(set(60, 8), measurement)).toBeNull();
  });

  it('TST-106: the two loaded-with-reps types do have one', () => {
    expect(estimateOneRepMaxKg(set(100, 5, 'kg', 0), 'weight_reps')).toBeCloseTo(116.67, 2);
    expect(estimateOneRepMaxKg(set(20, 5, 'kg', 1), 'weighted_bodyweight')).toBeCloseTo(24, 6);
  });

  it('AC-120: a duration series carries a null estimate throughout', () => {
    const points = exerciseSeries([
      session('completed', 1, [held(30)], 'duration'),
      session('completed', 2, [held(45)], 'duration'),
    ]);

    expect(points.map((point) => point.estimatedOneRepMaxKg)).toEqual([null, null]);
  });
});

describe('estimateOneRepMaxKg — weighted bodyweight is the added weight (TST-126)', () => {
  // 20 x (1 + (5 + 1) / 30) = 24. The number a stored `weighted-dip` history
  // already estimates, and this change does not move it.
  const stored = set(20, 5, 'kg', 1);

  it('TST-126: estimates the added weight by Epley over reps and RIR', () => {
    expect(estimateOneRepMaxKg(stored, 'weighted_bodyweight')).toBe(20 * (1 + (5 + 1) / 30));
    expect(estimateOneRepMaxKg(stored, 'weighted_bodyweight')).toBe(24);
  });

  it('AC-160: recording Session.bodyweightKg does not restate the estimate', () => {
    const weighed = session('completed', 1, [stored], 'weighted_bodyweight');
    const points = exerciseSeries([
      { ...weighed, session: { ...weighed.session, bodyweightKg: 82.5 } },
    ]);

    expect(points[0]?.estimatedOneRepMaxKg).toBe(24);
  });
});

describe('measurementOf (REQ-125, REQ-133)', () => {
  it('reads the type off the ExerciseSession snapshot', () => {
    expect(measurementOf([session('completed', 1, [held(30)], 'duration')])).toBe('duration');
  });

  it('reads weight_reps for an empty history — the migration own fallback', () => {
    expect(measurementOf([])).toBe('weight_reps');
  });

  it('passes over a session holding no exercises at all', () => {
    const jump = session('completed', 1, [covered(210)], 'distance');
    expect(measurementOf([{ ...jump, exercises: [] }, jump])).toBe('distance');
  });
});

describe('recordSetOf (REQ-115)', () => {
  it('credits the set with the highest estimate for a 1RM type, not the heaviest', () => {
    const heavy = set(110, 1, 'kg', 0);
    const demonstrative = set(100, 5, 'kg', 0);

    expect(recordSetOf([heavy, demonstrative], 'weight_reps')).toBe(demonstrative);
  });

  it('credits the best set on the progress axis for a type with no estimate', () => {
    const less = set(15, 5);
    const more = set(20, 5);

    expect(recordSetOf([more, less], 'assisted_bodyweight')).toBe(less);
  });

  it('credits the fastest run of a session', () => {
    const faster = covered(1_000, 300);
    const slower = covered(1_000, 360);

    expect(recordSetOf([slower, faster], 'distance_duration')).toBe(faster);
  });
});

describe('exerciseSeries — volume never leaves its own family (REQ-116, DEC-D)', () => {
  it('REQ-116: a duration series accumulates seconds', () => {
    const [point] = exerciseSeries([
      session('completed', 1, [held(30), held(45)], 'duration'),
    ]);

    expect(point?.volumeFamily).toBe('seconds');
    expect(point?.volume).toBe(75);
    expect(point?.durationSeconds).toBe(75);
  });

  it('REQ-116: a distance series accumulates metres', () => {
    const [point] = exerciseSeries([
      session('completed', 1, [covered(210), covered(240)], 'distance'),
    ]);

    expect(point?.volumeFamily).toBe('metres');
    expect(point?.volume).toBe(450);
    expect(point?.distanceM).toBe(450);
  });

  it('REQ-116: weight_reps still accumulates kilogram-reps', () => {
    const [point] = exerciseSeries([session('completed', 1, [set(100, 5), set(100, 3)])]);

    expect(point?.volumeFamily).toBe('kg_reps');
    expect(point?.volume).toBe(800);
  });
});
