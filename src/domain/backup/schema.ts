/**
 * Validating a backup document (§18 "Validate").
 *
 * `parseBackup` is a pure function over a string: no database, no clock, no
 * I/O. It either returns a document that is safe to write or the reasons it is
 * not. Never both, and never a partial document — §18 is explicit that the
 * backup must be validated *before* the local database is modified, and
 * restore replaces the only copy a lifter has.
 *
 * The severity here is deliberately higher than the routine file's. That
 * pipeline splits structural from semantic so a flawed file can still be
 * *repaired in the wizard* (§11.1). A backup has no wizard and no author to
 * consult: it is either a faithful record or it is not, so everything below
 * rejects. Nothing is coerced, defaulted, or dropped.
 *
 * Three passes, in order, and the order is the design:
 *
 *   1. JSON        — is it a file at all?
 *   2. Version     — §18: newer than this build is refused outright, because
 *                    ignoring fields we do not understand would silently
 *                    discard a lifter's data.
 *   3. Shape       — every row against its domain type.
 *   4. References  — every id points at something that exists.
 *
 * Passes 3 and 4 do not both run. A row whose shape is wrong cannot be
 * meaningfully asked about its references, and reporting both would bury the
 * real fault under consequences of it.
 *
 * `toId` "does not validate — the caller asserts provenance" (`domain/ids.ts`).
 * This module is the caller that cannot assert it, which is why every id-shaped
 * field is checked here rather than trusted.
 */

import { z } from 'zod';
import { getCatalogExercise } from '@/domain/catalog';
import { isLocalDate, type LocalDate } from '@/domain/dates';
import { BACKUP_VERSION, type BackupDocument } from '@/domain/backup/document';
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

// ---------------------------------------------------------------- row shapes

/**
 * An id as it appears in a file: a non-empty string, tagged with the entity it
 * identifies.
 *
 * Not `uuid()`. Catalog ids are kebab-case slugs and share the `exercises` key
 * space with generated UUIDs by design (DEC-007), so a UUID check would refuse
 * every catalog reference. Identity is proven by resolution in pass 4, which is
 * the check that actually matters.
 *
 * The `toId` transform is what lets this module's output be typed as
 * `BackupDocument` outright instead of cast into it. Branding each field where
 * it is validated means the compiler checks the schema against the domain: a
 * field this file forgets, or types differently from `src/domain/types.ts`, is
 * a build error rather than something a cast would wave through.
 */
function idOf<T extends Id<string>>(): z.ZodType<T, string> {
  return z
    .string()
    .min(1)
    .transform((value) => toId<T>(value));
}

const unit = z.enum(['kg', 'lb']);

/**
 * The numeric vocabulary of a backup (§18).
 *
 * A backup is evidence of what happened, and a count of repetitions below zero
 * is not evidence of anything — restored, it becomes a negative estimated 1RM
 * on a chart, which is worse than a refusal because it looks like training.
 *
 * The bound is always what the app can *write*, never what the routine-file
 * validator demands of a file. `Field` clamps set logging at zero and caps
 * nothing above it (`SetLogger.tsx`), so `RIR 12` is a real thing a lifter can
 * log; borrowing `MAX_RIR` from `routine-file/validate.ts` — which governs a
 * *planned* RIR, and is a recorded assumption rather than a PRD rule — would
 * refuse a genuine backup. **Nothing here has an upper bound**, and the failure
 * that matters is not a bad file getting in, it is a lifter's only copy of their
 * training being turned away.
 *
 * `positiveCount` is used only where zero is impossible in the data the app
 * writes; everything unproven takes the wider bound.
 */
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

/**
 * The progression union (§27, §28, §29).
 *
 * Closed on purpose: an unrecognized `type` is refused rather than kept as
 * data. The routine file tolerates one because the wizard can correct it; a
 * backup has no such step, and a progression the engine cannot read is history
 * the app cannot use.
 */
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

const plannedExercise = z.object({
  id: idOf<PlannedExerciseId>(),
  workoutId: idOf<WorkoutId>(),
  exerciseId: idOf<ExerciseId>(),
  sets: count,
  minReps: count,
  maxReps: count,
  minRir: measure.nullable(),
  maxRir: measure.nullable(),
  restSeconds: measure.nullable(),
  unit,
  focus: z.string().nullable(),
  notes: z.array(z.string()),
  order: count,
  progression,
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
});

const session = z.object({
  id: idOf<SessionId>(),
  routineId: idOf<RoutineId>(),
  workoutId: idOf<WorkoutId>(),
  startedAt: timestamp,
  completedAt: timestamp.nullable(),
  status: z.enum(['in_progress', 'completed', 'partial']),
});

