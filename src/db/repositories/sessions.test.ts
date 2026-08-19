/**
 * TST-021 — an `in_progress` Session with logged sets is recovered from a fresh
 * database handle with all sets intact (REQ-058, AC-061, §35, §36).
 *
 * Also covers AC-056: the set is readable from a *fresh handle* immediately
 * after logging, before the Session finishes (REQ-054, NFR-03).
 *
 * Every query exercised here is served by a declared index (AC-073):
 * `sessions.status`, `exerciseSessions.sessionId`, `completedSets.exerciseSessionId`.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import { TrainLogDatabase } from '@/db/schema';
import {
  SessionInProgressError,
  createSession,
  getInProgressSession,
  getLastPerformedWorkout,
  getSession,
  listSessionsBetween,
  saveFinishedSession,
} from '@/db/repositories/sessions';
import {
  addExerciseSession,
  listExerciseSessionsBySession,
  saveExerciseSession,
} from '@/db/repositories/exerciseSessions';
import {
  listCompletedSetsByExerciseSession,
  saveLoggedSet,
} from '@/db/repositories/completedSets';
import { getSessionDetail } from '@/db/repositories/history';
import {
  finishSession,
  logSet,
  skipExercise,
  startPlannedExercise,
  startSession,
  startUnplannedExercise,
} from '@/domain/session';
import { parseLocalDate, toLocalDate } from '@/domain/dates';
import { toId } from '@/domain/ids';
import type {
  ExerciseId,
  PlannedExerciseId,
  RoutineId,
  SessionId,
  WorkoutId,
} from '@/domain/ids';
import type { PlannedExercise } from '@/domain/types';

const routineId = toId<RoutineId>('routine-1');
const workoutId = toId<WorkoutId>('workout-1');
const squat = toId<ExerciseId>('back-squat');

const planned: PlannedExercise = {
  id: toId<PlannedExerciseId>('pe-1'),
  workoutId,
  exerciseId: squat,
  sets: 4,
  minReps: 4,
  maxReps: 6,
  minRir: 1,
  maxRir: 2,
  restSeconds: 180,
  unit: 'kg',
  focus: null,
  notes: [],
  order: 0,
  progression: { type: 'double_progression', increment: 2.5 },
};

beforeEach(async () => {
  await resetDatabase();
});

describe('TST-021 — in-progress session recovery', () => {
  it('recovers the in-progress Session and every logged set from a fresh handle', async () => {
    const session = startSession({ routineId, workoutId, startedAt: 1_000 });
    await createSession(session);

    const exercise = startPlannedExercise({ sessionId: session.id, planned, order: 0 });
    await addExerciseSession(exercise);

    let current = exercise;
    for (const [index, reps] of [6, 6, 5].entries()) {
      const logged = logSet({
        exerciseSession: current,
        setNumber: index + 1,
        weight: 100,
        unit: 'kg',
        reps,
        rir: 2,
        completedAt: 2_000 + index,
      });
      await saveLoggedSet(logged);
      current = logged.exerciseSession;
    }

    // Simulate a reload: drop the handle the writes went through, reopen it.
    db.close();
    await db.open();

    const recovered = await getInProgressSession();
    expect(recovered).toEqual(session);

    const detail = await getSessionDetail(recovered!.id);
    expect(detail?.session.status).toBe('in_progress');
    expect(detail?.exercises).toHaveLength(1);
    expect(detail?.exercises[0]?.exerciseSession.status).toBe('performed');
    expect(detail?.exercises[0]?.sets.map((set) => set.reps)).toEqual([6, 6, 5]);
    expect(detail?.exercises[0]?.sets.map((set) => set.setNumber)).toEqual([1, 2, 3]);
  });

  it('AC-056 — a logged set is readable from a second handle before the Session finishes', async () => {
    const session = startSession({ routineId, workoutId, startedAt: 1_000 });
    await createSession(session);
    const exercise = startPlannedExercise({ sessionId: session.id, planned, order: 0 });
    await addExerciseSession(exercise);

    const logged = logSet({
      exerciseSession: exercise,
      setNumber: 1,
      weight: 60,
      unit: 'kg',
      reps: 5,
      rir: 2,
      completedAt: 2_000,
    });
    await saveLoggedSet(logged);

    const fresh = new TrainLogDatabase();
    try {
      const sets = await fresh.completedSets
        .where('exerciseSessionId')
        .equals(exercise.id)
        .toArray();
      expect(sets).toEqual([logged.set]);

      const stored = await fresh.sessions.get(session.id);
      expect(stored?.status).toBe('in_progress');
      expect(stored?.completedAt).toBeNull();

      // REQ-054/DEC-009 — the status transition landed with the set, atomically.
      expect((await fresh.exerciseSessions.get(exercise.id))?.status).toBe('performed');
    } finally {
      fresh.close();
    }
  });

  it('refuses a second in-progress Session (REQ-058)', async () => {
    await createSession(startSession({ routineId, workoutId, startedAt: 1_000 }));
    await expect(
      createSession(startSession({ routineId, workoutId, startedAt: 2_000 })),
    ).rejects.toBeInstanceOf(SessionInProgressError);
    expect(await db.sessions.count()).toBe(1);
  });

  it('finishing frees the in-progress slot and persists status with completedAt', async () => {
    const session = startSession({ routineId, workoutId, startedAt: 1_000 });
    await createSession(session);
    const skipped = skipExercise(
      startUnplannedExercise({ sessionId: session.id, exerciseId: squat, order: 0 }),
    );
    await addExerciseSession(skipped);
    await saveExerciseSession(skipped);

    const exercises = await listExerciseSessionsBySession(session.id);
    await saveFinishedSession(finishSession(session, exercises, 9_000), exercises);

    expect(await getInProgressSession()).toBeUndefined();
    const stored = await getSession(session.id);
    expect(stored?.status).toBe('completed');
    expect(stored?.completedAt).toBe(9_000);
    expect(await listCompletedSetsByExerciseSession(skipped.id)).toEqual([]);
  });
});

/**
 * R-43, R-44 — the calendar's range read and Today's rotation anchor.
 *
 * The boundary is the point: `startedAt` is an instant, the calendar asks in
 * local days, and a session started at 23:30 belongs to that local day.
 */
