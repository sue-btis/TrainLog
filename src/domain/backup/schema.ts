
import { z } from 'zod';
import { getCatalogExercise } from '@/domain/catalog';
import { isLocalDate, type LocalDate } from '@/domain/dates';
import { BACKUP_VERSION, type BackupDocument } from '@/domain/backup/document';
import { MEASUREMENTS } from '@/domain/measurement';
import { toId } from '@/domain/ids';
import type {
  CompletedSetId,
  ExerciseId,
  ExerciseSessionId,
  Id,
  PlacementId,
  PlannedExerciseId,
  RoutineId,
  SessionId,
  WorkoutId,
} from '@/domain/ids';
import type { FieldPath, StructuralError } from '@/domain/routine-file';

export type { FieldPath, StructuralError } from '@/domain/routine-file';

/** Either a document safe to restore, or the reasons it is not. Never both. */
export type ParseBackupResult =
  | { readonly ok: true; readonly document: BackupDocument }
  | { readonly ok: false; readonly errors: readonly StructuralError[] };

function idOf<T extends Id<string>>(): z.ZodType<T, string> {
  return z
    .string()
    .min(1)
    .transform((value) => toId<T>(value));
}

const unit = z.enum(['kg', 'lb']);
const distanceUnit = z.enum(['m', 'km', 'mi']);

const measurement = z.enum(MEASUREMENTS);

const count = z.number().int().min(0);
const positiveCount = z.number().int().min(1);
const measure = z.number().min(0);

const timestamp = z.number().int().min(0);

/** `YYYY-MM-DD` naming a real day — `2026-02-31` parses as a string and is not one. */
const localDate = z.custom<LocalDate>(
  (value) => typeof value === 'string' && isLocalDate(value),
  'Not a YYYY-MM-DD calendar day',
);

const weekday = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

const progression = z.discriminatedUnion('type', [
  z.object({ type: z.literal('manual') }),
  z.object({ type: z.literal('double_progression'), increment: measure }),
]);

const routine = z.object({
  id: idOf<RoutineId>(),
  name: z.string(),
  weeks: count,
  status: z.enum(['active', 'archived']),
  createdAt: timestamp,
});

const workout = z.object({
  id: idOf<WorkoutId>(),
  routineId: idOf<RoutineId>(),
  name: z.string(),
  suggestedDays: z.array(weekday),
  order: count,
});

function oneTargetPairIssue(
  value: Readonly<Record<string, unknown>>,
  repsKeys: readonly [string, string],
  targetKeys: readonly [string, string],
): { readonly message: string; readonly path: readonly [string] } | null {
  const stated = (keys: readonly [string, string]): boolean =>
    keys.every((key) => value[key] !== null && value[key] !== undefined);

  const onReps = stated(repsKeys);
  const onTarget = stated(targetKeys);
  if (onReps !== onTarget) return null;

  return onReps
    ? {
        message: `A planned exercise states ${repsKeys[0]}/${repsKeys[1]} or ${targetKeys[0]}/${targetKeys[1]}, never both.`,
        path: [targetKeys[0]],
      }
    : {
        message: `A planned exercise needs a range in ${repsKeys[0]}/${repsKeys[1]} or in ${targetKeys[0]}/${targetKeys[1]}.`,
        path: [repsKeys[0]],
      };
}

const plannedExercise = z.object({
  id: idOf<PlannedExerciseId>(),
  workoutId: idOf<WorkoutId>(),
  exerciseId: idOf<ExerciseId>(),
  sets: count,
  minReps: count.nullable().default(null),
  maxReps: count.nullable().default(null),
  minTarget: measure.nullable().default(null),
  maxTarget: measure.nullable().default(null),
  minRir: measure.nullable(),
  maxRir: measure.nullable(),
  restSeconds: measure.nullable(),
  unit,
  focus: z.string().nullable(),
  notes: z.array(z.string()),
  order: count,
  progression,
}).check((ctx) => {
  const issue = oneTargetPairIssue(ctx.value, ['minReps', 'maxReps'], ['minTarget', 'maxTarget']);
  if (issue) {
    ctx.issues.push({
      code: 'custom',
      message: issue.message,
      path: [...issue.path],
      input: ctx.value,
    });
  }
});

const placement = z.object({
  id: idOf<PlacementId>(),
  routineId: idOf<RoutineId>(),
  workoutId: idOf<WorkoutId>(),
  date: localDate,
});

const exercise = z.object({
  id: idOf<ExerciseId>(),
  name: z.string(),
  category: z.string().nullable(),
  equipment: z.string().nullable(),
  measurement: measurement.default('weight_reps'),
});

const session = z.object({
  id: idOf<SessionId>(),
  routineId: idOf<RoutineId>(),
  workoutId: idOf<WorkoutId>(),
  startedAt: timestamp,
  completedAt: timestamp.nullable(),
  status: z.enum(['in_progress', 'completed', 'partial']),
  // Older rows have no weigh-in here, and migrations must not invent one.
  bodyweightKg: measure.nullable().default(null),
});

