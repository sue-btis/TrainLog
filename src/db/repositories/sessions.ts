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
import type { SessionId } from '@/domain/ids';
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
