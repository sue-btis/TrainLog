import type { ExerciseId } from '@/domain/ids';
import { measurementOf } from '@/domain/history';
import {
  axisValue,
  directionOf,
  progressAxisOf,
  targetAxisOf,
  targetsReps,
  type Axis,
  type Measurement,
} from '@/domain/measurement';
import type {
  CompletedSet,
  ExerciseSession,
  PlannedExercise,
  ProgressionRule,
  Session,
} from '@/domain/types';
import { toKg, type Unit } from '@/domain/units';

export interface ExerciseSessionHistory {
  readonly exerciseSession: ExerciseSession;
  readonly sets: readonly CompletedSet[];
}

export interface SessionHistory {
  readonly session: Session;
  readonly exercises: readonly ExerciseSessionHistory[];
}

export interface LoadSuggestion {
  readonly weight: number;
  readonly unit: Unit;
  readonly weightKg: number;
  readonly axis: Axis;
  /**
   * The suggested value on `axis`, in that axis's own canonical unit: the same
   * number as `weight` for a load axis, seconds for a duration axis, metres for
   * a distance axis, reps for a rep axis, seconds per metre for pace.
   */
  readonly value: number;
  readonly targetMet: boolean;
}

/** What the engine needs about the exercise a suggestion is being made for. */
interface ProgressionTarget {
  readonly exerciseId: ExerciseId;
  readonly plannedSets: number;
  readonly measurement: Measurement;
  readonly targetMax: number | null;
  readonly rule: ProgressionRule;
}

function targetOf(
  exercise: PlannedExercise | ExerciseSession,
  measurement: Measurement,
): ProgressionTarget | null {
  // Exactly one of the two target pairs is populated, and which one is decided
  // by the measurement rather than by testing which field is non-null
  const onReps = targetsReps(measurement);

  if (!('plannedExerciseId' in exercise)) {
    return {
      exerciseId: exercise.exerciseId,
      plannedSets: exercise.sets,
      measurement,
      targetMax: onReps ? exercise.maxReps : exercise.maxTarget,
      rule: exercise.progression,
    };
  }
  if (exercise.plannedExerciseId === null) return null;
  return {
    exerciseId: exercise.exerciseId,
    plannedSets: exercise.plannedSets,
    measurement,
    targetMax: onReps ? exercise.plannedMaxReps : exercise.plannedMaxTarget,
    rule: exercise.plannedProgression,
  };
}

function measurementFor(
  exercise: PlannedExercise | ExerciseSession,
  history: readonly SessionHistory[],
): Measurement {
  return 'plannedExerciseId' in exercise ? exercise.measurement : measurementOf(history);
}

function lastCompletedSets(
  history: readonly SessionHistory[],
  exerciseId: ExerciseId,
): readonly CompletedSet[] {
  // Progression uses the newest completed Session that actually has sets;
  // partial and setless Sessions must not become the previous performance.
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
function repeat(previous: CompletedSet, measurement: Measurement): LoadSuggestion {
  const axis = progressAxisOf(measurement);
  return {
    weight: previous.weight,
    unit: previous.unit,
    weightKg: previous.weightKg,
    axis,
    value: axis === 'load' ? previous.weight : (axisValue(previous, axis) ?? 0),
    targetMet: false,
  };
}

function doubleProgression(
  previous: CompletedSet,
  sets: readonly CompletedSet[],
  plannedSets: number,
  targetMax: number,
  increment: number,
  measurement: Measurement,
): LoadSuggestion {
  const target = targetAxisOf(measurement);
  const evaluated = sets.slice(0, plannedSets);
  // Every target axis is higher-is-better — reps, seconds, metres — so the
  // comparison needs no sign of its own. The sign lives on the progress axis,
  // below.
  const targetMet =
    evaluated.length === plannedSets &&
    evaluated.every((set) => (axisValue(set, target) ?? 0) >= targetMax);

  if (!targetMet) return repeat(previous, measurement);

  const axis = progressAxisOf(measurement);
  const direction = directionOf(measurement);

  if (axis === 'load') {
    // Advancing means *reducing* assistance on an inverted load axis, floored
    const weight =
      direction === 'higher'
        ? previous.weight + increment
        : Math.max(0, previous.weight - increment);
    return {
      weight,
      unit: previous.unit,
      weightKg: toKg(weight, previous.unit),
      axis,
      value: weight,
      targetMet: true,
    };
  }

  // No load axis, so the load does not move and the advance is on the axis the
  // target itself is stated on — more reps, more seconds, more metres, or a
  // faster pace.
  const current = axisValue(previous, axis) ?? 0;
  const value =
    direction === 'higher' ? current + increment : Math.max(0, current - increment);
  return {
    weight: previous.weight,
    unit: previous.unit,
    weightKg: previous.weightKg,
    axis,
    value,
    targetMet: true,
  };
}

export function projectNextLoad(
  exercise: ExerciseSession,
  sets: readonly CompletedSet[],
): LoadSuggestion | null {
  const measurement = exercise.measurement;
  const target = targetOf(exercise, measurement);
  if (target === null) return null;
  // No range stated is nothing to have met.
  if (target.targetMax === null) return null;

  const first = sets[0];
  if (first === undefined) return null;
  if (target.rule.type === 'manual') return null;

  const projected = doubleProgression(
    first,
    sets,
    target.plannedSets,
    target.targetMax,
    target.rule.increment,
    measurement,
  );
  return projected.targetMet ? projected : null;
}

export function suggestLoad(
  exercise: PlannedExercise | ExerciseSession,
  history: readonly SessionHistory[],
): LoadSuggestion | null {
  const measurement = measurementFor(exercise, history);
  const target = targetOf(exercise, measurement);
  if (target === null) return null;

  const sets = lastCompletedSets(history, target.exerciseId);
  const previous = sets[0];
  if (previous === undefined) return null;

  switch (target.rule.type) {
    case 'manual':
      return repeat(previous, measurement);

    case 'double_progression':
      if (target.targetMax === null) return repeat(previous, measurement);
      return doubleProgression(
        previous,
        sets,
        target.plannedSets,
        target.targetMax,
        target.rule.increment,
        measurement,
      );
  }
}
