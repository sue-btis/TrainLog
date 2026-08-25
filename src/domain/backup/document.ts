/**
 * The backup document (§17).
 *
 * A published format. The moment a lifter saves a file, this shape is a
 * contract with every future build: a document exported today must restore into
 * the app a year from now, on a phone that has never seen this one.
 *
 * It is the database, serialized. The nine tables of `SCHEMA_V1` appear here
 * key for key, unrenamed and unreshaped, because `src/db/schema.ts` was laid
 * out to make exactly that possible — "matching the backup document of §17
 * field for field so that export and restore can serialize the database
 * without a translation layer". There is no translation layer, and adding one
 * would mean the two have drifted.
 *
 * Eight tables are arrays. `settings` is the singleton row it is in storage.
 *
 * What is *not* here matters as much:
 *
 * - **Catalog Exercises.** `exercises` holds user-created Exercises only,
 *   because that is all the table ever holds (DEC-007). The catalog travels
 *   inside the build, so §17's "el catálogo base no se exporta" needs no
 *   filter — it is a property of the layout.
 * - **Derived values.** No suggested load, no working weight, no missed day.
 *   Progression is recomputed from history (§11.9) and a missed day is derived
 *   at query time (ADR 0001). Storing either would let a restored file
 *   contradict the app.
 */

import type {
  CompletedSet,
  Exercise,
  ExerciseSession,
  Placement,
  PlannedExercise,
  Routine,
  Session,
  Settings,
  Timestamp,
  Workout,
} from '@/domain/types';

/**
 * The document format version (§18).
 *
 * Deliberately **not** `SCHEMA_VERSION`. They answer different questions: the
 * Dexie version says how the local database is laid out, this says how a file
 * on disk is shaped. Adding an index changes one and not the other, and a
 * lifter's saved backups must not be invalidated by a change they cannot see.
 *
 * Bump this only when the document's own shape changes.
 *
 * v1 -> v2 carries `measurement`, `bodyweightKg`, the non-rep target pair and
 * the four conditional set fields. The bump is not bookkeeping: `z.object`
 * strips unknown keys before checks run, so an older build handed a v2
 * document would silently drop `measurement` and restore a lifter's planks and
 * runs as weight x reps. The version gate is the only thing standing between
 * them and that, which is why it has to move (REQ-127, ASM-3).
 */
export const BACKUP_VERSION = 2;

/**
 * The §17 document: a version, when it was taken, and the nine tables.
 *
 * `exportedAt` is a `Timestamp` rather than an ISO string so it round-trips
 * through JSON as the same value every other instant in the domain uses
 * (`createdAt`, `startedAt`, `completedAt`).
 */
export interface BackupDocument {
  readonly version: number;
  readonly exportedAt: Timestamp;
  readonly routines: readonly Routine[];
  readonly workouts: readonly Workout[];
  readonly plannedExercises: readonly PlannedExercise[];
  readonly placements: readonly Placement[];
  readonly exercises: readonly Exercise[];
  readonly sessions: readonly Session[];
  readonly exerciseSessions: readonly ExerciseSession[];
  readonly completedSets: readonly CompletedSet[];
  readonly settings: Settings;
}

/**
 * The eight tables `Restore` replaces (§18).
 *
 * `settings` is absent on purpose: §18 lists what restore replaces and settings
 * is not on it. A backup carries the setting so nothing is lost from the file,
 * and restoring leaves the device's own preference alone.
 *
 * Ordered parents-first, so a reader can follow the reference chain down.
 */
export const RESTORED_TABLES = [
  'routines',
  'workouts',
  'plannedExercises',
  'placements',
  'exercises',
  'sessions',
  'exerciseSessions',
  'completedSets',
] as const;

export type RestoredTable = (typeof RESTORED_TABLES)[number];
