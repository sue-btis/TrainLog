/**
 * Dexie schema, version 1 (REQ-070, REQ-072, §17, §34).
 *
 * This declaration is effectively irreversible: a user's IndexedDB is the only
 * copy of their history, so every later change to it must be a forward
 * migration. It therefore declares the tables and indexes for the whole
 * technical spine — planning *and* execution — even though the execution
 * repositories are written in a later workstream. Nothing outside this file
 * may add a table or an index at version 1.
 *
 * Exactly nine tables, matching the backup document of §17 field for field so
 * that export and restore can serialize the database without a translation
 * layer:
 *
 *   routines, workouts, plannedExercises, placements, exercises,
 *   sessions, exerciseSessions, completedSets, settings
 *
 * `exercises` holds user-created Exercises only. Catalog Exercises ship inside
 * the build (`src/domain/catalog`) and are never inserted (DEC-007, REQ-071),
 * which is what makes §17 ("the base catalog is not exported") and §18
 * ("restore does not replace the bundled catalog") fall out of the layout.
 *
 * `ProgressionRule` is embedded on `PlannedExercise` and on
 * `PlannedExerciseSession`, not stored as a table (DEC-006).
 */

import Dexie, { type Table } from 'dexie';
import type {
  CompletedSetId,
  ExerciseId,
  ExerciseSessionId,
  PlacementId,
  PlannedExerciseId,
  RoutineId,
  SessionId,
  WorkoutId,
} from '@/domain/ids';
import type {
  CompletedSet,
  Exercise,
  ExerciseSession,
  Placement,
  PlannedExercise,
  Routine,
  Session,
  Settings,
  Workout,
} from '@/domain/types';

/** The database name. One database, one local user (§NFR-08). */
export const DATABASE_NAME = 'trainlog';

/** The only schema version that exists. A change here needs a migration (§8). */
export const SCHEMA_VERSION = 1;

/**
 * The nine tables of REQ-070, as Dexie store definitions.
 *
 * `id` is the primary key everywhere: every entity is keyed by a generated id,
 * never by a name (REQ-011, §24). Catalog slugs and UUIDs share the `exercises`
 * key space by design — the two forms cannot collide, so provenance stays
 * derivable (DEC-007).
 *
 * Index → query map (AC-073). Every secondary index below exists because a
 * repository query uses it; no repository query in either wave falls outside
 * this list.
 *
 *   routines.status              listRoutinesByStatus / getActiveRoutine —
 *                                the routine list of §11.2 and Today's
 *                                "which routine is active" read.
 *   workouts.routineId           listWorkoutsByRoutine — every read of a
 *                                Routine's Workouts, and the cascade behind
 *                                deleteRoutine.
 *   plannedExercises.workoutId   listPlannedExercisesByWorkout, and the
 *                                `anyOf(workoutIds)` delete in the
 *                                deleteRoutine cascade.
 *   placements.date              listPlacementsBetween — the calendar's date
 *                                range read (§11.3) and Today (§11.4).
 *   placements.routineId         listPlacementsByRoutine — the placements a
 *                                given import generated, and the cascade.
 *   sessions.status              WS-7: finding the single `in_progress`
 *                                Session on load (REQ-058, §35), and the
 *                                `completed`-only filter progression applies
 *                                (REQ-062).
 *   sessions.startedAt           WS-7: history in reverse chronological order,
 *                                and "the most recent completed session" the
 *                                progression engine reads (§11.9, §29).
 *   sessions.routineId           deleteRoutine — the REQ-075 refusal, "does any
 *                                Session reference this Routine?" (§11.2, §37),
 *                                and the "Sessions of this Routine" read of
 *                                §11.10. Added by the REQ-072 amendment.
 *   exerciseSessions.sessionId   WS-7: the exercises of one Session, and the
 *                                pending/performed scan that derives Session
 *                                status (DEC-009).
 *   exerciseSessions.exerciseId  WS-7: history keyed by `exerciseId` and never
 *                                by `plannedExerciseId` (REQ-061, §26) — the
 *                                query that lets a re-import keep history.
 *   completedSets.exerciseSessionId
 *                                WS-7: the sets of one ExerciseSession, for
 *                                history and for progression arithmetic.
 *
 * `exercises` and `settings` carry no secondary index: user Exercises are read
 * whole for name resolution (the matching itself is domain logic, §26) and
 * settings is a singleton row keyed `'settings'` (REQ-077).
 */
export const SCHEMA_V1 = {
  routines: 'id, status',
  workouts: 'id, routineId',
  plannedExercises: 'id, workoutId',
  placements: 'id, date, routineId',
  exercises: 'id',
  sessions: 'id, status, startedAt, routineId',
  exerciseSessions: 'id, sessionId, exerciseId',
  completedSets: 'id, exerciseSessionId',
  settings: 'id',
} as const;

/** The table names of REQ-070, for the AC-071 check. */
export const TABLE_NAMES = Object.keys(SCHEMA_V1) as readonly (keyof typeof SCHEMA_V1)[];

/**
 * The typed Dexie handle. The only class in the tree that opens IndexedDB
 * (REQ-073); everything else goes through `src/db/repositories`.
 */
export class TrainLogDatabase extends Dexie {
  declare readonly routines: Table<Routine, RoutineId>;
  declare readonly workouts: Table<Workout, WorkoutId>;
  declare readonly plannedExercises: Table<PlannedExercise, PlannedExerciseId>;
  declare readonly placements: Table<Placement, PlacementId>;
  declare readonly exercises: Table<Exercise, ExerciseId>;
  declare readonly sessions: Table<Session, SessionId>;
  declare readonly exerciseSessions: Table<ExerciseSession, ExerciseSessionId>;
  declare readonly completedSets: Table<CompletedSet, CompletedSetId>;
  declare readonly settings: Table<Settings, 'settings'>;

  constructor(name: string = DATABASE_NAME) {
    super(name);
    this.version(SCHEMA_VERSION).stores(SCHEMA_V1);
  }
}
