/** History is keyed by `exerciseId`, never by re-importable PlannedExercises. */
import { db } from '@/db/database';
import { groupCompletedSetsByExerciseSession } from '@/db/repositories/completedSets';
import { listExerciseSessionsBySession } from '@/db/repositories/exerciseSessions';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { SessionHistory } from '@/domain/progression';
import type { ExerciseSession } from '@/domain/types';

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

export async function listExerciseHistory(exerciseId: ExerciseId): Promise<SessionHistory[]> {
  const exerciseSessions = await db.exerciseSessions
    .where('exerciseId')
    .equals(exerciseId)
    .toArray();
  return assemble(exerciseSessions);
}

export async function listPerformedExercises(): Promise<ExerciseId[]> {
  const ids = await db.exerciseSessions.orderBy('exerciseId').uniqueKeys();
  return ids as ExerciseId[];
}

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

/** Excludes the current Session so its sets cannot appear as prior performance. */
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
