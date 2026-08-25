/**
 * Checking targets entered outside the wizard, with the wizard's own validator
 * (REQ-409, REQ-913).
 *
 * Adding a Planned Exercise to a Routine already accepted collects the same
 * numbers step 1 collects — sets, a rep range, an optional RIR range, rest, a
 * unit and a progression rule — so it must reject the same numbers. Writing a
 * second set of checks for it is how `min_reps > max_reps` ends up allowed on
 * one path and refused on the other.
 *
 * So there is no second validator. The entered targets are dressed as a
 * one-Workout `RoutineFile` and handed to `validateRoutineFile`, which is the
 * only thing in the codebase that decides what a semantic issue is (§11.1).
 *
 * Two properties of the synthetic file are load-bearing, and both are about
 * issues that must *not* fire. `routine.name` is non-blank, so
 * `routine_name_blank` cannot appear against a form that has no routine name to
 * offer. The single Workout declares no `suggested_days`, so
 * `suggested_day_shared` cannot appear either — the day-collision question
 * belongs to the add-Workout form, which answers it as a warning rather than a
 * refusal (DEC-Q1, REQ-405).
 */

import type { ProgressionRule, Unit } from '@/domain/types';
import type { RoutineFile } from '@/domain/routine-file/schema';

/**
 * The targets an add-Planned-Exercise form holds, before an Exercise is bound
 * to them.
 *
 * `focus` and `notes` are absent on purpose: REQ-407 says an added row carries
 * `null` and `[]` and that neither is collected, so a field that does not exist
 * on the form does not exist here either.
 */
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

/**
 * The two refusals `validateRoutineFile` has no code for.
 *
 * Its code union is closed (§11.1), so a rule it cannot state has to live
 * beside the bridge rather than inside the form. Both of these are shapes the
 * wizard's path cannot produce and this form can.
 *
 * A RIR range is one node in the file schema, so an imported row has both ends
 * or neither. Two independent optional fields make half a range in one
 * keystroke, and half a range is worse than none: the `rir` node is left out
 * entirely, so `rir_out_of_range` never gets to look at the end that *was*
 * typed, and `programmingLine` declines to show it — the lifter's number is
 * stored, invisible, and out of reach, since REQ-415 gives this flow no verb to
 * edit a stored row. An end below zero then rides that omission into a backup
 * `parseBackup` refuses to restore, which is the whole file, not the row.
 *
 * An increment that does not increase is a minus key away, against a caption
 * promising the next suggestion is heavier — and `backup/schema.ts` reads an
 * increment as non-negative, so it fails the same restore.
 */
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
