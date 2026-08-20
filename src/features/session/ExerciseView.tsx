/**
 * One exercise, filling the screen (§11.5, §21).
 *
 * The order on screen is the order of §21's sketch and it is not an accident:
 * what the programme asked for, then what you did last time, then the sets so
 * far, then the set in front of you. Everything above the logger is context a
 * lifter reads once between sets; the logger is what their thumb lives on.
 *
 * The targets rendered here come from the ExerciseSession's own snapshot, never
 * from the PlannedExercise behind it (ADR 0002). `plannedExerciseId` is
 * provenance; nothing reads a target through it.
 */

import { useState } from 'react';
import { History } from 'lucide-react';
import type { CompletedSet, ExerciseSession } from '@/domain/types';
import type { LoadSuggestion } from '@/domain/progression';
import { suggestLoad } from '@/domain/progression';
import type { Unit } from '@/domain/units';
import { SetLogger, type SetValues } from '@/features/session/SetLogger';
import { useExerciseHistory, usePreviousPerformance } from '@/features/data/queries';
import { range } from '@/features/ui/format';
import { ICON_STROKE, LABEL, RULED, WELL, chip, dome } from '@/features/ui/styles';

/** The plate granularity of an exercise, where its rule declares one (§29). */
const DEFAULT_STEP = 2.5;

interface ExerciseViewProps {
  readonly exerciseSession: ExerciseSession;
  readonly name: string;
  readonly sets: readonly CompletedSet[];
  /** The unit an unplanned exercise logs in — it has no plan to take one from. */
  readonly defaultUnit: Unit;
  readonly onLog: (values: SetValues, unit: Unit, setNumber: number) => Promise<void>;
  readonly busy: boolean;
}

export function ExerciseView({
  exerciseSession,
  name,
  sets,
  defaultUnit,
  onLog,
  busy,
}: ExerciseViewProps) {
  const planned = exerciseSession.plannedExerciseId === null ? null : exerciseSession;
  const history = useExerciseHistory(exerciseSession.exerciseId);
  const previous = usePreviousPerformance(exerciseSession.exerciseId, exerciseSession.sessionId);

  // §11.9 — no suggestion for an unplanned exercise, and none without history.
  const suggestion = history === undefined ? null : suggestLoad(exerciseSession, history);

  const lastSet = sets.at(-1);
  const previousSets = previous?.exercises.flatMap((entry) => entry.sets) ?? [];

  // §11.7 — the unit is the exercise's, not the screen's. A set already logged
  // carries it; before that the snapshot does. The settings default is the last
  // resort and applies only to an unplanned exercise, which has no plan to take
  // a unit from. Getting this order wrong stores a pound load as kilograms.
  const unit =
    lastSet?.unit ?? planned?.plannedUnit ?? suggestion?.unit ?? previousSets[0]?.unit ?? defaultUnit;

  // §20 — the set opens on what the lifter is most likely to perform, and holds
  // whatever they stepped it to afterwards. The caller keys this component on
  // the exercise, so paging to another one remounts and re-derives rather than
  // carrying the last exercise's numbers across.
  const [values, setValues] = useState<SetValues | null>(null);

  const opening = openingValues(exerciseSession, sets, suggestion, previousSets);
  const current = values ?? opening;
  const setNumber = sets.length + 1;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h2 className="type-display">{name}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {planned === null ? (
            <span className={chip('neutral')}>Unplanned</span>
          ) : (
            <span className="type-measure text-ink-3">
              {planned.plannedSets}×{range(planned.plannedMinReps, planned.plannedMaxReps)}
              {planned.plannedMinRir !== null &&
                planned.plannedMaxRir !== null &&
                ` · RIR ${range(planned.plannedMinRir, planned.plannedMaxRir)}`}
              {planned.plannedRestSeconds !== null && ` · rest ${planned.plannedRestSeconds}s`}
            </span>
          )}
          {sets.length > (planned?.plannedSets ?? Infinity) && (
            <span className={chip('actual')}>{sets.length - planned!.plannedSets} extra</span>
          )}
        </div>
      </header>

      <Previous sets={previousSets} suggestion={suggestion} />

      <DomeStrip
        plannedSets={planned?.plannedSets ?? 0}
        sets={sets}
        setNumber={setNumber}
      />

      <div className={RULED}>
        <SetLogger
          busy={busy}
          onChange={setValues}
          onComplete={() => void onLog(current, unit, setNumber)}
          setNumber={setNumber}
          unit={unit}
          values={current}
          weightStep={stepOf(exerciseSession)}
        />
      </div>
    </section>
  );
}

