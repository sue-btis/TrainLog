import {
  MAX_RIR,
  MIN_RIR,
  formatPath,
  type FieldPath,
  type RoutineFileExercise,
  type SemanticIssue,
  type SemanticIssueCode,
} from '@/domain/routine-file';

/** Issues by the field they address, keyed by `formatPath`. */
export type IssueIndex = ReadonlyMap<string, readonly SemanticIssue[]>;

/** `routine.workouts[0].exercises[2].reps` — the key everything here uses. */
export function pathKey(path: FieldPath): string {
  return formatPath(path);
}

export function exercisePath(workout: number, exercise: number): string {
  return `routine.workouts[${workout}].exercises[${exercise}]`;
}

export function workoutPath(workout: number): string {
  return `routine.workouts[${workout}]`;
}

/** A DOM id for the control that owns a field, so an issue can be jumped to. */
export function fieldId(key: string): string {
  return `f-${key.replace(/[^a-z0-9]+/gi, '-')}`;
}

/** One issue can name several fields; one field can carry several issues. */
export function indexIssues(issues: readonly SemanticIssue[]): IssueIndex {
  const index = new Map<string, SemanticIssue[]>();
  for (const issue of issues) {
    for (const path of issue.paths) {
      const key = pathKey(path);
      const existing = index.get(key);
      if (existing) existing.push(issue);
      else index.set(key, [issue]);
    }
  }
  return index;
}

export function issuesAt(index: IssueIndex, key: string): readonly SemanticIssue[] {
  return index.get(key) ?? [];
}

export function hasIssuesUnder(index: IssueIndex, prefix: string): boolean {
  for (const key of index.keys()) {
    if (key === prefix || key.startsWith(`${prefix}.`) || key.startsWith(`${prefix}[`)) {
      return true;
    }
  }
  return false;
}

/** Which step of the wizard owns the correction for an issue. */
export function stepOfIssue(issue: SemanticIssue): 1 | 2 {
  return issue.code === 'suggested_day_shared' ? 2 : 1;
}

/** The recovery half of every message, by code. */
const FIX: Record<SemanticIssueCode, string> = {
  reps_range_inverted: 'Lower min reps, or raise max reps, so min is not above max.',
  target_range_inverted: 'Lower the minimum, or raise the maximum, so min is not above max.',
  target_pair_ambiguous:
    'Keep the rep range or the target range, whichever this movement is measured in, and remove the other.',
  target_pair_missing: 'Give the exercise a rep range, or a target range if it is not measured in reps.',
  target_axis_mismatch:
    'Enter the range in the field the movement is actually measured in; the other one clears itself.',
  rir_out_of_range: `Set both ends of the range between ${MIN_RIR} and ${MAX_RIR}.`,
  rest_seconds_negative: 'Enter 0 seconds or more.',
  sets_not_positive: 'Enter at least 1 set.',
  progression_unrecognized:
    'Switch it to manual progression, or remove the exercise from this Workout.',
  suggested_day_shared: 'Give one of the two Workouts another day.',
  routine_has_no_workouts: 'Add a Workout on step 1.',
  routine_name_blank: 'Give the routine a name.',
};

export function describeIssue(
  issue: SemanticIssue,
  exercise: RoutineFileExercise | undefined,
): string {
  return `${problemOf(issue, exercise)} ${FIX[issue.code]}`;
}

function problemOf(
  issue: SemanticIssue,
  exercise: RoutineFileExercise | undefined,
): string {
  if (exercise === undefined) return issue.message;

  switch (issue.code) {
    case 'reps_range_inverted':
      return exercise.reps === undefined
        ? issue.message
        : `Min reps (${exercise.reps.min}) is above max reps (${exercise.reps.max}).`;
    case 'target_range_inverted':
    case 'target_pair_ambiguous':
    case 'target_pair_missing':
    case 'target_axis_mismatch':
      return issue.message;
    case 'rir_out_of_range':
      return exercise.rir === undefined
        ? `RIR is outside ${MIN_RIR}–${MAX_RIR}.`
        : `RIR ${exercise.rir.min}–${exercise.rir.max} falls outside ${MIN_RIR}–${MAX_RIR}.`;
    case 'rest_seconds_negative':
      return `Rest is ${exercise.rest_seconds ?? 0} seconds.`;
    case 'sets_not_positive':
      return `Sets is ${exercise.sets}.`;
    case 'progression_unrecognized':
      return `"${exercise.progression.type}" is not a progression this app runs.`;
    case 'suggested_day_shared':
    case 'routine_has_no_workouts':
    case 'routine_name_blank':
      return issue.message;
  }
}
