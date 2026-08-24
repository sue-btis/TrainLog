/**
 * Progression engine (REQ-060…066, §11.9, §27, §28, §29).
 *
 * A pure function over history and a rule. Nothing is stored: there is no
 * `currentWorkingWeight` row, no suggestion table and no end-of-session state to
 * update (§11.9 "Derived, never stored", AC-062).
 *
 * Three invariants shape everything below:
 *
 *   Scope      history is matched by `exerciseId`, never by `plannedExerciseId`
 *              (REQ-061, ADR 0002) — a re-import creates new PlannedExercises,
 *              and progression must survive it (§26).
 *   Filter     only `completed` Sessions feed the engine; `partial` and
 *              `in_progress` stay visible in history and are ignored (REQ-062).
 *   Extension  the rule is a discriminated union (DEC-006); a future strategy
 *              from §27 is a new member plus a new branch in `suggestLoad`.
 */

import type { ExerciseId } from '@/domain/ids';
import type {
  CompletedSet,
  ExerciseSession,
  PlannedExercise,
  ProgressionRule,
  Session,
} from '@/domain/types';
import { toKg, type Unit } from '@/domain/units';

/** One exercise as performed, with the sets it produced. */
export interface ExerciseSessionHistory {
  readonly exerciseSession: ExerciseSession;
  readonly sets: readonly CompletedSet[];
}

/**
 * One Session with its exercises and their sets — the exact shape the
 * repositories must assemble (WS-7). Deliberately minimal: the engine needs the
 * Session only for `status` and `startedAt`, and the ExerciseSession only for
 * `exerciseId`.
 *
 * The list may contain Sessions of any status and in any order; filtering and
 * ordering happen here, not at the call site.
 */
export interface SessionHistory {
  readonly session: Session;
  readonly exercises: readonly ExerciseSessionHistory[];
}

/**
 * A suggested next load (§11.9). `weight` is in the exercise's own unit —
 * the unit its history was logged in — and `weightKg` is the same load as the
 * kilogram value every comparison and chart reads (REQ-066).
 *
 * `targetMet` says whether the rule's condition fired: `true` means `weight`
 * is an advance on the previous session, `false` means it repeats it.
 */
export interface LoadSuggestion {
  readonly weight: number;
  readonly unit: Unit;
  readonly weightKg: number;
  readonly targetMet: boolean;
}

/** What the engine needs about the exercise a suggestion is being made for. */
interface ProgressionTarget {
  readonly exerciseId: ExerciseId;
  /** N in §29 — the planned set count. */
  readonly plannedSets: number;
  /** The upper end of the planned rep range — the rep target of §29. */
  readonly maxReps: number;
  readonly rule: ProgressionRule;
}

/**
 * Reads the target off either a PlannedExercise (about to be started) or an
 * ExerciseSession snapshot (already started). An unplanned exercise has no rule
 * and no targets, so it yields `null` and therefore no suggestion (REQ-065).
 */
function targetOf(exercise: PlannedExercise | ExerciseSession): ProgressionTarget | null {
  if (!('plannedExerciseId' in exercise)) {
    return {
      exerciseId: exercise.exerciseId,
      plannedSets: exercise.sets,
      maxReps: exercise.maxReps,
      rule: exercise.progression,
    };
  }
  if (exercise.plannedExerciseId === null) return null;
  return {
    exerciseId: exercise.exerciseId,
    plannedSets: exercise.plannedSets,
    maxReps: exercise.plannedMaxReps,
    rule: exercise.plannedProgression,
  };
}

/**
 * The sets of the most recent `completed` Session that contains any set for
 * `exerciseId`, in set order (REQ-061, REQ-062).
 *
 * A completed Session that did not include the exercise is skipped rather than
 * treated as "no history", so the search walks backwards until it finds one.
 */
function lastCompletedSets(
  history: readonly SessionHistory[],
  exerciseId: ExerciseId,
): readonly CompletedSet[] {
  const candidates = history
    .filter((entry) => entry.session.status === 'completed')
    .sort((a, b) => b.session.startedAt - a.session.startedAt);

  for (const entry of candidates) {
    const sets = entry.exercises
      .filter((exercise) => exercise.exerciseSession.exerciseId === exerciseId)
      .flatMap((exercise) => exercise.sets)
      .sort((a, b) => a.setNumber - b.setNumber);
    if (sets.length > 0) return sets;
  }

  return [];
}

