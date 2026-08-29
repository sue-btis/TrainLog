
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { MEASUREMENTS } from '@/domain/measurement';
import type { Weekday } from '@/domain/types';

const weekdaySchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

const rangeSchema = z.object({ min: z.number(), max: z.number() });

const progressionSchema = z
  .object({ type: z.string(), increment: z.number().optional() })
  .check((ctx) => {
    if (ctx.value.type === 'double_progression' && ctx.value.increment === undefined) {
      ctx.issues.push({
        code: 'custom',
        message: 'double_progression requires an increment',
        path: ['increment'],
        input: ctx.value,
      });
    }
  });

const exerciseSchema = z.object({
  name: z.string(),
  exercise_id: z.string().optional(),
  category: z.string().optional(),
  unit: z.enum(['kg', 'lb']).optional(),
  measurement: z.enum(MEASUREMENTS).optional(),
  sets: z.number(),
  reps: rangeSchema.optional(),
  target: rangeSchema.optional(),
  rir: rangeSchema.optional(),
  rest_seconds: z.number().optional(),
  focus: z.string().optional(),
  notes: z.array(z.string()).default([]),
  progression: progressionSchema,
});

const workoutSchema = z.object({
  name: z.string(),
  suggested_days: z.array(weekdaySchema).default([]),
  exercises: z.array(exerciseSchema),
});

const routineFileSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  routine: z.object({
    name: z.string(),
    weeks: z.number(),
    workouts: z.array(workoutSchema),
  }),
});

export type RoutineFile = z.infer<typeof routineFileSchema>;
export type RoutineFileRoutine = RoutineFile['routine'];
export type RoutineFileWorkout = z.infer<typeof workoutSchema>;
export type RoutineFileExercise = z.infer<typeof exerciseSchema>;
export type RoutineFileProgression = z.infer<typeof progressionSchema>;

/**
 * A weekday as the file names it. Agreement with the domain's `Weekday` is
 * enforced by the mapping in `to-domain.ts`, which assigns one to the other.
 */
export type RoutineFileWeekday = Weekday;

export type PathSegment = string | number;

/**
 * A path to a field in the routine file, rooted at the document:
 * `['routine', 'workouts', 0, 'exercises', 2, 'reps']`. Both structural errors
 * and semantic issues carry one, so a wizard can mark the offending field.
 */
export type FieldPath = readonly PathSegment[];

export function formatPath(path: FieldPath): string {
  return path
    .map((segment, index) =>
      typeof segment === 'number'
        ? `[${segment}]`
        : index === 0
          ? segment
          : `.${segment}`,
    )
    .join('');
}

/** A failure that rejects the file. `path` is empty for a YAML syntax error. */
export interface StructuralError {
  readonly path: FieldPath;
  readonly message: string;
}

/** Either a typed routine file, or the reasons it was rejected. Never both. */
export type ParseRoutineFileResult =
  | { readonly ok: true; readonly file: RoutineFile }
  | { readonly ok: false; readonly errors: readonly StructuralError[] };

export function parseRoutineFile(text: string): ParseRoutineFileResult {
  let document: unknown;
  try {
    document = parseYaml(text);
  } catch (error) {
    return {
      ok: false,
      errors: [{ path: [], message: error instanceof Error ? error.message : String(error) }],
    };
  }

  const result = routineFileSchema.safeParse(document);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.map((segment) =>
          typeof segment === 'symbol' ? String(segment) : segment,
        ),
        message: issue.message,
      })),
    };
  }
  return { ok: true, file: result.data };
}
