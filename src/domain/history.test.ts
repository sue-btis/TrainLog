import { describe, expect, it } from 'vitest';
import { exerciseSeries, summarizeExercise } from '@/domain/history';
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
import type { SessionHistory } from '@/domain/progression';
import type { CompletedSet, Session, SessionStatus } from '@/domain/types';
import { toKg, type Unit } from '@/domain/units';

const routineId = toId<RoutineId>('routine-1');
const workoutId = toId<WorkoutId>('workout-1');
const exerciseId = toId<ExerciseId>('front-squat');

let counter = 0;

function set(weight: number, reps: number, unit: Unit = 'kg'): CompletedSet {
  counter += 1;
  return {
    id: toId<CompletedSetId>(`set-${counter}`),
    exerciseSessionId: toId<ExerciseSessionId>('es-1'),
    setNumber: counter,
    weight,
    unit,
    weightKg: toKg(weight, unit),
    reps,
    rir: 2,
    completedAt: 1_000 + counter,
  };
}

/** One Session with one exercise and the sets given. `startedAt` orders them. */
function session(
  status: SessionStatus,
  startedAt: number,
  sets: readonly CompletedSet[],
): SessionHistory {
  const record: Session = {
    id: toId<SessionId>(`session-${startedAt}`),
    routineId,
    workoutId,
    startedAt,
    completedAt: status === 'in_progress' ? null : startedAt + 1,
    status,
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
          plannedExerciseId: toId<PlannedExerciseId>('pe-1'),
          plannedUnit: 'kg',
          plannedSets: 4,
          plannedMinReps: 4,
          plannedMaxReps: 6,
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
    expect(series[0]).toMatchObject({ topSetKg: 100, reps: 8, volumeKg: 800 });
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
    expect(series[0]).toMatchObject({ topSetKg: 100, reps: 15, volumeKg: 1_100 });
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
    expect(series[0]?.volumeKg).toBeCloseTo(50 * 5 + toKg(100, 'lb') * 5, 6);
  });
});
