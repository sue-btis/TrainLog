
import type { ProgressionRule, Unit } from '@/domain/types';
import type { RoutineFile } from '@/domain/routine-file/schema';

export interface PlannedExerciseDraft {
  /** The chosen Exercise's name, so an issue can say which row it is about. */
  readonly name: string;
  readonly sets: number;
  readonly minReps: number;
  readonly maxReps: number;
  readonly minRir: number | null;
  readonly maxRir: number | null;
  readonly restSeconds: number | null;
  readonly unit: Unit;
  readonly progression: ProgressionRule;
}

/**
 * The name the synthetic Routine carries.
 *
 * It exists only to be non-blank. No lifter sees it: the file is built, passed
 * to `validateRoutineFile`, read for its issues and dropped, all inside one
 * form submission, and nothing writes it anywhere.
 */
const SYNTHETIC_ROUTINE_NAME = 'Draft';

/**
 * The entered targets as a `RoutineFile` `validateRoutineFile` can read.
 *
 * `weeks: 1` because the file is never scheduled and nothing reads it — the
 * validator does not check `weeks`, and a value that means nothing is better
 * stated as the smallest legal one than as a number that looks meaningful.
 *
 * Returned `paths` are rooted at this file, so a caller maps an issue onto its
 * own field by the path's trailing segment — `sets`, `reps`, `rir`,
 * `rest_seconds` — rather than by the indices in between, which describe a
 * Workout structure the form does not have.
 */
export function plannedExerciseDraftFile(
  targets: PlannedExerciseDraft,
  workoutName: string,
): RoutineFile {
  return {
    version: 1,
    routine: {
      name: SYNTHETIC_ROUTINE_NAME,
      weeks: 1,
      workouts: [
        {
          name: workoutName,
          suggested_days: [],
          exercises: [
            {
              name: targets.name,
              sets: targets.sets,
              reps: { min: targets.minReps, max: targets.maxReps },
              ...(targets.minRir === null || targets.maxRir === null
                ? {}
                : { rir: { min: targets.minRir, max: targets.maxRir } }),
              ...(targets.restSeconds === null ? {} : { rest_seconds: targets.restSeconds }),
              unit: targets.unit,
              notes: [],
              progression:
                targets.progression.type === 'double_progression'
                  ? { type: 'double_progression', increment: targets.progression.increment }
                  : { type: 'manual' },
            },
          ],
        },
      ],
    },
  };
}

export function plannedExerciseDraftRefusals(targets: PlannedExerciseDraft): {
  readonly rir: string | null;
  readonly increment: string | null;
} {
  return {
    rir:
      (targets.minRir === null) === (targets.maxRir === null)
        ? null
        : 'A RIR range needs both ends. Fill the other one, or clear this one.',
    increment:
      targets.progression.type === 'double_progression' && targets.progression.increment <= 0
        ? 'An increment must be greater than zero. Leave it blank for manual.'
        : null,
  };
}
