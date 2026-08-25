/**
 * Dexie schema (REQ-070, REQ-072, §17, §34).
 *
 * This declaration is effectively irreversible: a user's IndexedDB is the only
 * copy of their history, so every later change to it must be a forward
 * migration. Version 2 is the first of those — it adds no table and no index,
 * only a backfill for a field that was added to a stored type without one. It therefore declares the tables and indexes for the whole
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
 *
 * The store definitions below are still `SCHEMA_V1`, and the name is accurate:
 * no version since has changed a table or an index.
 */

import Dexie, { type Table, type Transaction } from 'dexie';
import { getCatalogExercise } from '@/domain/catalog';
import type { Measurement } from '@/domain/measurement';
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
  Unit,
  Workout,
} from '@/domain/types';

/** The database name. One database, one local user (§NFR-08). */
export const DATABASE_NAME = 'trainlog';

/**
 * The current schema version. A change here needs a migration (§8).
 *
 * v1 → v2 adds no table and no index. It exists because `plannedUnit` became a
 * required field of `PlannedExerciseSession` after v1 shipped, which left rows
 * on disk that the type system believes are complete and are not. See
 * `backfillPlannedUnit`.
 *
 * v2 → v3 is the same shape of change for the same reason: `measurement` became
 * a required field of `Exercise` and of `ExerciseSessionBase`. It adds no table
 * and no index either, and it reads no `completedSets` row and writes none
 * (REQ-124, DEC-L). See `backfillMeasurement`.
 */
export const SCHEMA_VERSION = 3;

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
    // Both versions declare the same stores. Dexie rebuilds each version's
    // parsed schema inside `stores()`, using the versions registered at that
    // moment — so a version that only calls `upgrade()` is left with an empty
    // schema, and the empty schema is what `deleteRemovedTables` reads. The
    // repetition is not redundancy; omitting it drops every table.
    this.version(1).stores(SCHEMA_V1);
    this.version(2).stores(SCHEMA_V1).upgrade(backfillPlannedUnit);
    this.version(3).stores(SCHEMA_V1).upgrade(backfillMeasurement);
  }
}

/**
 * The unit a backfilled row gets when its PlannedExercise cannot be found.
 *
 * Declared here rather than imported from the settings repository: this file is
 * the bottom of the persistence layer and repositories are built on top of it,
 * so reaching up would close a cycle. It is the same kilogram default the rest
 * of the app starts from (§32).
 */
const FALLBACK_UNIT: Unit = 'kg';

/**
 * v1 → v2: gives every stored `PlannedExerciseSession` the `plannedUnit` it
 * was always supposed to have (§11.7, ADR 0002).
 *
 * `plannedUnit` became a required field after v1 shipped. Rows written before
 * that do not have it, so they contradict `PlannedExerciseSession` while the
 * compiler believes otherwise — and the backup validator, which checks what is
 * actually there rather than what the types promise, refuses them. The visible
 * symptom is a lifter who can export a backup and not restore it.
 *
 * The value comes from the PlannedExercise the session was snapshotted from,
 * which is where `startPlannedExercise` reads it today, so the backfill writes
 * what the original code would have written.
 *
 * Two rows are deliberately left alone:
 *
 * - **Unplanned sessions.** They carry no planned targets at all (§14.7);
 *   adding one would make a shape the domain forbids.
 * - **Rows that already have a unit.** The snapshot outranks the template — a
 *   re-import may since have changed it, and rewriting history to match is
 *   exactly what ADR 0002 exists to prevent.
 *
 * The fallback matters little in practice. A PlannedExercise can only be absent
 * if its Routine was deleted, which §37 refuses while any Session references
 * it; and once a set exists, `CompletedSet.unit` is what every screen reads
 * (`ExerciseView`), so `plannedUnit` only decides the very first entry.
 */
async function backfillPlannedUnit(transaction: Transaction): Promise<void> {
  const planned = await transaction.table<PlannedExercise>('plannedExercises').toArray();
  const unitOf = new Map(planned.map((exercise) => [exercise.id, exercise.unit] as const));

  await transaction
    .table<Record<string, unknown>>('exerciseSessions')
    .toCollection()
    .modify((row) => {
      const plannedExerciseId = row.plannedExerciseId;
      if (typeof plannedExerciseId !== 'string') return;
      if (row.plannedUnit !== undefined) return;
      row.plannedUnit = unitOf.get(plannedExerciseId as PlannedExerciseId) ?? FALLBACK_UNIT;
    });
}

/**
 * The measurement a backfilled row gets when nothing else resolves.
 *
 * `weight_reps` is the only type provable from data written before measurements
 * existed (REQ-125, DEC-M): every stored set carries a weight, a unit and a rep
 * count, which is exactly what that type collects.
 */
const FALLBACK_MEASUREMENT: Measurement = 'weight_reps';

/**
 * v2 → v3: gives every stored `Exercise` and `ExerciseSession` the
 * `measurement` they were always supposed to have (REQ-124, REQ-125).
 *
 * Two tables, and deliberately only two.
 *
 * - **`exercises`** holds user-created Exercises only (DEC-007). Nothing about
 *   a row written before this change says how the movement was measured, so
 *   every one becomes `weight_reps` — see `FALLBACK_MEASUREMENT`.
 * - **`exerciseSessions`** resolve theirs from the Exercise they name, catalog
 *   first and then the table, which is `getExercise`'s own precedence. A slug
 *   the catalog knows therefore backfills to that slug's real type: a stored
 *   `plank` session becomes `duration`, not `weight_reps` (AC-139).
 *
 * **No `completedSets` row is read or written.** That is the whole of DEC-L and
 * it is what makes this migration lossless: a stored `push-up` set holding
 * `weight: 0` reads correctly under `bodyweight_reps` because that type does
 * not read the field, and under `weighted_bodyweight` because zero means "no
 * added weight" — which is true. Reinterpretation comes from the Exercise's
 * declaration, never from rewriting what was logged.
 *
 * `sessions.bodyweightKg` is likewise left absent and reads as `null`: no
 * backfill invents a bodyweight nobody recorded (REQ-126, DEC-I).
 *
 * A row that already carries a measurement is left alone, for the reason
 * `backfillPlannedUnit` leaves an existing `plannedUnit` alone: the stored
 * value outranks a re-derivation.
 */
async function backfillMeasurement(transaction: Transaction): Promise<void> {
  await transaction
    .table<Record<string, unknown>>('exercises')
    .toCollection()
    .modify((row) => {
      if (row.measurement !== undefined) return;
      row.measurement = FALLBACK_MEASUREMENT;
    });

  // Read after the write above, so a user Exercise resolves to the value this
  // same upgrade just gave it rather than to the fallback twice over.
  const userExercises = await transaction.table<Exercise>('exercises').toArray();
  const stored = new Map(userExercises.map((exercise) => [exercise.id, exercise.measurement]));

  await transaction
    .table<Record<string, unknown>>('exerciseSessions')
    .toCollection()
    .modify((row) => {
      if (row.measurement !== undefined) return;
      const exerciseId = row.exerciseId;
      if (typeof exerciseId !== 'string') {
        row.measurement = FALLBACK_MEASUREMENT;
        return;
      }
      const id = exerciseId as ExerciseId;
      row.measurement =
        getCatalogExercise(id)?.measurement ?? stored.get(id) ?? FALLBACK_MEASUREMENT;
    });
}