const exerciseSessionBase = {
  id: idOf<ExerciseSessionId>(),
  sessionId: idOf<SessionId>(),
  exerciseId: idOf<ExerciseId>(),
  order: count,
  status: z.enum(['pending', 'performed', 'skipped']),
  measurement: measurement.default('weight_reps'),
};

const exerciseSession = z.union([
  z.object({
    ...exerciseSessionBase,
    plannedExerciseId: idOf<PlannedExerciseId>(),
    plannedUnit: unit,
    plannedSets: count,
    plannedMinReps: count.nullable().default(null),
    plannedMaxReps: count.nullable().default(null),
    plannedMinTarget: measure.nullable().default(null),
    plannedMaxTarget: measure.nullable().default(null),
    plannedMinRir: measure.nullable(),
    plannedMaxRir: measure.nullable(),
    plannedRestSeconds: measure.nullable(),
    plannedProgression: progression,
  }).check((ctx) => {
    const issue = oneTargetPairIssue(
      ctx.value,
      ['plannedMinReps', 'plannedMaxReps'],
      ['plannedMinTarget', 'plannedMaxTarget'],
    );
    if (issue) {
      ctx.issues.push({
        code: 'custom',
        message: issue.message,
        path: [...issue.path],
        input: ctx.value,
      });
    }
  }),
  // `looseObject`, not `object`: a plain object strips unknown keys before
  // checks, so a planned field on an unplanned row would disappear before the
  // contradiction is reported. The transform still drops additive fields.
  z
    .looseObject({ ...exerciseSessionBase, plannedExerciseId: z.null() })
    .check((ctx) => {
      const targets = Object.keys(ctx.value).filter(
        (key) => key.startsWith('planned') && key !== 'plannedExerciseId',
      );
      if (targets.length > 0) {
        ctx.issues.push({
          code: 'custom',
          message:
            'An unplanned exercise carries no planned targets, but this one has ' +
            targets.join(', '),
          path: [],
          input: ctx.value,
        });
      }
    })
    .transform((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      exerciseId: row.exerciseId,
      order: row.order,
      status: row.status,
      measurement: row.measurement,
      plannedExerciseId: row.plannedExerciseId,
    })),
]);

const completedSet = z.object({
  id: idOf<CompletedSetId>(),
  exerciseSessionId: idOf<ExerciseSessionId>(),
  setNumber: positiveCount,
  weight: measure,
  unit,
  weightKg: measure,
  reps: count.nullable(),
  rir: measure,
  // Nullable and defaulted: older documents carry none of these axes and
  durationSeconds: measure.nullable().default(null),
  distance: measure.nullable().default(null),
  distanceUnit: distanceUnit.nullable().default(null),
  distanceM: measure.nullable().default(null),
  completedAt: timestamp,
});

const settings = z.object({
  id: z.literal('settings'),
  defaultUnit: unit,
  defaultRir: measure.nullable().optional(),
  timerVibration: z.boolean().optional(),
  timerSound: z.boolean().optional(),
  keepScreenAwake: z.boolean().optional(),
  // This setting stays device-local; the figure that survives a restore is
  // `Session.bodyweightKg`, which is what `lastRecordedBodyweightKg()` reads.
  // Keep exporting the setting for a complete device backup, but do not make
  // restore write it.
  bodyweightKg: measure.nullable().optional(),
  lastBackupAt: timestamp.nullable().optional(),
});

const backupDocument = z.object({
  version: count,
  exportedAt: timestamp,
  routines: z.array(routine),
  workouts: z.array(workout),
  plannedExercises: z.array(plannedExercise),
  placements: z.array(placement),
  exercises: z.array(exercise),
  sessions: z.array(session),
  exerciseSessions: z.array(exerciseSession),
  completedSets: z.array(completedSet),
  settings,
});

function toPath(segments: readonly PropertyKey[]): FieldPath {
  return segments.map((segment) => (typeof segment === 'symbol' ? String(segment) : segment));
}

function toStructuralErrors(error: z.ZodError): StructuralError[] {
  const flatten = (issues: readonly z.core.$ZodIssue[], prefix: FieldPath): StructuralError[] =>
    issues.flatMap((issue) => {
      const path = [...prefix, ...toPath(issue.path)];
      if (issue.code === 'invalid_union') {
        const members = issue.errors.flatMap((member) => flatten(member, path));
        // A discriminated union whose discriminator matched nothing reports no
        // member errors at all. Keeping its own issue is what stops a refusal
        // from arriving with an empty reason list — silent refusal is as bad
        // as silent acceptance for someone recovering a backup.
        return members.length > 0 ? members : [{ path, message: issue.message }];
      }
      return [{ path, message: issue.message }];
    });

  return flatten(error.issues, []);
}