describe('session range reads (R-43, R-44)', () => {
  const at = (date: string, hours: number, minutes = 0): number => {
    const day = parseLocalDate(toLocalDate(date));
    day.setHours(hours, minutes, 0, 0);
    return day.getTime();
  };

  const sessionAt = (id: string, workout: string, startedAt: number) => ({
    id: toId<SessionId>(id),
    routineId,
    workoutId: toId<WorkoutId>(workout),
    startedAt,
    completedAt: startedAt + 3_600_000,
    status: 'completed' as const,
  });

  beforeEach(async () => {
    await resetDatabase();
    await db.sessions.bulkAdd([
      sessionAt('s-early', 'push', at('2026-09-06', 12)),
      sessionAt('s-late-night', 'pull', at('2026-09-11', 23, 30)),
      sessionAt('s-next-day', 'legs', at('2026-09-12', 0, 30)),
      sessionAt('s-mid', 'push', at('2026-09-09', 9)),
    ]);
  });

  it('includes a session started at 23:30 on the last day of the range (AC-46)', async () => {
    const range = await listSessionsBetween(toLocalDate('2026-09-07'), toLocalDate('2026-09-11'));
    expect(range.map((s) => s.id)).toEqual(['s-late-night', 's-mid']);
  });

  it('excludes a session started just after midnight the next day (AC-46)', async () => {
    const range = await listSessionsBetween(toLocalDate('2026-09-07'), toLocalDate('2026-09-11'));
    expect(range.map((s) => s.id)).not.toContain('s-next-day');
  });

  it('includes both ends of the range', async () => {
    const range = await listSessionsBetween(toLocalDate('2026-09-06'), toLocalDate('2026-09-12'));
    expect(range).toHaveLength(4);
  });

  it('names the workout of the most recently started session (AC-47)', async () => {
    expect(await getLastPerformedWorkout(routineId)).toBe('legs');
  });

  it('names no workout when the routine has no sessions (AC-47)', async () => {
    await resetDatabase();
    expect(await getLastPerformedWorkout(routineId)).toBeNull();
  });
});
