import { targetAxisOf, targetUnitOf, targetsReps } from '@/domain/measurement';
import type { LoadSuggestion } from '@/domain/progression';
import type { CompletedSet, ExerciseSession } from '@/domain/types';
import type { Unit } from '@/domain/units';
import {
  EMPTY_VALUES,
  targetsOf,
  valuesOf,
  type SetTargets,
  type SetValues,
} from '@/features/session/SetLogger';

/**
 * The window a value is judged "off plan" against. A suggestion on the target
 * axis may sit above the planned maximum (it is what the engine asked for), so
 * the window grows to include it instead of flagging the suggestion itself.
 */
export function targetsWithSuggestion(
  exerciseSession: ExerciseSession,
  suggestion: LoadSuggestion | null,
): SetTargets {
  const targets = targetsOf(exerciseSession);
  if (
    targets.primary === null ||
    suggestion === null ||
    suggestion.axis !== targetAxisOf(exerciseSession.measurement)
  ) {
    return targets;
  }
  const [min, max] = targets.primary;
  return { ...targets, primary: [min, Math.max(max, suggestion.value)] };
}

/** The values a set opens on: the suggestion on its axis, otherwise the plan, otherwise what was done last. */
export function openingValues(
  exerciseSession: ExerciseSession,
  sets: readonly CompletedSet[],
  suggestion: LoadSuggestion | null,
  previousSets: readonly CompletedSet[],
  defaultRir: number | null,
  unit: Unit,
): SetValues {
  const planned = exerciseSession.plannedExerciseId === null ? null : exerciseSession;
  const rir = planned?.plannedMinRir ?? previousSets[0]?.rir ?? defaultRir ?? null;

  // The last set of this exercise, in this Session, is the strongest opening
  // there is: it is what the lifter just did, on every axis at once.
  const lastLogged = sets.at(-1);
  if (lastLogged !== undefined) return valuesOf(lastLogged);

  // Otherwise the previous session's first set carries every axis the type
  // collects, and the plan's own target overrides the one axis it states.
  const previous = previousSets[0];
  // `unit` overrides whatever last session's set carried: the chain above is
  // the one statement of which unit an exercise opens in, and a stale set must
  // not quietly outrank the snapshot it already lost to there.
  const base: SetValues =
    previous === undefined
      ? { ...EMPTY_VALUES, rir, unit }
      : { ...valuesOf(previous), rir, unit };

  const fromPlan = targetsReps(exerciseSession.measurement)
    ? { ...base, reps: planned?.plannedMaxReps ?? base.reps }
    : { ...base, ...targetOpening(exerciseSession, planned?.plannedMaxTarget ?? null, base) };
  if (suggestion === null) return fromPlan;

  return { ...fromPlan, ...suggestedAxis(suggestion) };
}

function suggestedAxis(suggestion: LoadSuggestion): Partial<SetValues> {
  switch (suggestion.axis) {
    case 'load':
      return { weight: suggestion.weight };
    case 'reps':
      return { reps: suggestion.value };
    case 'duration':
      return { durationSeconds: suggestion.value };
    case 'distance':
      return { distance: suggestion.value, distanceUnit: 'm' };
    case 'pace':
      return {};
  }
}

function targetOpening(
  exerciseSession: ExerciseSession,
  plannedMaxTarget: number | null,
  base: SetValues,
): Partial<SetValues> {
  if (plannedMaxTarget === null) return {};
  if (targetUnitOf(exerciseSession.measurement) === 'seconds') {
    return { durationSeconds: plannedMaxTarget };
  }
  return base.distanceUnit === 'm' ? { distance: plannedMaxTarget } : {};
}
