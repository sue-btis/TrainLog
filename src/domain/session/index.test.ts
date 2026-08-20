import { describe, expect, it } from 'vitest';
import {
  toId,
  type ExerciseId,
  type ExerciseSessionId,
  type PlannedExerciseId,
  type RoutineId,
  type SessionId,
  type WorkoutId,
} from '@/domain/ids';
import type { PlannedExercise, PlannedExerciseSession } from '@/domain/types';
import {
  deriveSessionStatus,
  finishSession,
  logSet,
  reorderExerciseSessions,
  restRemaining,
  skipExercise,
  startPlannedExercise,
  startSession,
  startUnplannedExercise,
  startWorkout,
} from '@/domain/session';

const routineId = toId<RoutineId>('routine-1');
const workoutId = toId<WorkoutId>('workout-1');
const sessionId = toId<SessionId>('session-1');
const exerciseId = toId<ExerciseId>('front-squat');

function plannedExercise(): PlannedExercise {
  return {
    id: toId<PlannedExerciseId>('planned-1'),
    workoutId,
    exerciseId,
    sets: 4,
    minReps: 4,
    maxReps: 6,
    minRir: 1,
    maxRir: 2,
    restSeconds: 210,
    unit: 'kg',
    focus: 'strength',
    notes: ['brace hard'],
    order: 0,
    progression: { type: 'double_progression', increment: 2.5 },
  };
}

describe('startSession (REQ-050, AC-050, AC-051)', () => {
  it('produces an in_progress Session with startedAt, routineId and workoutId', () => {
    const session = startSession({ routineId, workoutId, startedAt: 1_000 });

    expect(session).toMatchObject({
      routineId,
      workoutId,
      startedAt: 1_000,
      completedAt: null,
      status: 'in_progress',
    });
  });

  it('holds no reference to any Placement (AC-051)', () => {
    const session = startSession({ routineId, workoutId, startedAt: 1_000 });

    expect(Object.keys(session).sort()).toEqual([
      'completedAt',
      'id',
      'routineId',
      'startedAt',
      'status',
      'workoutId',
    ]);
  });
});

describe('TST-010 snapshot regression (REQ-051, REQ-052, REQ-053)', () => {
  it('copies every planned field into the ExerciseSession (AC-052)', () => {
    const planned = plannedExercise();

    const exerciseSession = startPlannedExercise({ sessionId, planned, order: 0 });

    expect(exerciseSession).toMatchObject({
      sessionId,
      exerciseId,
      order: 0,
      status: 'pending',
      plannedExerciseId: planned.id,
      plannedSets: 4,
      plannedMinReps: 4,
      plannedMaxReps: 6,
      plannedMinRir: 1,
      plannedMaxRir: 2,
      plannedRestSeconds: 210,
      plannedProgression: { type: 'double_progression', increment: 2.5 },
    });
  });

  it('is unchanged when the PlannedExercise is mutated afterwards (AC-053)', () => {
    const planned: PlannedExercise = plannedExercise();
    const exerciseSession = startPlannedExercise({ sessionId, planned, order: 0 });
    const before: PlannedExerciseSession = { ...exerciseSession };

    // The template is edited after the session started.
    const mutable = planned as {
      -readonly [K in keyof PlannedExercise]: PlannedExercise[K];
    };
    mutable.sets = 99;
    mutable.minReps = 99;
    mutable.maxReps = 99;
    mutable.minRir = 99;
    mutable.maxRir = 99;
    mutable.restSeconds = 99;
    mutable.progression = { type: 'manual' };

    expect(exerciseSession).toEqual(before);
    expect(exerciseSession.plannedSets).toBe(4);
    expect(exerciseSession.plannedProgression).toEqual({
      type: 'double_progression',
      increment: 2.5,
    });
  });

  it('is unchanged when the PlannedExercise is replaced by a re-import (AC-053)', () => {
    const exerciseSession = startPlannedExercise({
      sessionId,
      planned: plannedExercise(),
      order: 0,
    });

    const reimported: PlannedExercise = {
      ...plannedExercise(),
      id: toId<PlannedExerciseId>('planned-2'),
      sets: 3,
      maxReps: 10,
      progression: { type: 'manual' },
    };

    expect(reimported.id).not.toBe(exerciseSession.plannedExerciseId);
    expect(exerciseSession.plannedSets).toBe(4);
    expect(exerciseSession.plannedMaxReps).toBe(6);
  });

  it('gives an unplanned exercise a null plannedExerciseId and no planned targets (AC-054)', () => {
    const unplanned = startUnplannedExercise({ sessionId, exerciseId, order: 3 });

    expect(unplanned).toMatchObject({
      sessionId,
      exerciseId,
      order: 3,
      status: 'pending',
      plannedExerciseId: null,
    });
    const plannedTargets = Object.keys(unplanned).filter(
      (key) => key.startsWith('planned') && key !== 'plannedExerciseId',
    );
    expect(plannedTargets).toEqual([]);
  });
});

