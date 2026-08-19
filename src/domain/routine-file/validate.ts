/**
 * Semantic validation (REQ-032, §11.1 "Semantic").
 *
 * A semantic issue never rejects the file: it loads, and the wizard marks the
 * field and blocks `Accept` until it is corrected. Every issue carries
 * machine-readable `paths` so the field can be found without parsing prose —
 * usually one, and one per Workout for a shared suggested day (AC-033).
 */

import type { FieldPath, RoutineFile } from '@/domain/routine-file/schema';

/** The checks of §11.1, as codes a UI can switch on. */
export type SemanticIssueCode =
  | 'reps_range_inverted'
  | 'rir_out_of_range'
  | 'rest_seconds_negative'
  | 'sets_not_positive'
  | 'progression_unrecognized'
  | 'suggested_day_shared';

/** One semantic problem, addressed to the field or fields that caused it. */
export interface SemanticIssue {
  readonly code: SemanticIssueCode;
  readonly paths: readonly FieldPath[];
  readonly message: string;
}

/**
 * The RIR bounds of the "fuera del rango permitido" check. The PRD does not
 * name a range; 0–10 is this change's recorded assumption (spec §13).
 */
export const MIN_RIR = 0;
export const MAX_RIR = 10;

/** The progression types the engine implements (§27 MVP). */
const KNOWN_PROGRESSION_TYPES = new Set(['manual', 'double_progression']);

/** Returns every semantic issue in `file`. An empty array means it is clean. */
export function validateRoutineFile(file: RoutineFile): readonly SemanticIssue[] {
  const issues: SemanticIssue[] = [];

  file.routine.workouts.forEach((workout, workoutIndex) => {
    workout.exercises.forEach((exercise, exerciseIndex) => {
      const at = (...tail: (string | number)[]): FieldPath => [
        'routine',
        'workouts',
        workoutIndex,
        'exercises',
        exerciseIndex,
        ...tail,
      ];
      const where = `${workout.name} → ${exercise.name}`;

      if (exercise.reps.min > exercise.reps.max) {
        issues.push({
          code: 'reps_range_inverted',
          paths: [at('reps')],
          message: `${where}: min_reps cannot be greater than max_reps.`,
        });
      }

      const rir = exercise.rir;
      if (rir && [rir.min, rir.max].some((value) => value < MIN_RIR || value > MAX_RIR)) {
        issues.push({
          code: 'rir_out_of_range',
          paths: [at('rir')],
          message: `${where}: RIR must be between ${MIN_RIR} and ${MAX_RIR}.`,
        });
      }

      if (exercise.rest_seconds !== undefined && exercise.rest_seconds < 0) {
        issues.push({
          code: 'rest_seconds_negative',
          paths: [at('rest_seconds')],
          message: `${where}: rest_seconds cannot be negative.`,
        });
      }

      if (exercise.sets <= 0) {
        issues.push({
          code: 'sets_not_positive',
          paths: [at('sets')],
          message: `${where}: sets must be greater than zero.`,
        });
      }

      if (!KNOWN_PROGRESSION_TYPES.has(exercise.progression.type)) {
        issues.push({
          code: 'progression_unrecognized',
          paths: [at('progression', 'type')],
          message: `${where}: unrecognized progression type "${exercise.progression.type}".`,
        });
      }
    });
  });

  issues.push(...sharedSuggestedDays(file));
  return issues;
}

/** One issue per weekday claimed by more than one Workout (§12, AC-033). */
function sharedSuggestedDays(file: RoutineFile): SemanticIssue[] {
  const claims = new Map<string, { path: FieldPath; workout: string }[]>();

  file.routine.workouts.forEach((workout, workoutIndex) => {
    workout.suggested_days.forEach((day, dayIndex) => {
      const claim = {
        path: ['routine', 'workouts', workoutIndex, 'suggested_days', dayIndex],
        workout: workout.name,
      };
      const existing = claims.get(day);
      if (existing) existing.push(claim);
      else claims.set(day, [claim]);
    });
  });

  return [...claims]
    .filter(([, claimants]) => claimants.length > 1)
    .map(([day, claimants]) => ({
      code: 'suggested_day_shared' as const,
      paths: claimants.map((claimant) => claimant.path),
      message: `${claimants.map((claimant) => claimant.workout).join(' and ')} both suggest ${day}.`,
    }));
}