const exerciseSessionBase = {
  id: idOf<ExerciseSessionId>(),
  sessionId: idOf<SessionId>(),
  exerciseId: idOf<ExerciseId>(),
  order: count,
  status: z.enum(['pending', 'performed', 'skipped']),
};

/**
 * The ExerciseSession union, discriminated on `plannedExerciseId` (§14.7).
 *
 * A union rather than one shape with optional targets, mirroring
 * `domain/types.ts`. "Unplanned but carrying planned targets" is not
 * representable in the domain and must not become representable by arriving in
 * a file: the unplanned member forbids the `planned*` keys outright, so a
 * hand-edited document cannot smuggle a contradiction into history.
 */
const exerciseSession = z.union([
  z.object({
    ...exerciseSessionBase,
    plannedExerciseId: idOf<PlannedExerciseId>(),
    plannedUnit: unit,
    plannedSets: count,
    plannedMinReps: count,
    plannedMaxReps: count,
    plannedMinRir: measure.nullable(),
    plannedMaxRir: measure.nullable(),
    plannedRestSeconds: measure.nullable(),
    plannedProgression: progression,
  }),
  // `looseObject`, not `object`: a plain object strips unknown keys *before*
  // checks run, so the contradiction would be quietly deleted instead of
  // refused — the precise silent data loss §18 exists to prevent. Keeping the
  // extra keys lets the check see them; the transform then drops the ones that
  // are merely additive, so forward compatibility is unaffected.
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
  reps: count,
  rir: measure,
  completedAt: timestamp,
});

/**
 * The settings row (§32).
 *
 * Everything after `defaultUnit` is optional, and that is a compatibility rule
 * rather than a shape preference: a backup taken before those settings existed
 * carries the unit alone, and a lifter's only copy of their training must not
 * be refused because the app grew a beep since they exported it. Restore
 * ignores this object entirely (§18) — it is validated so the document is
 * whole, not because anything is written from it.
 */
const settings = z.object({
  id: z.literal('settings'),
  defaultUnit: unit,
  defaultRir: measure.nullable().optional(),
  timerVibration: z.boolean().optional(),
  timerSound: z.boolean().optional(),
  keepScreenAwake: z.boolean().optional(),
  lastBackupAt: timestamp.nullable().optional(),
});

/**
 * The document (§17). `version` is validated in pass 2; here it only has to be
 * a number, so that a newer document reaches the version check rather than
 * dying as a shape error and reporting the wrong reason.
 */
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

// ------------------------------------------------------------------ passes

function toPath(segments: readonly PropertyKey[]): FieldPath {
  return segments.map((segment) => (typeof segment === 'symbol' ? String(segment) : segment));
}

/**
 * Flattens Zod issues into `{path, message}`, unwrapping unions.
 *
 * A failed `z.union` reports only "Invalid input" at the union's own path and
 * files the real reasons underneath, one set per member. R-4 requires a refusal
 * to name what is wrong and where, and "Invalid input" names neither — so the
 * members' own issues are lifted out and reported instead. That is what turns
 * a rejected ExerciseSession into "an unplanned exercise carries no planned
 * targets, but this one has plannedSets, plannedMinReps, …".
 *
 * Both members' complaints surface, because nothing here can know which one the
 * author meant. Saying too much beats saying "Invalid input" about a file
 * someone is trying to recover their training history from.
 */
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

/**
 * Pass 4 — every reference resolves inside the document.
 *
 * A backup written by `exportBackup` always passes this. A hand-edited or
 * truncated one may not, and the failure it prevents is the quiet kind: an
 * orphaned CompletedSet is not an error at write time, it is a set that
 * silently disappears from history and from every progression calculation
 * afterwards.
 *
 * Exercise references are the one case that looks outside the document, because
 * catalog Exercises legitimately live in the build rather than in `exercises`.
 * Catalog slugs are permanent (REQ-023: removing or renaming one is
 * prohibited), which is what makes that lookup safe across builds.
 */
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

  /** Resolvable if the catalog knows it (DEC-007) or the document carries it. */
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

/**
 * Parses and fully validates a backup document (§18).
 *
 * Pure: no file system, no database, no clock. A caller that receives
 * `{ok: true}` may write the document as-is; a caller that receives
 * `{ok: false}` must write nothing at all.
 */
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

  // §18: a newer document is refused before its shape is read, so the lifter is
  // told the real reason — this build is too old — rather than being handed a
  // list of fields it happens not to recognize.
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
