import { describe, expect, it } from 'vitest';
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
import { summarizeSession } from '@/domain/session-summary';
import type { CompletedSet, Session, SessionStatus } from '@/domain/types';
import { toKg, type Unit } from '@/domain/units';

const routineId = toId<RoutineId>('routine-1');
const workoutId = toId<WorkoutId>('workout-1');
const squat = toId<ExerciseId>('front-squat');
const press = toId<ExerciseId>('overhead-press');

let counter = 0;

function set(weight: number, reps: number, unit: Unit = 'kg', rir = 2): CompletedSet {
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
    completedAt: 1_000 + counter,
  };
}

/** One Session holding one entry per exercise given. `startedAt` orders them. */
function session(
  startedAt: number,
  entries: readonly (readonly [ExerciseId, readonly CompletedSet[]])[],
  status: SessionStatus = 'completed',
  statuses: readonly ('performed' | 'skipped' | 'pending')[] = [],
): SessionHistory {
  const record: Session = {
    id: toId<SessionId>(`session-${startedAt}`),
    routineId,
    workoutId,
    startedAt,
    completedAt: status === 'in_progress' ? null : startedAt + 61 * 60_000,
    status,
  };
  return {
    session: record,
    exercises: entries.map(([exerciseId, sets], index) => ({
      exerciseSession: {
        id: toId<ExerciseSessionId>(`es-${startedAt}-${index}`),
        sessionId: record.id,
        exerciseId,
        order: index,
        status: statuses[index] ?? 'performed',
        plannedExerciseId: toId<PlannedExerciseId>('pe-1'),
        plannedUnit: 'kg',
        plannedSets: 3,
        plannedMinReps: 4,
        plannedMaxReps: 6,
        plannedMinRir: 1,
        plannedMaxRir: 2,
        plannedRestSeconds: 180,
        plannedProgression: { type: 'double_progression', increment: 2.5 },
      },
      sets,
    })),
  };
}

