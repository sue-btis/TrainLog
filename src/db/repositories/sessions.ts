import { db } from '@/db/database';
import { getSettings } from '@/db/repositories/settings';
import { addDays, parseLocalDate, type LocalDate } from '@/domain/dates';
import type { SessionId, WorkoutId } from '@/domain/ids';
import type { ExerciseSession, Session } from '@/domain/types';

/** Starting a second Session is refused so an in-progress Session can be resumed. */
export class SessionInProgressError extends Error {
  readonly sessionId: SessionId;

  constructor(sessionId: SessionId) {
    super(`Session ${sessionId} is still in progress. Resume or finish it first.`);
    this.name = 'SessionInProgressError';
    this.sessionId = sessionId;
  }
}

export function getSession(id: SessionId): Promise<Session | undefined> {
  return db.sessions.get(id);
}

export function getInProgressSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('in_progress').first();
}

export async function createStartedWorkout(started: {
  readonly session: Session;
  readonly exerciseSessions: readonly ExerciseSession[];
}): Promise<void> {
  // Resolve the start-time bodyweight before the write; settings is outside the
  // transaction, and an explicit value is the caller's snapshot.
  const session =
    started.session.bodyweightKg === null
      ? {
          ...started.session,
          bodyweightKg: (await getSettings()).bodyweightKg ?? (await lastRecordedBodyweightKg()),
        }
      : started.session;

  await db.transaction('rw', [db.sessions, db.exerciseSessions], async () => {
    const open = await db.sessions.where('status').equals('in_progress').first();
    if (open !== undefined && open.id !== started.session.id) {
      throw new SessionInProgressError(open.id);
    }
    await db.sessions.add(session);
    if (started.exerciseSessions.length > 0) {
      await db.exerciseSessions.bulkAdd([...started.exerciseSessions]);
    }
  });
}

export async function lastRecordedBodyweightKg(): Promise<number | null> {
  // A missing weigh-in is unknown, not zero, so scan newest-first until a value
  // is found rather than treating the newest Session as authoritative.
  let found: number | null = null;
  await db.sessions
    .orderBy('startedAt')
    .reverse()
    .until(() => found !== null, true)
    .each((session) => {
      if (found === null && (session.bodyweightKg ?? null) !== null) {
        found = session.bodyweightKg;
      }
    });
  return found;
}

/** Stores the Session and its final ExerciseSession states atomically. */
export async function saveFinishedSession(
  session: Session,
  exerciseSessions: readonly ExerciseSession[],
): Promise<void> {
  await db.transaction('rw', [db.sessions, db.exerciseSessions], async () => {
    if (exerciseSessions.length > 0) await db.exerciseSessions.bulkPut([...exerciseSessions]);
    await db.sessions.put(session);
  });
}

/** A Session with logged sets cannot be discarded. */
export class SessionHasSetsError extends Error {
  readonly sessionId: SessionId;

  constructor(sessionId: SessionId) {
    super(`Session ${sessionId} holds logged sets and cannot be discarded. Finish it instead.`);
    this.name = 'SessionHasSetsError';
    this.sessionId = sessionId;
  }
}

/** Discards only an empty in-progress Session, atomically with its exercises. */
export async function discardSession(id: SessionId): Promise<void> {
  await db.transaction('rw', [db.sessions, db.exerciseSessions, db.completedSets], async () => {
    const session = await db.sessions.get(id);
    if (session === undefined || session.status !== 'in_progress') return;

    const ids = await db.exerciseSessions.where('sessionId').equals(id).primaryKeys();
    const sets = await db.completedSets.where('exerciseSessionId').anyOf(ids).count();
    if (sets > 0) throw new SessionHasSetsError(id);

    await db.exerciseSessions.bulkDelete(ids);
    await db.sessions.delete(id);
  });
}

export async function listSessionsByRoutine(routineId: Session['routineId']): Promise<Session[]> {
  const sessions = await db.sessions.where('routineId').equals(routineId).toArray();
  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

export async function listAllSessions(): Promise<Session[]> {
  return db.sessions.orderBy('startedAt').reverse().toArray();
}

/** Converts inclusive local calendar days to the indexed instant range. */
export async function listSessionsBetween(
  from: LocalDate,
  to: LocalDate,
): Promise<Session[]> {
  const start = parseLocalDate(from).getTime();
  const end = parseLocalDate(addDays(to, 1)).getTime();
  const sessions = await db.sessions.where('startedAt').between(start, end, true, false).toArray();
  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

export async function getLastPerformedWorkout(
  routineId: Session['routineId'],
): Promise<WorkoutId | null> {
  const sessions = await listSessionsByRoutine(routineId);
  return sessions[0]?.workoutId ?? null;
}
