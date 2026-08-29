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

export const DATABASE_NAME = 'trainlog';

/** Schema changes require a forward migration. Later versions only backfill fields. */
export const SCHEMA_VERSION = 3;

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

export const TABLE_NAMES = Object.keys(SCHEMA_V1) as readonly (keyof typeof SCHEMA_V1)[];

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

// Keep the fallback here to avoid a dependency cycle with the settings repository.
const FALLBACK_UNIT: Unit = 'kg';

async function backfillPlannedUnit(transaction: Transaction): Promise<void> {
  // Preserve the unit snapshotted when a Session began; only legacy rows missing it are backfilled.
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

// This is the only measurement provable from pre-measurement rows.
const FALLBACK_MEASUREMENT: Measurement = 'weight_reps';

async function backfillMeasurement(transaction: Transaction): Promise<void> {
  // Existing measurements are authoritative; derive only missing values and leave completed sets untouched.
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