describe('summarizeSession', () => {
  it('counts sets and sums volume in kilograms across every exercise', () => {
    const detail = session(2_000, [
      [squat, [set(100, 5), set(100, 5)]],
      [press, [set(50, 10)]],
    ]);

    const summary = summarizeSession(detail, new Map());

    expect(summary.setsLogged).toBe(3);
    // 100x5 + 100x5 + 50x10 = 1500
    expect(summary.volumeKg).toBe(1_500);
    expect(summary.minutes).toBe(61);
  });

  it('sums volume off weightKg, so a pound session does not read as kilograms', () => {
    const detail = session(2_000, [[squat, [set(100, 1, 'lb')]]]);

    const summary = summarizeSession(detail, new Map());

    expect(summary.volumeKg).toBeCloseTo(toKg(100, 'lb'), 5);
    expect(summary.volumeKg).toBeLessThan(100);
  });

  it('reports no minutes while the session is still open', () => {
    const detail = session(2_000, [[squat, [set(100, 5)]]], 'in_progress');

    expect(summarizeSession(detail, new Map()).minutes).toBeNull();
  });

  it('reads effort as the mean RPE of the sets times the minutes', () => {
    // Three sets at RIR 2 are three sets at RPE 8, over 61 minutes.
    const detail = session(2_000, [
      [squat, [set(100, 5), set(100, 5)]],
      [press, [set(50, 10)]],
    ]);

    expect(summarizeSession(detail, new Map()).effort).toBe(8 * 61);
  });

  it('means the RPE across sets rather than taking the hardest one', () => {
    // RIR 0 and RIR 4 — RPE 10 and 6 — average to the 8 above, so the same
    // session length yields the same effort. The hardest set would read 610.
    const detail = session(2_000, [[squat, [set(100, 5, 'kg', 0), set(100, 5, 'kg', 4)]]]);

    expect(summarizeSession(detail, new Map()).effort).toBe(8 * 61);
  });

  it('floors a set logged above RIR 10 at zero rather than crediting it negatively', () => {
    // A logged RIR is not bounded above (backup/schema.ts accepts one past
    // MAX_RIR). Without the floor this reads 8 + -2, and an easy set would
    // subtract effort from the session it was part of.
    const detail = session(2_000, [[squat, [set(100, 5, 'kg', 2), set(100, 5, 'kg', 12)]]]);

    expect(summarizeSession(detail, new Map()).effort).toBe(4 * 61);
  });

  it('reports no effort while the session is open, or when it holds no set', () => {
    const open = session(2_000, [[squat, [set(100, 5)]]], 'in_progress');
    const setless = session(2_000, [[squat, []]]);

    expect(summarizeSession(open, new Map()).effort).toBeNull();
    expect(summarizeSession(setless, new Map()).effort).toBeNull();
  });

  it('counts each exercise status separately', () => {
    const detail = session(
      2_000,
      [
        [squat, [set(100, 5)]],
        [press, []],
        [toId<ExerciseId>('barbell-row'), []],
      ],
      'partial',
      ['performed', 'skipped', 'pending'],
    );

    const summary = summarizeSession(detail, new Map());

    expect(summary.performed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.pending).toBe(1);
  });

  it('names an exercise whose estimate beat every session before it', () => {
    const earlier = session(1_000, [[squat, [set(100, 5)]]]);
    const now = session(2_000, [[squat, [set(110, 5)]]]);

    const summary = summarizeSession(now, new Map([[squat, [earlier, now]]]));

    expect(summary.records).toHaveLength(1);
    expect(summary.records[0]!.exerciseId).toBe(squat);
    expect(summary.records[0]!.set.weight).toBe(110);
    expect(summary.records[0]!.previousBestKg).not.toBeNull();
    expect(summary.records[0]!.estimatedOneRepMaxKg).toBeGreaterThan(
      summary.records[0]!.previousBestKg!,
    );
  });

  it('is not a record when the session repeats or falls short of the best before it', () => {
    const earlier = session(1_000, [[squat, [set(110, 5)]]]);
    const now = session(2_000, [[squat, [set(110, 5)]]]);

    expect(summarizeSession(now, new Map([[squat, [earlier, now]]])).records).toEqual([]);
  });

  it('does not crown the first session an exercise was ever performed in', () => {
    const only = session(2_000, [[squat, [set(100, 5)]]]);

    expect(summarizeSession(only, new Map([[squat, [only]]])).records).toEqual([]);
  });

  it('credits the set that produced the estimate, not the heaviest one', () => {
    const earlier = session(1_000, [[squat, [set(100, 3, 'kg', 2)]]]);
    // 100x3 @ RIR 2 estimates 100 x (1 + 5/30) = 116.7.
    // 95x8 @ RIR 3 estimates 95 x (1 + 11/30) = 129.8 — lighter, but the record.
    const now = session(2_000, [[squat, [set(100, 3, 'kg', 2), set(95, 8, 'kg', 3)]]]);

    const summary = summarizeSession(now, new Map([[squat, [earlier, now]]]));

    expect(summary.records).toHaveLength(1);
    expect(summary.records[0]!.set.weight).toBe(95);
  });

  it('yields no record for an exercise whose history has not arrived yet', () => {
    const now = session(2_000, [[squat, [set(110, 5)]]]);

    expect(summarizeSession(now, new Map()).records).toEqual([]);
  });

  it('orders several records with the biggest estimate first', () => {
    const squatBefore = session(1_000, [[squat, [set(60, 5)]]]);
    const pressBefore = session(1_000, [[press, [set(30, 5)]]]);
    const now = session(2_000, [
      [press, [set(40, 5)]],
      [squat, [set(140, 5)]],
    ]);

    const summary = summarizeSession(
      now,
      new Map([
        [squat, [squatBefore, only(now, squat)]],
        [press, [pressBefore, only(now, press)]],
      ]),
    );

    expect(summary.records.map((record) => record.exerciseId)).toEqual([squat, press]);
  });
});

/**
 * One Session narrowed to a single exercise — what `listExerciseHistory` hands
 * back, which "carries only the ExerciseSessions for `exerciseId`"
 * (`db/repositories/history.ts`).
 *
 * `exerciseSeries` sums every set in each entry it is given, so feeding it a
 * Session that still holds the other exercises would credit their load to this
 * one. The tests above use a single-exercise Session throughout, where the two
 * shapes coincide; this projection is what keeps the multi-exercise case
 * honest to the query it stands in for.
 */
function only(detail: SessionHistory, exerciseId: ExerciseId): SessionHistory {
  return {
    ...detail,
    exercises: detail.exercises.filter(
      (exercise) => exercise.exerciseSession.exerciseId === exerciseId,
    ),
  };
}
