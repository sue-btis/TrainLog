import { describe, expect, it } from 'vitest';
import {
  toId,
  type ExerciseId,
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
  skipExercise,
  startPlannedExercise,
  startSession,
  startUnplannedExercise,
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
