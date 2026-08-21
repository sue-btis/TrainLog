/**
 * Backup and restore (§17, §18).
 *
 * The database, out to a document and back. There is no translation layer and
 * there must not be one: `src/db/schema.ts` declares its nine tables "matching
 * the backup document of §17 field for field so that export and restore can
 * serialize the database without a translation layer". Every function here is
 * a read or a write of rows that are already the right shape.
 *
 * The asymmetry between the two directions is deliberate and comes from §18:
 *
 *   export   nine tables out, `settings` included
 *   restore  eight tables in, `settings` left alone
 *
 * A backup carries the setting so nothing is missing from the file; restoring
 * does not impose it, because the unit you train in belongs to the phone in
 * your hand, not to the file you are recovering.
 *
 * Nothing here validates. A document reaches `restoreBackup` only after
 * `parseBackup` has accepted it (§18: validate *before* modifying the local
 * database), and splitting those steps is what lets the screen show the lifter
 * what they are about to lose while the database is still intact.
 */

import { db } from '@/db/database';
import { getExerciseNames } from '@/db/repositories/exercises';
import { groupCompletedSetsByExerciseSession } from '@/db/repositories/completedSets';
import { getSettings } from '@/db/repositories/settings';
import { RESTORED_TABLES, BACKUP_VERSION, type BackupDocument } from '@/domain/backup';
import { formatLocalDate } from '@/domain/dates';
import type { CsvRow } from '@/domain/backup/csv';
import type { SessionId } from '@/domain/ids';
import type { Timestamp } from '@/domain/types';

/**
 * The whole database as a §17 document.
 *
 * `exportedAt` is a parameter, not a clock read: the domain takes its instants
 * from the caller (DEC-008) and this keeps the repository testable for the same
 * reason.
 *
 * `exercises` needs no filter. The table holds user-created Exercises only —
 * catalog entries ship inside the build and are never inserted (DEC-007) — so
 * §17's "el catálogo base no se exporta" is a property of the schema rather
 * than a rule this function has to remember.
 */
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
    // Complete whatever the row holds: a database nobody has changed a setting
    // in has no row at all, and one written before the later settings existed
    // carries only the unit. `getSettings` resolves both (§32).
    settings,
  };
}

/** Row counts per restored table, for the two sides of the confirmation. */
export type TableCounts = Readonly<Record<(typeof RESTORED_TABLES)[number], number>>;

/**
 * What a restore would destroy, and what it would install (R-6).
 *
 * Read-only, and separate from `restoreBackup` on purpose: §18 requires the
 * document to be validated before the database is modified, and DEC-C requires
 * the lifter to be told what they are giving up. Both need a moment where the
 * document is known-good and nothing has been written yet, which is this one.
 */
export interface RestoreSummary {
  readonly current: TableCounts;
  readonly incoming: TableCounts;
  /**
   * Whether an open Session is among the losses (§35).
   *
   * Restore replaces `sessions`, so a training session in progress goes with
   * it. Nothing here prevents that — it is named so the confirmation can say
   * so, because a lifter mid-workout deserves to be told before, not after.
   */
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

/**
 * Replaces the database with a validated document (§18).
 *
 * One transaction over the eight tables §18 lists. Atomic because a partial
 * restore is a corrupt database and the database is the only copy a lifter has:
 * if the fourth table fails, the three already cleared must come back. Dexie
 * aborts and rolls the whole thing back, which is the same guarantee
 * `importRoutine` relies on for the same reason.
 *
 * `settings` is outside the transaction's scope rather than merely skipped
 * inside it, so the table cannot be touched even by mistake.
 *
 * `bulkAdd` rather than `bulkPut`: each table was just cleared, so a key
 * collision means the document contains duplicate ids. `parseBackup` refuses
 * those, and if one arrives anyway, failing loudly inside the transaction is
 * the correct outcome.
 */
export async function restoreBackup(document: BackupDocument): Promise<void> {
  const tables = RESTORED_TABLES.map((table) => db.table(table));

  await db.transaction('rw', tables, async () => {
    for (const table of RESTORED_TABLES) {
      await db.table(table).clear();
      const rows = document[table];
      if (rows.length > 0) await db.table(table).bulkAdd([...rows]);
    }
  });
}

/**
 * Every logged set, flattened for CSV (§19), oldest Session first.
 *
 * Chronological because this file is read as a training log: a spreadsheet
 * opened at the top should start where the lifter started. The screens sort
 * newest-first for the opposite reason — what you did last time is the thing
 * you need now.
 *
 * The whole database, in three reads and no per-row lookups: Sessions, then
 * their ExerciseSessions, then the sets of those, with names resolved in one
 * batch through `getExerciseNames` so catalog and user-created Exercises both
 * come back (DEC-007).
 *
 * `date` is the Session's local calendar day derived from `startedAt`, not a
 * UTC one (REQ-013) — a set logged at 22:30 belongs to the evening it happened
 * in, not to tomorrow.
 */
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
      // An Exercise the catalog dropped would resolve to nothing. REQ-023
      // forbids that, so it cannot happen — but a nameless row would be worse
      // than a labelled one, and the id is at least traceable.
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
        });
      }
    }
  }

  return rows;
}