/**
 * §11.8 — what happened last time, which the PRD calls one of the product's
 * main functions. Sessions of any status count: this is "what you did", not
 * what progression feeds on.
 */
function Previous({
  sets,
  suggestion,
}: {
  readonly sets: readonly CompletedSet[];
  readonly suggestion: LoadSuggestion | null;
}) {
  return (
    <section className={WELL}>
      <div className="flex items-center justify-between gap-3">
        <span className={LABEL}>
          <History aria-hidden="true" className="mr-1.5 inline" size={13} strokeWidth={ICON_STROKE} />
          previous
        </span>
        {suggestion !== null && (
          <span className={chip(suggestion.targetMet ? 'actual' : 'neutral')}>
            {suggestion.targetMet ? 'target met' : 'repeat'} · {suggestion.weight} {suggestion.unit}
          </span>
        )}
      </div>

      {sets.length === 0 ? (
        <p className="type-body-sm text-ink-2">
          First time on this exercise. Whatever you log becomes the baseline.
        </p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {sets.map((set) => (
            <span className="type-measure text-ink" key={set.id}>
              {set.weight} {set.unit} × {set.reps}
              <span className="text-ink-3"> @{set.rir}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * One dome per Set (DESIGN.md §Components). A logged dome shows what was
 * performed, never the target it was measured against; the live one is the
 * set being entered; the rest are the plan, marked but not filled.
 *
 * The strip runs past `plannedSets` on its own, because a lifter who logs a
 * fifth set of a four-set exercise has deviated, not erred (§11.5).
 */
function DomeStrip({
  plannedSets,
  sets,
  setNumber,
}: {
  readonly plannedSets: number;
  readonly sets: readonly CompletedSet[];
  readonly setNumber: number;
}) {
  const count = Math.max(plannedSets, setNumber);

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 py-1">
      {Array.from({ length: count }, (_, index) => {
        const number = index + 1;
        const set = sets[index];

        if (set !== undefined) {
          return (
            <div
              aria-label={`Set ${number}, logged, ${set.weight} ${set.unit} for ${set.reps} reps at RIR ${set.rir}`}
              className={dome('logged', 'compact')}
              key={set.id}
            >
              <span>{set.weight}</span>
              <span className="type-label opacity-80">
                {set.reps}·{set.rir}
              </span>
            </div>
          );
        }

        const live = number === setNumber;
        return (
          <div
            aria-label={`Set ${number}, ${live ? 'in progress' : 'planned'}`}
            className={dome(live ? 'live' : 'planned', live ? 'default' : 'compact')}
            key={number}
          >
            <span>{number}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The plate granularity to step the load by (§29, DEC-5). */
function stepOf(exerciseSession: ExerciseSession): number {
  if (exerciseSession.plannedExerciseId === null) return DEFAULT_STEP;
  const rule = exerciseSession.plannedProgression;
  return rule.type === 'double_progression' ? rule.increment : DEFAULT_STEP;
}

/**
 * What the readouts open on (§20 "Previous Values as Defaults", R-5).
 *
 * In order of preference: the set just logged in this exercise, because a
 * lifter usually repeats the load across sets; then the progression suggestion;
 * then last session's opening set; then nothing to go on, and zeros.
 */
function openingValues(
  exerciseSession: ExerciseSession,
  sets: readonly CompletedSet[],
  suggestion: LoadSuggestion | null,
  previousSets: readonly CompletedSet[],
): SetValues {
  const planned = exerciseSession.plannedExerciseId === null ? null : exerciseSession;
  const reps = planned?.plannedMaxReps ?? previousSets[0]?.reps ?? 0;
  const rir = planned?.plannedMinRir ?? previousSets[0]?.rir ?? 0;

  const lastLogged = sets.at(-1);
  if (lastLogged !== undefined) {
    return { weight: lastLogged.weight, reps: lastLogged.reps, rir: lastLogged.rir };
  }

  if (suggestion !== null) return { weight: suggestion.weight, reps, rir };
  const previous = previousSets[0];
  if (previous !== undefined) return { weight: previous.weight, reps, rir };
  return { weight: 0, reps, rir };
}