/**
 * Repeats a previous load unchanged.
 *
 * `weight` and `unit` come straight off the set, so no conversion happens and
 * no rounding can creep in; `weightKg` is the value the set already carries.
 */
function repeat(previous: CompletedSet): LoadSuggestion {
  return {
    weight: previous.weight,
    unit: previous.unit,
    weightKg: previous.weightKg,
    targetMet: false,
  };
}

/**
 * §29, REQ-064 — double progression. `previous` is `sets[0]`, the load the
 * last completed session was worked at.
 *
 * N is the planned set count. Only the first N sets are evaluated: extra sets
 * are ignored, and fewer than N means the target is not met. When every one of
 * those N sets reached `plannedMaxReps`, the suggestion is the previous weight
 * plus `increment`; otherwise the previous weight is repeated.
 *
 * The arithmetic is done in the exercise's own unit, on the previous set's
 * `weight`, because `increment` is expressed in that unit (§12 field notes).
 * Converting to kilograms, adding a converted increment and converting back
 * would leave a lb exercise on 139.9998 lb instead of 140. `weightKg` is then
 * derived from the result with the single conversion in `toKg`, which is what
 * keeps it consistent with every stored `CompletedSet.weightKg` (REQ-066).
 *
 * `maxReps` comes from the *upcoming* target, not from the historical snapshot:
 * the question being answered is whether the last session satisfies the plan
 * about to be executed.
 */
function doubleProgression(
  previous: CompletedSet,
  sets: readonly CompletedSet[],
  plannedSets: number,
  maxReps: number,
  increment: number,
): LoadSuggestion {
  const evaluated = sets.slice(0, plannedSets);
  const targetMet =
    evaluated.length === plannedSets && evaluated.every((set) => set.reps >= maxReps);

  if (!targetMet) return repeat(previous);

  const weight = previous.weight + increment;
  return {
    weight,
    unit: previous.unit,
    weightKg: toKg(weight, previous.unit),
    targetMet: true,
  };
}

/**
 * The suggested next load for `exercise`, or `null` when there is none:
 * an unplanned exercise, or no completed history for it (REQ-065, AC-069).
 *
 * `exercise` may be the PlannedExercise about to be started or the
 * ExerciseSession snapshot already taken from it — the same rule and set count
 * either way.
 */
/**
 * What the sets logged *so far, in this Session* will make the next load —
 * `null` when they will not move it.
 *
 * The same question `suggestLoad` answers, asked one session earlier: that one
 * reads the last `completed` Session to decide what to lift now, this one reads
 * the Session in progress to say what it is about to earn. It exists so a lifter
 * can see the consequence of the set they are on while they can still change it,
 * rather than discovering it a week later.
 *
 * The rule is not restated — `doubleProgression` is the same function
 * `suggestLoad` calls, so the two can never come to disagree about what a
 * target met means. `sets` must be in `setNumber` order, as every caller of the
 * rule supplies them.
 *
 * `null` for three cases, and they are all the same case: nothing to promise.
 * An unplanned exercise has no rule; a manual rule never advances by itself
 * (§28); and a double-progression target not yet met would be a projection of
 * "no change", which is not news. Absence is the message.
 */
export function projectNextLoad(
  exercise: ExerciseSession,
  sets: readonly CompletedSet[],
): LoadSuggestion | null {
  const target = targetOf(exercise);
  if (target === null) return null;

  const first = sets[0];
  if (first === undefined) return null;
  if (target.rule.type === 'manual') return null;

  const projected = doubleProgression(
    first,
    sets,
    target.plannedSets,
    target.maxReps,
    target.rule.increment,
  );
  return projected.targetMet ? projected : null;
}

export function suggestLoad(
  exercise: PlannedExercise | ExerciseSession,
  history: readonly SessionHistory[],
): LoadSuggestion | null {
  const target = targetOf(exercise);
  if (target === null) return null;

  const sets = lastCompletedSets(history, target.exerciseId);
  const previous = sets[0];
  if (previous === undefined) return null;

  switch (target.rule.type) {
    // §28 — history is kept and shown; the load never advances by itself.
    case 'manual':
      return repeat(previous);

    case 'double_progression':
      return doubleProgression(
        previous,
        sets,
        target.plannedSets,
        target.maxReps,
        target.rule.increment,
      );
  }
}