describe('TST-011 set logging, deviation and status derivation (REQ-054...REQ-057)', () => {
  const planned = plannedExercise();
  const start = () => startPlannedExercise({ sessionId, planned, order: 0 });

  it('stores weight and unit as entered plus derived weightKg (AC-055)', () => {
    const { set } = logSet({
      exerciseSession: start(),
      setNumber: 1,
      weight: 135,
      unit: 'lb',
      reps: 6,
      rir: 2,
      completedAt: 5_000,
    });

    expect(set).toMatchObject({
      setNumber: 1,
      weight: 135,
      unit: 'lb',
      weightKg: 61.235,
      reps: 6,
      rir: 2,
      completedAt: 5_000,
    });
  });

  it('marks the ExerciseSession performed on the first logged set (AC-058)', () => {
    const pending = start();
    expect(pending.status).toBe('pending');

    const first = logSet({
      exerciseSession: pending,
      setNumber: 1,
      weight: 75,
      unit: 'kg',
      reps: 6,
      rir: 2,
      completedAt: 5_000,
    });
    expect(first.exerciseSession.status).toBe('performed');

    const second = logSet({
      exerciseSession: first.exerciseSession,
      setNumber: 2,
      weight: 75,
      unit: 'kg',
      reps: 6,
      rir: 2,
      completedAt: 6_000,
    });
    expect(second.exerciseSession.status).toBe('performed');
    expect(second.set.exerciseSessionId).toBe(pending.id);
  });

  it('is skipped only by explicit action (AC-058)', () => {
    expect(skipExercise(start()).status).toBe('skipped');
  });

  it('accepts more sets than planned, fewer than planned, and a skip, without error (AC-057)', () => {
    let exerciseSession = start();
    for (let setNumber = 1; setNumber <= 6; setNumber += 1) {
      const logged = logSet({
        exerciseSession,
        setNumber,
        weight: 75,
        unit: 'kg',
        reps: 6,
        rir: 2,
        completedAt: 5_000 + setNumber,
      });
      exerciseSession = logged.exerciseSession;
      expect(logged.set.setNumber).toBe(setNumber);
    }
    expect(exerciseSession.status).toBe('performed');

    const fewer = logSet({
      exerciseSession: start(),
      setNumber: 1,
      weight: 75,
      unit: 'kg',
      reps: 4,
      rir: 3,
      completedAt: 5_000,
    });
    expect(fewer.exerciseSession.status).toBe('performed');
    expect(skipExercise(start()).status).toBe('skipped');
  });

  it('finishes completed when every exercise is performed (AC-059)', () => {
    const session = startSession({ routineId, workoutId, startedAt: 1_000 });
    const performed = [
      { ...start(), status: 'performed' as const },
      {
        ...startUnplannedExercise({ sessionId, exerciseId, order: 1 }),
        status: 'performed' as const,
      },
    ];

    const finished = finishSession(session, performed, 9_000);

    expect(finished.status).toBe('completed');
    expect(finished.completedAt).toBe(9_000);
    expect(finished.id).toBe(session.id);
  });

  it('finishes partial when one exercise is still pending (AC-060)', () => {
    const session = startSession({ routineId, workoutId, startedAt: 1_000 });
    const finished = finishSession(
      session,
      [{ ...start(), status: 'performed' as const }, start()],
      9_000,
    );

    expect(finished.status).toBe('partial');
    expect(finished.completedAt).toBe(9_000);
  });

  it('finishes completed when one exercise is skipped and the rest performed (AC-059, DEC-009)', () => {
    const session = startSession({ routineId, workoutId, startedAt: 1_000 });
    const finished = finishSession(
      session,
      [{ ...start(), status: 'performed' as const }, skipExercise(start())],
      9_000,
    );

    expect(finished.status).toBe('completed');
  });

  it('derives status from ExerciseSession.status alone', () => {
    expect(deriveSessionStatus([])).toBe('completed');
    expect(deriveSessionStatus([skipExercise(start())])).toBe('completed');
    expect(deriveSessionStatus([start()])).toBe('partial');
  });
});