/** A row that carries an id, for the duplicate and reference passes. */
interface Identified {
  readonly id: string;
}

function idsOf(rows: readonly Identified[]): Set<string> {
  return new Set(rows.map((row) => row.id));
}

function checkReferences(document: BackupDocument): StructuralError[] {
  const errors: StructuralError[] = [];

  const reference = (
    table: string,
    index: number,
    field: string,
    value: string,
    known: ReadonlySet<string>,
    target: string,
  ): void => {
    if (!known.has(value)) {
      errors.push({
        path: [table, index, field],
        message: `No ${target} in this backup has the id ${value}`,
      });
    }
  };

  // Duplicates first: a repeated id makes every later lookup ambiguous, and
  // `bulkAdd` would reject it at restore time anyway — better here, named.
  const tables: readonly (readonly [string, readonly Identified[]])[] = [
    ['routines', document.routines],
    ['workouts', document.workouts],
    ['plannedExercises', document.plannedExercises],
    ['placements', document.placements],
    ['exercises', document.exercises],
    ['sessions', document.sessions],
    ['exerciseSessions', document.exerciseSessions],
    ['completedSets', document.completedSets],
  ];

  for (const [table, rows] of tables) {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      if (seen.has(row.id)) {
        errors.push({
          path: [table, index, 'id'],
          message: `Duplicate id ${row.id} in ${table}`,
        });
      }
      seen.add(row.id);
    });
  }
  if (errors.length > 0) return errors;

  const routines = idsOf(document.routines);
  const workouts = idsOf(document.workouts);
  const plannedExercises = idsOf(document.plannedExercises);
  const sessions = idsOf(document.sessions);
  const exerciseSessions = idsOf(document.exerciseSessions);
  const exercises = idsOf(document.exercises);

  const knownExercise = (value: string): boolean =>
    getCatalogExercise(value as ExerciseId) !== undefined || exercises.has(value);

  const exerciseReference = (table: string, index: number, value: string): void => {
    if (!knownExercise(value)) {
      errors.push({
        path: [table, index, 'exerciseId'],
        message: `No catalog or backup Exercise has the id ${value}`,
      });
    }
  };

  document.workouts.forEach((row, index) =>
    reference('workouts', index, 'routineId', row.routineId, routines, 'Routine'),
  );

  document.plannedExercises.forEach((row, index) => {
    reference('plannedExercises', index, 'workoutId', row.workoutId, workouts, 'Workout');
    exerciseReference('plannedExercises', index, row.exerciseId);
  });

  document.placements.forEach((row, index) => {
    reference('placements', index, 'routineId', row.routineId, routines, 'Routine');
    reference('placements', index, 'workoutId', row.workoutId, workouts, 'Workout');
  });

  document.sessions.forEach((row, index) => {
    reference('sessions', index, 'routineId', row.routineId, routines, 'Routine');
    reference('sessions', index, 'workoutId', row.workoutId, workouts, 'Workout');
  });

  document.exerciseSessions.forEach((row, index) => {
    reference('exerciseSessions', index, 'sessionId', row.sessionId, sessions, 'Session');
    exerciseReference('exerciseSessions', index, row.exerciseId);
    if (row.plannedExerciseId !== null) {
      reference(
        'exerciseSessions',
        index,
        'plannedExerciseId',
        row.plannedExerciseId,
        plannedExercises,
        'Planned Exercise',
      );
    }
  });

  document.completedSets.forEach((row, index) =>
    reference(
      'completedSets',
      index,
      'exerciseSessionId',
      row.exerciseSessionId,
      exerciseSessions,
      'Exercise Session',
    ),
  );

  return errors;
}

export function parseBackup(text: string): ParseBackupResult {
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch (error) {
    return {
      ok: false,
      errors: [{ path: [], message: error instanceof Error ? error.message : String(error) }],
    };
  }

  // Reject newer files before schema parsing so an old build reports the real
  // reason — version incompatibility — instead of misleading unknown fields.
  const version: unknown = (json as { version?: unknown })?.version;
  if (typeof version === 'number' && version > BACKUP_VERSION) {
    return {
      ok: false,
      errors: [
        {
          path: ['version'],
          message:
            `This backup is version ${version}, and this app reads version ` +
            `${BACKUP_VERSION}. Update the app before restoring it.`,
        },
      ],
    };
  }

  const result = backupDocument.safeParse(json);
  if (!result.success) return { ok: false, errors: toStructuralErrors(result.error) };

  // No cast: every id field is branded by `idOf`, so the schema's output type
  // *is* `BackupDocument`. If the two ever diverge this line stops compiling,
  // which is the point of branding at the field rather than at the document.
  const document: BackupDocument = result.data;
  const errors = checkReferences(document);
  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, document };
}

/** A `FieldPath` as a readable location, for the screen. Re-exported from the routine file. */
export { formatPath } from '@/domain/routine-file';
export type { FieldPath as BackupFieldPath };
