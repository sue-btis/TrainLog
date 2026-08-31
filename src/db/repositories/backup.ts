import { db } from '@/db/database';
import { getExerciseNames } from '@/db/repositories/exercises';
import { groupCompletedSetsByExerciseSession } from '@/db/repositories/completedSets';
import { getSettings } from '@/db/repositories/settings';
import { RESTORED_TABLES, BACKUP_VERSION, type BackupDocument } from '@/domain/backup';
import { formatLocalDate } from '@/domain/dates';
import type { CsvRow } from '@/domain/backup/csv';
import type { SessionId } from '@/domain/ids';
import type { Timestamp } from '@/domain/types';

export async function exportBackup(exportedAt: Timestamp): Promise<BackupDocument> {
  const [
    routines,
    workouts,
    plannedExercises,
    placements,
    exercises,
    sessions,
    exerciseSessions,
    completedSets,
    settings,
  ] = await Promise.all([
    db.routines.toArray(),
    db.workouts.toArray(),
    db.plannedExercises.toArray(),
    db.placements.toArray(),
    db.exercises.toArray(),
    db.sessions.toArray(),
    db.exerciseSessions.toArray(),
    db.completedSets.toArray(),
    getSettings(),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt,
    routines,
    workouts,
    plannedExercises,
    placements,
    exercises,
    sessions,
    exerciseSessions,
    completedSets,
    // Older databases may have no settings row or only the unit; `getSettings`
    // resolves both shapes.
    settings,
  };
}

export type TableCounts = Readonly<Record<(typeof RESTORED_TABLES)[number], number>>;

export interface RestoreSummary {
  readonly current: TableCounts;
  readonly incoming: TableCounts;
  /** Restore replaces `sessions`, so an in-progress Session is lost. */
  readonly losesSessionInProgress: boolean;
}

export async function restoreSummary(document: BackupDocument): Promise<RestoreSummary> {
  const counts = await Promise.all(RESTORED_TABLES.map((table) => db.table(table).count()));

  const current = Object.fromEntries(
    RESTORED_TABLES.map((table, index) => [table, counts[index] ?? 0]),
  ) as TableCounts;

  const incoming = Object.fromEntries(
    RESTORED_TABLES.map((table) => [table, document[table].length]),
  ) as TableCounts;

  const open = await db.sessions.where('status').equals('in_progress').first();

  return { current, incoming, losesSessionInProgress: open !== undefined };
}

export async function restoreBackup(document: BackupDocument): Promise<void> {
  // Replace every restored table in one transaction so a failure cannot leave
  // a database assembled from old and incoming rows.
  const tables = RESTORED_TABLES.map((table) => db.table(table));

  await db.transaction('rw', tables, async () => {
    for (const table of RESTORED_TABLES) {
      await db.table(table).clear();
      const rows = document[table];
      if (rows.length > 0) await db.table(table).bulkAdd([...rows]);
    }
  });
}

export async function listSetsForCsv(): Promise<CsvRow[]> {
  const sessions = await db.sessions.toArray();
  if (sessions.length === 0) return [];

  sessions.sort((a, b) => a.startedAt - b.startedAt);

  const exerciseSessions = await db.exerciseSessions.toArray();
  const sets = await groupCompletedSetsByExerciseSession(
    exerciseSessions.map((exerciseSession) => exerciseSession.id),
  );
  const names = await getExerciseNames(
    exerciseSessions.map((exerciseSession) => exerciseSession.exerciseId),
  );

  const bySession = new Map<SessionId, typeof exerciseSessions>();
  for (const exerciseSession of exerciseSessions) {
    const group = bySession.get(exerciseSession.sessionId);
    if (group === undefined) bySession.set(exerciseSession.sessionId, [exerciseSession]);
    else group.push(exerciseSession);
  }

  const rows: CsvRow[] = [];
  for (const session of sessions) {
    const date = formatLocalDate(new Date(session.startedAt));
    const performed = [...(bySession.get(session.id) ?? [])].sort((a, b) => a.order - b.order);

    for (const exerciseSession of performed) {
      // A missing catalog entry should not happen; retain the id as a fallback
      // if corrupt or outdated data contains one.
      const exercise = names.get(exerciseSession.exerciseId) ?? exerciseSession.exerciseId;

      for (const set of sets.get(exerciseSession.id) ?? []) {
        rows.push({
          date,
          exercise,
          set: set.setNumber,
          weight: set.weight,
          unit: set.unit,
          reps: set.reps,
          rir: set.rir,
          // Use the ExerciseSession snapshot, not whichever fields the set has.
          measurement: exerciseSession.measurement,
          durationSeconds: set.durationSeconds,
          distance: set.distance,
          distanceUnit: set.distanceUnit,
        });
      }
    }
  }

  return rows;
}