/* ── Gym mode (R-2, R-7, R-10) ─────────────────────────────────────────── */

function plannedAt(order: number, id: string): PlannedExercise {
  return { ...plannedExercise(), id: toId<PlannedExerciseId>(id), order };
}

describe('startWorkout (R-2, AC-3, AC-4)', () => {
  it('produces the Session and one snapshot per PlannedExercise, in planned order', () => {
    const planned = [plannedAt(1, 'planned-b'), plannedAt(0, 'planned-a')];

    const { session, exerciseSessions } = startWorkout({
      routineId,
      workoutId,
      planned,
      startedAt: 1_000,
    });

    expect(session).toMatchObject({ routineId, workoutId, status: 'in_progress' });
    expect(exerciseSessions).toHaveLength(2);
    expect(exerciseSessions.map((it) => it.plannedExerciseId)).toEqual([
      'planned-a',
      'planned-b',
    ]);
    expect(exerciseSessions.map((it) => it.order)).toEqual([0, 1]);
    expect(exerciseSessions.every((it) => it.sessionId === session.id)).toBe(true);
    expect(exerciseSessions.every((it) => it.status === 'pending')).toBe(true);
  });

  it('copies every target by value, so a later template edit cannot reach it (AC-4)', () => {
    const planned = plannedAt(0, 'planned-a');

    const { exerciseSessions } = startWorkout({
      routineId,
      workoutId,
      planned: [planned],
      startedAt: 1_000,
    });

    expect(exerciseSessions[0]).toMatchObject({
      plannedUnit: 'kg',
      plannedSets: 4,
      plannedMinReps: 4,
      plannedMaxReps: 6,
      plannedMinRir: 1,
      plannedMaxRir: 2,
      plannedRestSeconds: 210,
      plannedProgression: { type: 'double_progression', increment: 2.5 },
    });
    expect(exerciseSessions[0]?.plannedProgression).not.toBe(planned.progression);
  });

  it('snapshots the exercise’s own unit, so a lb exercise never opens in kg (B-1)', () => {
    const pounds: PlannedExercise = { ...plannedAt(0, 'planned-lb'), unit: 'lb' };

    const { exerciseSessions } = startWorkout({
      routineId,
      workoutId,
      planned: [pounds],
      startedAt: 1_000,
    });

    expect(exerciseSessions[0]?.plannedUnit).toBe('lb');
  });

  it('starts a Workout with no exercises (AC-3)', () => {
    const { session, exerciseSessions } = startWorkout({
      routineId,
      workoutId,
      planned: [],
      startedAt: 1_000,
    });

    expect(session.status).toBe('in_progress');
    expect(exerciseSessions).toEqual([]);
  });
});

