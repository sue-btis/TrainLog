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
  SessionHasSetsError,
  SessionInProgressError,
  createStartedWorkout,
  discardSession,
  getInProgressSession,
  getLastPerformedWorkout,
  getSession,
  listAllSessions,
  listSessionsBetween,
  saveFinishedSession,
} from '@/db/repositories/sessions';
import {
  addExerciseSession,
  listExerciseSessionsBySession,
  saveExerciseSession,
  saveExerciseSessions,
} from '@/db/repositories/exerciseSessions';
import {
  listCompletedSetsByExerciseSession,
  saveLoggedSet,
} from '@/db/repositories/completedSets';
import { getSessionDetail } from '@/db/repositories/history';
import { setBodyweightKg } from '@/db/repositories/settings';
import {
  finishSession,
  logSet,
  moveExerciseSession,
  skipExercise,
  startPlannedExercise,
  startSession,
  startUnplannedExercise,
  startWorkout,
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

/** Every exercise in these fixtures is measured by weight x reps (REQ-105). */
const measurement = 'weight_reps' as const;
const measurementOf = () => measurement;

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
  minTarget: null,
  maxTarget: null,
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
    await createStartedWorkout({ session, exerciseSessions: [] });

    const exercise = startPlannedExercise({ measurement, sessionId: session.id, planned, order: 0 });
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
    await createStartedWorkout({ session, exerciseSessions: [] });
    const exercise = startPlannedExercise({ measurement, sessionId: session.id, planned, order: 0 });
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
    await createStartedWorkout({
      session: startSession({ routineId, workoutId, startedAt: 1_000 }),
      exerciseSessions: [],
    });
    await expect(
      createStartedWorkout({
        session: startSession({ routineId, workoutId, startedAt: 2_000 }),
        exerciseSessions: [],
      }),
    ).rejects.toBeInstanceOf(SessionInProgressError);
    expect(await db.sessions.count()).toBe(1);
  });

  it('finishing frees the in-progress slot and persists status with completedAt', async () => {
    const session = startSession({ routineId, workoutId, startedAt: 1_000 });
    await createStartedWorkout({ session, exerciseSessions: [] });
    const skipped = skipExercise(
      startUnplannedExercise({ measurement, sessionId: session.id, exerciseId: squat, order: 0 }),
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
    bodyweightKg: null,
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

/* ── Gym mode: starting a Workout (R-2, R-3, R-10) ─────────────────────── */

function plannedAt(order: number, id: string): PlannedExercise {
  return { ...planned, id: toId<PlannedExerciseId>(id), order };
}

describe('createStartedWorkout (R-2, AC-3, AC-5, AC-6)', () => {
  it('writes the Session and every ExerciseSession together, in order (AC-3)', async () => {
    const started = startWorkout({
      measurementOf,
      routineId,
      workoutId,
      planned: [plannedAt(1, 'pe-b'), plannedAt(0, 'pe-a')],
      startedAt: 1_000,
    });

    await createStartedWorkout(started);

    db.close();
    await db.open();

    expect(await getInProgressSession()).toEqual(started.session);

    const stored = await listExerciseSessionsBySession(started.session.id);
    expect(stored.map((it) => it.plannedExerciseId)).toEqual(['pe-a', 'pe-b']);
    expect(stored.map((it) => it.order)).toEqual([0, 1]);
    expect(stored.every((it) => it.status === 'pending')).toBe(true);
  });

  it('stores the snapshotted targets, not a reference to the template (AC-4)', async () => {
    const started = startWorkout({
      measurementOf,
      routineId,
      workoutId,
      planned: [plannedAt(0, 'pe-a')],
      startedAt: 1_000,
    });

    await createStartedWorkout(started);

    const [stored] = await listExerciseSessionsBySession(started.session.id);
    expect(stored).toMatchObject({
      plannedSets: 4,
      plannedMinReps: 4,
      plannedMaxReps: 6,
      plannedRestSeconds: 180,
      plannedProgression: { type: 'double_progression', increment: 2.5 },
    });
  });

  // REQ-108, AC-111 — bodyweight is stated in settings and dated by the Session
  // that starts under it.
  it('records the bodyweight settings hold when the Session starts', async () => {
    await setBodyweightKg(82.5);

    const started = startWorkout({
      measurementOf,
      routineId,
      workoutId,
      planned: [plannedAt(0, 'pe-a')],
      startedAt: 1_000,
    });
    await createStartedWorkout(started);

    expect((await getInProgressSession())?.bodyweightKg).toBe(82.5);
  });

  // The install that recorded bodyweight against Sessions before it was a
  // setting still opens on its last weigh-in rather than on nothing.
  it('falls back to the last Session that recorded one when settings hold none', async () => {
    const earlier = startWorkout({
      measurementOf,
      routineId,
      workoutId,
      planned: [plannedAt(0, 'pe-a')],
      startedAt: 1_000,
    });
    await createStartedWorkout(earlier);
    await db.sessions.update(earlier.session.id, {
      status: 'completed',
      completedAt: 1_500,
      bodyweightKg: 78,
    });

    const later = startWorkout({
      measurementOf,
      routineId,
      workoutId,
      planned: [plannedAt(0, 'pe-a')],
      startedAt: 2_000,
    });
    await createStartedWorkout(later);

    expect((await getInProgressSession())?.bodyweightKg).toBe(78);
  });

  it('refuses a second concurrent Session and writes nothing (AC-6, REQ-058)', async () => {
    const first = startWorkout({
      measurementOf,
      routineId,
      workoutId,
      planned: [plannedAt(0, 'pe-a')],
      startedAt: 1_000,
    });
    await createStartedWorkout(first);

    const second = startWorkout({
      measurementOf,
      routineId,
      workoutId,
      planned: [plannedAt(0, 'pe-b')],
      startedAt: 2_000,
    });

    await expect(createStartedWorkout(second)).rejects.toThrow(SessionInProgressError);

    expect(await getSession(second.session.id)).toBeUndefined();
    expect(await listExerciseSessionsBySession(second.session.id)).toEqual([]);
    expect((await getInProgressSession())?.id).toBe(first.session.id);
  });

  it('leaves neither the Session nor any exercise behind when a write fails (AC-5)', async () => {
    const started = startWorkout({
      measurementOf,
      routineId,
      workoutId,
      planned: [plannedAt(0, 'pe-a'), plannedAt(1, 'pe-b')],
      startedAt: 1_000,
    });

    // A duplicate primary key inside the bulk write: the transaction must take
    // the Session down with it rather than leaving a headless exercise or a
    // Session whose exercises are half written.
    const collided = {
      ...started,
      exerciseSessions: [
        started.exerciseSessions[0]!,
        { ...started.exerciseSessions[1]!, id: started.exerciseSessions[0]!.id },
      ],
    };

    await expect(createStartedWorkout(collided)).rejects.toThrow();

    expect(await getInProgressSession()).toBeUndefined();
    expect(await getSession(started.session.id)).toBeUndefined();
    expect(await listExerciseSessionsBySession(started.session.id)).toEqual([]);
  });

  it('starts a Workout that has no exercises', async () => {
    const started = startWorkout({ measurementOf, routineId, workoutId, planned: [], startedAt: 1_000 });

    await createStartedWorkout(started);

    expect((await getInProgressSession())?.id).toBe(started.session.id);
    expect(await listExerciseSessionsBySession(started.session.id)).toEqual([]);
  });
});

describe('saveExerciseSessions (R-10, AC-20)', () => {
  it('persists a reorder without touching the PlannedExercises behind it', async () => {
    const started = startWorkout({
      measurementOf,
      routineId,
      workoutId,
      planned: [plannedAt(0, 'pe-a'), plannedAt(1, 'pe-b'), plannedAt(2, 'pe-c')],
      startedAt: 1_000,
    });
    await createStartedWorkout(started);

    const before = await listExerciseSessionsBySession(started.session.id);
    const moved = moveExerciseSession(before, before[2]!.id, 1);
    await saveExerciseSessions(moved);

    db.close();
    await db.open();

    const after = await listExerciseSessionsBySession(started.session.id);
    expect(after.map((it) => it.plannedExerciseId)).toEqual(['pe-a', 'pe-c', 'pe-b']);
    expect(after.map((it) => it.order)).toEqual([0, 1, 2]);

    // The templates are untouched — nothing was written to them at all.
    expect(await db.plannedExercises.count()).toBe(0);
  });

  it('writes nothing for an empty list, rather than opening a transaction', async () => {
    const started = startWorkout({
      measurementOf,
      routineId,
      workoutId,
      planned: [plannedAt(0, 'pe-a')],
      startedAt: 1_000,
    });
    await createStartedWorkout(started);

    await saveExerciseSessions([]);

    const after = await listExerciseSessionsBySession(started.session.id);
    expect(after).toHaveLength(1);
    expect(after[0]?.order).toBe(0);
  });
});

/**
 * R-1, R-5 — the session history reads.
 *
 * `listAllSessions` is the list screen's only query: every Session across every
 * Routine, newest first, of every status. The AC-5a case below is the one that
 * matters most — history renders from the ExerciseSession snapshot, so editing
 * the template behind a past Session must not move what that Session says it
 * was performed against (ADR 0002).
 */
describe('session history reads (R-1, R-5)', () => {
  const otherRoutine = toId<RoutineId>('routine-2');

  it('AC-1a — every Session, both Routines, every status, newest first', async () => {
    await db.sessions.bulkAdd([
      {
        id: toId<SessionId>('s-old'),
        routineId,
        workoutId,
        startedAt: 1_000,
        completedAt: 2_000,
        status: 'completed',
        bodyweightKg: null,
      },
      {
        id: toId<SessionId>('s-live'),
        routineId: otherRoutine,
        workoutId,
        startedAt: 9_000,
        completedAt: null,
        status: 'in_progress',
        bodyweightKg: null,
      },
      {
        id: toId<SessionId>('s-partial'),
        routineId: otherRoutine,
        workoutId,
        startedAt: 5_000,
        completedAt: 6_000,
        status: 'partial',
        bodyweightKg: null,
      },
    ]);

    const all = await listAllSessions();

    expect(all.map((session) => session.id)).toEqual(['s-live', 's-partial', 's-old']);
  });

  it('AC-1b — an empty database lists nothing rather than failing', async () => {
    expect(await listAllSessions()).toEqual([]);
  });

  it('AC-5a — editing the template leaves a past Session reading its snapshot', async () => {
    await db.plannedExercises.add(planned);

    const started = startWorkout({
      measurementOf,
      routineId,
      workoutId,
      planned: [planned],
      startedAt: 1_000,
    });
    await createStartedWorkout(started);
    await saveFinishedSession(
      finishSession(started.session, started.exerciseSessions, 9_000),
      started.exerciseSessions,
    );

    // The lifter re-imports a corrected file: same template row, new targets.
    await db.plannedExercises.put({ ...planned, sets: 8, minReps: 10, maxReps: 12, restSeconds: 60 });

    const detail = await getSessionDetail(started.session.id);
    const [performed] = detail!.exercises;

    expect(performed!.exerciseSession).toMatchObject({
      plannedExerciseId: planned.id,
      plannedSets: 4,
      plannedMinReps: 4,
      plannedMaxReps: 6,
      plannedRestSeconds: 180,
    });
  });
});

describe('discardSession — the way out of a Session started by mistake (§35)', () => {
  it('erases the Session and its exercises, leaving nothing behind', async () => {
    const session = startSession({ routineId, workoutId, startedAt: 1_000 });
    const exercise = startPlannedExercise({ measurement, sessionId: session.id, planned, order: 0 });
    await createStartedWorkout({ session, exerciseSessions: [exercise] });

    await discardSession(session.id);

    expect(await getSession(session.id)).toBeUndefined();
    expect(await getInProgressSession()).toBeUndefined();
    expect(await listExerciseSessionsBySession(session.id)).toEqual([]);
    // And the slot is free again: REQ-058 no longer has anything to refuse.
    const next = startSession({ routineId, workoutId, startedAt: 2_000 });
    await expect(createStartedWorkout({ session: next, exerciseSessions: [] })).resolves
      .toBeUndefined();
  });

  it('refuses a Session that holds a logged set, and changes nothing', async () => {
    const session = startSession({ routineId, workoutId, startedAt: 1_000 });
    const exercise = startPlannedExercise({ measurement, sessionId: session.id, planned, order: 0 });
    await createStartedWorkout({ session, exerciseSessions: [exercise] });

    const logged = logSet({
      exerciseSession: exercise,
      setNumber: 1,
      weight: 100,
      unit: 'kg',
      reps: 5,
      rir: 2,
      completedAt: 2_000,
    });
    await saveLoggedSet(logged);

    await expect(discardSession(session.id)).rejects.toBeInstanceOf(SessionHasSetsError);

    expect(await getSession(session.id)).toEqual(session);
    expect(await listExerciseSessionsBySession(session.id)).toHaveLength(1);
    expect(await listCompletedSetsByExerciseSession(exercise.id)).toHaveLength(1);
  });

  it('leaves a finished Session alone — history is not deleted here', async () => {
    const session = startSession({ routineId, workoutId, startedAt: 1_000 });
    await createStartedWorkout({ session, exerciseSessions: [] });
    const finished = finishSession(session, [], 3_000);
    await saveFinishedSession(finished, []);

    await discardSession(session.id);

    expect(await getSession(session.id)).toEqual(finished);
  });
});
