/**
 * The figures §11.10 puts at the top of an exercise's history screen.
 *
 * Derived on demand from the session history, never stored — the same rule the
 * progression engine follows (§11.9). There is no `currentWorkingWeight` field
 * anywhere in the schema and there must not be one: it would be a second
 * account of what the sets already say, free to disagree with them.
 *
 * Every comparison here reads `weightKg`, because that is the only value that
 * means the same thing across units (§11.7). A 100 lb set is lighter than a
 * 50 kg one, and the bigger number is the wrong answer.
 */

import type { SessionHistory } from '@/domain/progression';
import type { CompletedSet, Timestamp } from '@/domain/types';

export interface ExerciseSummary {
  /** How many sessions actually hold sets for this exercise. */
  readonly sessions: number;
  /**
   * §11.10's "current working weight": the heaviest set of the most recent
   * `completed` session. Partial sessions are visible in history but do not
   * define what a lifter is currently working with (§11.9).
   */
  readonly workingWeight: CompletedSet | null;
  /** The heaviest set ever, ties broken by reps — the more work at that load. */
  readonly bestSet: CompletedSet | null;
  readonly heaviest: CompletedSet | null;
  readonly lightest: CompletedSet | null;
  /** When the exercise was last actually performed. */
  readonly lastPerformed: Timestamp | null;
}

/** Every set of an exercise in one Session, in the order they were logged. */
function setsOf(entry: SessionHistory): readonly CompletedSet[] {
  return entry.exercises.flatMap((exercise) => exercise.sets);
}

/**
 * The heavier of two sets, or the one with more reps when the load is equal
 * (A-1). §11.10 shows a best set as `77.5 × 5` without saying how it is chosen;
 * load first is the only reading that makes the figure mean "the most you have
 * lifted".
 */
function better(a: CompletedSet, b: CompletedSet): CompletedSet {
  if (a.weightKg !== b.weightKg) return a.weightKg > b.weightKg ? a : b;
  return a.reps >= b.reps ? a : b;
}

const EMPTY: ExerciseSummary = {
  sessions: 0,
  workingWeight: null,
  bestSet: null,
  heaviest: null,
  lightest: null,
  lastPerformed: null,
};

/**
 * §11.10's figures for one exercise, from the history
 * `listExerciseHistory(exerciseId)` returns.
 *
 * Sessions holding no sets for the exercise are skipped throughout: an exercise
 * that was started and then skipped is part of the Session's story but not part
 * of this exercise's, and counting it would make "Sessions: 12" mean something
 * other than twelve times you did this movement.
 *
 * The input may arrive in any order; nothing here assumes it is sorted.
 */
export function summarizeExercise(history: readonly SessionHistory[]): ExerciseSummary {
  const performed = history.filter((entry) => setsOf(entry).length > 0);
  if (performed.length === 0) return EMPTY;

  const allSets = performed.flatMap(setsOf);

  const latestCompleted = performed
    .filter((entry) => entry.session.status === 'completed')
    .reduce<SessionHistory | null>(
      (latest, entry) =>
        latest === null || entry.session.startedAt > latest.session.startedAt ? entry : latest,
      null,
    );

  return {
    sessions: performed.length,
    workingWeight:
      latestCompleted === null ? null : setsOf(latestCompleted).reduce(better),
    bestSet: allSets.reduce(better),
    heaviest: allSets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a)),
    lightest: allSets.reduce((a, b) => (b.weightKg < a.weightKg ? b : a)),
    lastPerformed: performed.reduce(
      (latest, entry) => Math.max(latest, entry.session.startedAt),
      0,
    ),
  };
}
