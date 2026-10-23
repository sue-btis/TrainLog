/** History is keyed by `exerciseId`, never by re-importable PlannedExercises. */
import { db } from '@/db/database';
import { groupCompletedSetsByExerciseSession } from '@/db/repositories/completedSets';
import { listExerciseSessionsBySession } from '@/db/repositories/exerciseSessions';
import { getExercisesById } from '@/db/repositories/exercises';
import { listPlacementsBetween } from '@/db/repositories/placements';
import { listPlannedExercisesByWorkout } from '@/db/repositories/plannedExercises';
import { listSessionsBetween } from '@/db/repositories/sessions';
import type { LocalDate } from '@/domain/dates';
import type { ExerciseId, RoutineId, SessionId } from '@/domain/ids';
import type { SessionHistory } from '@/domain/progression';
import type { ExerciseSession, Timestamp } from '@/domain/types';
import type { VolumeEntry } from '@/domain/volume';

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

export interface PerformedExercise {
  readonly exerciseId: ExerciseId;
  /** Start of the newest Session that logged a set of it; `null` if none did. */
  readonly lastPerformed: Timestamp | null;
}

/** Every exercise that has an Exercise Session, most recently trained first. */
export async function listPerformedExercisesByRecency(): Promise<PerformedExercise[]> {
  const exerciseSessions = await db.exerciseSessions.toArray();
  const sets = await groupCompletedSetsByExerciseSession(exerciseSessions.map((e) => e.id));
  const sessions = await db.sessions.bulkGet([...new Set(exerciseSessions.map((e) => e.sessionId))]);
  const startedAt = new Map(
    sessions.flatMap((session) => (session === undefined ? [] : [[session.id, session.startedAt] as const])),
  );

  const last = new Map<ExerciseId, Timestamp | null>();
  for (const exercise of exerciseSessions) {
    const started = (sets.get(exercise.id)?.length ?? 0) > 0 ? startedAt.get(exercise.sessionId) : undefined;
    const seen = last.get(exercise.exerciseId) ?? null;
    last.set(
      exercise.exerciseId,
      started === undefined ? seen : Math.max(seen ?? started, started),
    );
  }

  return [...last]
    .map(([exerciseId, lastPerformed]) => ({ exerciseId, lastPerformed }))
    .sort((a, b) => (b.lastPerformed ?? -1) - (a.lastPerformed ?? -1));
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

/**
 * The week's planned and logged sets, one entry per exercise row. Planned reads
 * the active Routine's Placements in the range; logged reads every Session
 * started in it, whatever Routine it belongs to.
 */
export async function listWeekVolume(
  routineId: RoutineId | null,
  from: LocalDate,
  to: LocalDate,
): Promise<{ readonly planned: VolumeEntry[]; readonly performed: VolumeEntry[] }> {
  const placements =
    routineId === null
      ? []
      : (await listPlacementsBetween(from, to)).filter((placement) => placement.routineId === routineId);
  const plannedRows = (
    await Promise.all(placements.map((placement) => listPlannedExercisesByWorkout(placement.workoutId)))
  ).flat();

  const sessions = await listSessionsBetween(from, to);
  const exerciseSessions = (
    await Promise.all(sessions.map((session) => listExerciseSessionsBySession(session.id)))
  ).flat();
  const sets = await groupCompletedSetsByExerciseSession(exerciseSessions.map((exercise) => exercise.id));

  const exercises = await getExercisesById([
    ...plannedRows.map((row) => row.exerciseId),
    ...exerciseSessions.map((exercise) => exercise.exerciseId),
  ]);
  const entry = (exerciseId: ExerciseId, count: number): VolumeEntry => {
    const exercise = exercises.get(exerciseId);
    return {
      exerciseId,
      name: exercise?.name ?? 'Exercise',
      category: exercise?.category ?? null,
      sets: count,
    };
  };

  return {
    planned: plannedRows.map((row) => entry(row.exerciseId, row.sets)),
    performed: exerciseSessions
      .map((exercise) => entry(exercise.exerciseId, sets.get(exercise.id)?.length ?? 0))
      .filter((performed) => performed.sets > 0),
  };
}
