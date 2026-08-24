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
  | 'suggested_day_shared'
  | 'routine_has_no_workouts'
  | 'routine_name_blank';

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

  // A routine with no Workouts describes no training, and accepting one is not
  // harmless: a draft always arrives `active`, so `importRoutine` archives the
  // lifter's real programme to make room for an empty shell. The structural
  // tier cannot catch it — `z.array()` carries no minimum — and every loop
  // below iterates zero times over it, so without this the file is clean.
  //
  // `paths` is empty because there is no field to point at: the issue is the
  // absence of one. The wizard already tolerates that — `indexIssues` skips it
  // and `jumpToIssue` returns early — so it blocks `Accept` and states why,
  // which is all it can usefully do.
  //
  // A *Workout* with no exercises stays valid on purpose. It runs end to end
  // (`createStartedWorkout`), and `deleteExercise` deliberately allows emptying
  // one so the wizard cannot trap a user who removed the last exercise.
  // A Routine authored in the wizard starts with no name at all, and a name is
  // what every list, Today and the wizard header render it by. Semantic rather
  // than structural on purpose: `.min(1)` on `routine.name` would reject the
  // blank draft the from-scratch flow opens on, which is the one thing that
  // must stay parseable (§11.1, and the file's own Structural/Semantic split).
  //
  // Unlike `routine_has_no_workouts` this one has a field to point at, so it
  // carries a path and the action bar can jump to it.
  const unnamed = file.routine.name.trim() === '';
  if (unnamed) {
    issues.push({
      code: 'routine_name_blank',
      paths: [['routine', 'name']],
      message: 'This routine has no name.',
    });
  }

  if (file.routine.workouts.length === 0) {
    issues.push({
      code: 'routine_has_no_workouts',
      paths: [],
      // Naming the routine is the whole point of the sentence, so a draft that
      // has no name yet says "This routine" rather than opening with a space.
      message: unnamed
        ? 'This routine declares no Workouts.'
        : `${file.routine.name} declares no Workouts.`,
    });
  }

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
