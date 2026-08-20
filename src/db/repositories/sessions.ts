/**
 * Sessions (§14.6, §35, §36, REQ-057, REQ-058).
 *
 * A Session is written twice in its life: once when it starts, once when it
 * finishes. Everything in between is a set landing on an ExerciseSession, which
 * is `completedSets.saveLoggedSet`'s job — the Session row itself is untouched
 * while training, so an interrupted session needs no repair on recovery.
 *
 * Domain functions produce the values; nothing here derives status or reads the
 * clock (`startSession`, `finishSession` in `@/domain/session`).
 */

import { db } from '@/db/database';
import { addDays, parseLocalDate, type LocalDate } from '@/domain/dates';
import type { SessionId, WorkoutId } from '@/domain/ids';
import type { ExerciseSession, Session } from '@/domain/types';

/**
 * Thrown when starting a Session while another is still `in_progress`
 * (REQ-058). The caller resumes or finishes that one first — §35 recovers a
 * session, it never abandons one silently.
 */
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

/**
 * The single recoverable Session, or `undefined` (REQ-058, §35). Index: status.
 *
 * This is the read the app performs on load: "is a training session open?".
 */
export function getInProgressSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('in_progress').first();
}

/**
 * Persists a Session produced by `startSession`, refusing a second concurrent
 * one (REQ-058). One transaction, so the at-most-one invariant has no window in
 * which it is false. Index: status.
 */
export async function createSession(session: Session): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const open = await db.sessions.where('status').equals('in_progress').first();
    if (open !== undefined && open.id !== session.id) throw new SessionInProgressError(open.id);
    await db.sessions.add(session);
  });
}

/**
 * R-2 — persists what `startWorkout` produced: the Session and one
 * ExerciseSession per planned exercise, in a single transaction.
 *
 * One transaction because the two are one fact. A Session written without its
 * exercises would be an `in_progress` session that `deriveSessionStatus` reads
 * as `completed` the moment it is finished (DEC-009); exercises written without
 * their Session would be rows nothing can reach. The REQ-058 refusal happens
 * inside the same transaction, so the at-most-one invariant still has no window
 * in which it is false.
 *
 * This is what the Today screen calls. `createSession` above writes a Session
 * alone and now has no production caller — it survives as the narrow primitive
 * the repository tests build fixtures from. Index: status.
 */
export async function createStartedWorkout(started: {
  readonly session: Session;
  readonly exerciseSessions: readonly ExerciseSession[];
}): Promise<void> {
  await db.transaction('rw', [db.sessions, db.exerciseSessions], async () => {
    const open = await db.sessions.where('status').equals('in_progress').first();
    if (open !== undefined && open.id !== started.session.id) {
      throw new SessionInProgressError(open.id);
    }
    await db.sessions.add(started.session);
    if (started.exerciseSessions.length > 0) {
      await db.exerciseSessions.bulkAdd([...started.exerciseSessions]);
    }
  });
}

/**
 * Persists a Session produced by `finishSession` together with the final state
 * of its ExerciseSessions (REQ-057).
 *
 * Both in one transaction: the derived `completed`/`partial` status is a
 * function of those ExerciseSession statuses (DEC-009), so writing the Session
 * without them could leave a status that its own exercises contradict.
 */
export async function saveFinishedSession(
  session: Session,
  exerciseSessions: readonly ExerciseSession[],
): Promise<void> {
  await db.transaction('rw', [db.sessions, db.exerciseSessions], async () => {
    if (exerciseSessions.length > 0) await db.exerciseSessions.bulkPut([...exerciseSessions]);
    await db.sessions.put(session);
  });
}

/** The Sessions of one Routine, newest first (§11.10, §37). Index: routineId. */
export async function listSessionsByRoutine(routineId: Session['routineId']): Promise<Session[]> {
  const sessions = await db.sessions.where('routineId').equals(routineId).toArray();
  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * The Sessions that fall on the local days `from`..`to`, inclusive, across
 * every Routine (R-43, §11.3).
 *
 * A Session carries `startedAt` as an instant and the calendar asks in local
 * days, so the range is converted to the local instants that bound those days —
 * never to UTC. A Session started at 23:30 belongs to that local day (REQ-013).
 * Index: startedAt.
 */
export async function listSessionsBetween(
  from: LocalDate,
  to: LocalDate,
): Promise<Session[]> {
  const start = parseLocalDate(from).getTime();
  const end = parseLocalDate(addDays(to, 1)).getTime();
  const sessions = await db.sessions.where('startedAt').between(start, end, true, false).toArray();
  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * The Workout of the most recently started Session of a Routine, or `null` —
 * what `nextWorkoutInRotation` advances from when today has no Placement
 * (§11.4). Index: routineId.
 */
export async function getLastPerformedWorkout(
  routineId: Session['routineId'],
): Promise<WorkoutId | null> {
  const sessions = await listSessionsByRoutine(routineId);
  return sessions[0]?.workoutId ?? null;
}
