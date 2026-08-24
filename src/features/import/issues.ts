/**
 * Putting a semantic issue on the field that caused it (§11.1 "Semantic").
 *
 * `validateRoutineFile` hands back machine-readable paths precisely so the
 * wizard does not have to parse prose to know what to mark. This module turns
 * those paths into a lookup, into DOM ids the action bar can focus, and into
 * the one sentence a field shows — which, per DESIGN.md, names the problem and
 * the recovery, never just the problem.
 */

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

/**
 * Whether anything under `prefix` is flagged — how a Workout tab and a
 * collapsed exercise row know to mark themselves.
 *
 * The boundary check matters: `routine.workouts[1]` must not match
 * `routine.workouts[10]`.
 */
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
  rir_out_of_range: `Set both ends of the range between ${MIN_RIR} and ${MAX_RIR}.`,
  rest_seconds_negative: 'Enter 0 seconds or more.',
  sets_not_positive: 'Enter at least 1 set.',
  progression_unrecognized:
    'Switch it to manual progression, or remove the exercise from this Workout.',
  suggested_day_shared: 'Give one of the two Workouts another day.',
  routine_has_no_workouts: 'Choose a file that declares at least one Workout.',
};

/**
 * What a flagged field says under itself: the problem in this file's own
 * numbers, then what to do about it.
 */
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
      return `Min reps (${exercise.reps.min}) is above max reps (${exercise.reps.max}).`;
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
      return issue.message;
  }
}
