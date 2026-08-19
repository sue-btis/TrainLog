/**
 * History reads (§11.8, §11.9, §26, REQ-061, AC-063).
 *
 * Assembles the `SessionHistory[]` shape the progression engine declares
 * (`@/domain/progression`). The engine is a pure function over that value: it
 * does its own `completed` filter and its own ordering, so nothing is filtered
 * out here. `partial` and `in_progress` Sessions are part of history and stay
 * visible (§11.9) — hiding them in the repository would make the engine's own
 * filter untestable.
 *
 * History is keyed by `exerciseId` and never by `plannedExerciseId` (REQ-061):
 * every import creates new PlannedExercises, so querying by template would
 * restart progression on every corrected file (§26).
 *
 * Every query below is served by a declared index or the primary key (AC-073):
 * `exerciseSessions.exerciseId`, `exerciseSessions.sessionId`,
 * `completedSets.exerciseSessionId`, and `sessions` by `id`. Nothing scans.
 */

import { db } from '@/db/database';
import { groupCompletedSetsByExerciseSession } from '@/db/repositories/completedSets';
import { listExerciseSessionsBySession } from '@/db/repositories/exerciseSessions';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { SessionHistory } from '@/domain/progression';
import type { ExerciseSession } from '@/domain/types';

/** Groups already-loaded ExerciseSessions with their sets, newest Session first. */
async function assemble(
  exerciseSessions: readonly ExerciseSession[],
): Promise<SessionHistory[]> {
  const sets = await groupCompletedSetsByExerciseSession(
    exerciseSessions.map((exercise) => exercise.id),
  );

  const bySession = new Map<SessionId, ExerciseSession[]>();
  for (const exercise of exerciseSessions) {
    const group = bySession.get(exercise.sessionId);
    if (group === undefined) bySession.set(exercise.sessionId, [exercise]);
    else group.push(exercise);
  }

  const sessionIds = [...bySession.keys()];
  const sessions = await db.sessions.bulkGet(sessionIds);

  return sessions
    .filter((session) => session !== undefined)
    .map((session) => ({
      session,
      exercises: (bySession.get(session.id) ?? [])
        .sort((a, b) => a.order - b.order)
        .map((exerciseSession) => ({
          exerciseSession,
          sets: sets.get(exerciseSession.id) ?? [],
        })),
    }))
    .sort((a, b) => b.session.startedAt - a.session.startedAt);
}

/**
 * The full history of one Exercise, newest Session first — the value passed
 * straight to `suggestLoad` (REQ-061, §11.9).
 *
 * It spans Routines: the query is by `exerciseId`, so re-importing a programme
 * continues the same history rather than starting a new one (§26). Each entry
 * carries only the ExerciseSessions for `exerciseId`; the engine reads nothing
 * else off the Session but `status` and `startedAt`.
 *
 * Index: exerciseSessions.exerciseId.
 */
export async function listExerciseHistory(exerciseId: ExerciseId): Promise<SessionHistory[]> {
  const exerciseSessions = await db.exerciseSessions
    .where('exerciseId')
    .equals(exerciseId)
    .toArray();
  return assemble(exerciseSessions);
}

/**
 * One Session with every exercise it contains and every set logged in it — the
 * session detail read, and the resume read after recovery (§35).
 *
 * Index: exerciseSessions.sessionId; `sessions` by primary key.
 */
export async function getSessionDetail(
  sessionId: SessionId,
): Promise<SessionHistory | undefined> {
  const session = await db.sessions.get(sessionId);
  if (session === undefined) return undefined;

  const exerciseSessions = await listExerciseSessionsBySession(sessionId);
  const sets = await groupCompletedSetsByExerciseSession(
    exerciseSessions.map((exercise) => exercise.id),
  );

  return {
    session,
    exercises: exerciseSessions.map((exerciseSession) => ({
      exerciseSession,
      sets: sets.get(exerciseSession.id) ?? [],
    })),
  };
}

/**
 * §11.8 — the sets of the most recent Session that actually contains sets for
 * `exerciseId`, shown before performing it. Sessions of any status count: what
 * is displayed is "what you did last time", not what progression feeds on.
 *
 * `excludeSessionId` drops the Session being performed right now, so the
 * in-progress session's own sets never masquerade as the previous performance.
 */
export async function getPreviousPerformance(
  exerciseId: ExerciseId,
  excludeSessionId?: SessionId,
): Promise<SessionHistory | undefined> {
  const history = await listExerciseHistory(exerciseId);
  return history.find(
    (entry) =>
      entry.session.id !== excludeSessionId &&
      entry.exercises.some((exercise) => exercise.sets.length > 0),
  );
}