describe('reorderExerciseSessions (R-10, AC-20)', () => {
  function three(): PlannedExerciseSession[] {
    return [0, 1, 2].map((order) => ({
      ...startPlannedExercise({ sessionId, planned: plannedExercise(), order }),
      id: toId<ExerciseSessionId>(`es-${order}`),
    }));
  }

  it('moves an exercise later and renumbers order contiguously from zero', () => {
    const moved = reorderExerciseSessions(three(), toId<ExerciseSessionId>('es-0'), 'down');

    expect(moved.map((it) => it.id)).toEqual(['es-1', 'es-0', 'es-2']);
    expect(moved.map((it) => it.order)).toEqual([0, 1, 2]);
  });

  it('moves an exercise earlier', () => {
    const moved = reorderExerciseSessions(three(), toId<ExerciseSessionId>('es-2'), 'up');

    expect(moved.map((it) => it.id)).toEqual(['es-0', 'es-2', 'es-1']);
    expect(moved.map((it) => it.order)).toEqual([0, 1, 2]);
  });

  // The middle is the ordinary case and the one the ends do not exercise:
  // moving it up lands on position 0, and its own index is neither 0 nor last.
  it('moves the middle exercise up into first place', () => {
    const moved = reorderExerciseSessions(three(), toId<ExerciseSessionId>('es-1'), 'up');

    expect(moved.map((it) => it.id)).toEqual(['es-1', 'es-0', 'es-2']);
    expect(moved.map((it) => it.order)).toEqual([0, 1, 2]);
  });

  it('moves the middle exercise down into last place', () => {
    const moved = reorderExerciseSessions(three(), toId<ExerciseSessionId>('es-1'), 'down');

    expect(moved.map((it) => it.id)).toEqual(['es-0', 'es-2', 'es-1']);
    expect(moved.map((it) => it.order)).toEqual([0, 1, 2]);
  });

  it('is a no-op at either end, and for an id it does not hold', () => {
    const list = three();

    expect(reorderExerciseSessions(list, toId<ExerciseSessionId>('es-0'), 'up')).toEqual(list);
    expect(reorderExerciseSessions(list, toId<ExerciseSessionId>('es-2'), 'down')).toEqual(list);
    expect(reorderExerciseSessions(list, toId<ExerciseSessionId>('nope'), 'up')).toEqual(list);
  });

  // Both directions, because they fail differently. An unknown id going up
  // lands on -2 and is caught by the lower bound; going down it lands on 0,
  // which is inside the list — so only the `from === -1` check stops it from
  // swapping against index -1 and emitting a row with no id.
  it('is a no-op for an unknown id in either direction', () => {
    const list = three();
    const missing = toId<ExerciseSessionId>('nope');

    for (const direction of ['up', 'down'] as const) {
      const result = reorderExerciseSessions(list, missing, direction);
      expect(result).toEqual(list);
      expect(result.every((it) => it.id !== undefined)).toBe(true);
    }
  });

  it('reads the given order rather than the array order', () => {
    const shuffled = [...three()].reverse();
    const moved = reorderExerciseSessions(shuffled, toId<ExerciseSessionId>('es-0'), 'down');

    expect(moved.map((it) => it.id)).toEqual(['es-1', 'es-0', 'es-2']);
  });
});

describe('restRemaining (R-7, AC-13, AC-14)', () => {
  it('counts down against the clock from the instant the set was completed', () => {
    expect(restRemaining({ since: 1_000, seconds: 180, now: 1_000 })).toBe(180);
    expect(restRemaining({ since: 1_000, seconds: 180, now: 61_000 })).toBe(120);
  });

  it('clamps at zero rather than going negative', () => {
    expect(restRemaining({ since: 1_000, seconds: 180, now: 400_000 })).toBe(0);
  });

  it('extends by time added', () => {
    expect(restRemaining({ since: 1_000, seconds: 180, now: 61_000, added: 30 })).toBe(150);
  });

  it('holds still while paused, at the remaining time when the pause began', () => {
    expect(restRemaining({ since: 1_000, seconds: 180, now: 400_000, pausedAt: 61_000 })).toBe(120);
  });

  it('rounds up, so a timer reads 1 until the second is actually spent', () => {
    expect(restRemaining({ since: 1_000, seconds: 180, now: 180_500 })).toBe(1);
  });
});
