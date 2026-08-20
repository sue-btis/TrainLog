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
import { Link } from 'react-router';
import { ArrowRight, CheckCircle2, History, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CompletedSetId, ExerciseId } from '@/domain/ids';
import type { CompletedSet, ExerciseSession } from '@/domain/types';
import type { LoadSuggestion } from '@/domain/progression';
import { suggestLoad } from '@/domain/progression';
import type { Unit } from '@/domain/units';
import { SetEditor } from '@/features/session/SetEditor';
import { SetLogger, type SetValues } from '@/features/session/SetLogger';
import { useExerciseHistory, usePreviousPerformance } from '@/features/data/queries';
import { range } from '@/features/ui/format';
import { ICON_STROKE, LABEL, RULED, WELL, chip, dome } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

/** The plate granularity of an exercise, where its rule declares one (§29). */
const DEFAULT_STEP = 2.5;

interface ExerciseViewProps {
  readonly exerciseSession: ExerciseSession;
  readonly name: string;
  readonly sets: readonly CompletedSet[];
  /** The unit an unplanned exercise logs in — it has no plan to take one from. */
  readonly defaultUnit: Unit;
  readonly onLog: (values: SetValues, unit: Unit, setNumber: number) => Promise<void>;
  /** Move to the next exercise, or finish when this is the last one (R-3). */
  readonly onAdvance: () => void;
  readonly isLast: boolean;
  /** Correct a set already logged, and remove one (R-4). */
  readonly onEditSet: (set: CompletedSet, values: SetValues, unit: Unit) => Promise<void>;
  readonly onDeleteSet: (set: CompletedSet) => Promise<void>;
  readonly busy: boolean;
}

export function ExerciseView({
  exerciseSession,
  name,
  sets,
  defaultUnit,
  onLog,
  onAdvance,
  isLast,
  onEditSet,
  onDeleteSet,
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

  const [addingExtra, setAddingExtra] = useState(false);
  const [editing, setEditing] = useState<CompletedSetId | null>(null);
  const editedSet = sets.find((set) => set.id === editing) ?? null;

  const opening = openingValues(exerciseSession, sets, suggestion, previousSets);
  const current = values ?? opening;
  const setNumber = sets.length + 1;

  /**
   * R-3 — the programmed sets are in. The green button then stops asking for
   * another one: an exercise that is done should not present "Complete set" as
   * the obvious next thing to press, when the obvious next thing is the next
   * exercise. A fifth set stays one tap away, because deviating upward is
   * legitimate training (FR-14, §11.5).
   *
   * An unplanned exercise has no count to reach, so it never switches.
   */
  const done = planned !== null && sets.length >= planned.plannedSets;

  /**
   * Whether a set is being entered right now — the one fact the strip and the
   * controls below it must agree on. They disagreed before: the strip inferred
   * it from `sets.length + 1` and drew a live dome for a set the logger was not
   * offering.
   */
  const entering = editedSet === null && (!done || addingExtra);

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

      <Previous
        exerciseId={exerciseSession.exerciseId}
        sets={previousSets}
        suggestion={suggestion}
      />

      <DomeStrip
        canAdd={editedSet === null && !entering}
        entering={entering}
        onAddSet={() => setAddingExtra(true)}
        onEdit={(set) => setEditing(set.id)}
        plannedSets={planned?.plannedSets ?? 0}
        sets={sets}
      />

      {/* One region, three states: correcting a set already logged, the
          programme's sets still to do, or an exercise that has reached its
          count and should be offering the next one instead (R-3, R-4). */}
      <div className={RULED}>
        {editedSet !== null ? (
          <SetEditor
            busy={busy}
            key={editedSet.id}
            onCancel={() => setEditing(null)}
            onDelete={() => {
              setEditing(null);
              void onDeleteSet(editedSet);
            }}
            onSave={(next, unit) => {
              setEditing(null);
              void onEditSet(editedSet, next, unit);
            }}
            set={editedSet}
            weightStep={stepOf(exerciseSession)}
          />
        ) : !entering ? (
          <Button onClick={onAdvance} size="block" type="button" variant="primary">
            {isLast ? (
              <CheckCircle2 aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
            ) : (
              <ArrowRight aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
            )}
            {isLast ? 'Finish session' : 'Next exercise'}
          </Button>
        ) : (
          <SetLogger
            busy={busy}
            onChange={setValues}
            onComplete={() => {
              setAddingExtra(false);
              void onLog(current, unit, setNumber);
            }}
            setNumber={setNumber}
            unit={unit}
            values={current}
            weightStep={stepOf(exerciseSession)}
          />
        )}
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
  exerciseId,
  sets,
  suggestion,
}: {
  readonly exerciseId: ExerciseId;
  readonly sets: readonly CompletedSet[];
  readonly suggestion: LoadSuggestion | null;
}) {
  return (
    <section className={WELL}>
      <div className="flex items-center justify-between gap-3">
        {/* The card shows one session — the last one. Everything before it is a
            tap away rather than crowded in here (§11.10, §21). */}
        <Link
          className={cn(LABEL, 'underline decoration-rule underline-offset-4')}
          to={`/exercises/${exerciseId}`}
        >
          <History aria-hidden="true" className="mr-1.5 inline" size={13} strokeWidth={ICON_STROKE} />
          previous · all history
        </Link>
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
 * performed, never the target it was measured against; the live one is the set
 * being entered; the rest are the plan, marked but not filled.
 *
 * **`entering` is what stops the strip inventing a set.** The count of domes
 * cannot be derived from `sets.length + 1` alone: once every planned set is
 * logged, that number is one past the last set, and the strip drew a breathing
 * 96px `live` dome for a set nobody was performing. Whether a set is being
 * entered is a fact about the screen, not about the sets, so it is passed in.
 *
 * The strip runs past `plannedSets` on its own, because a lifter who logs a
 * fifth set of a four-set exercise has deviated, not erred (§11.5).
 */
function DomeStrip({
  plannedSets,
  sets,
  entering,
  canAdd,
  onEdit,
  onAddSet,
}: {
  readonly plannedSets: number;
  readonly sets: readonly CompletedSet[];
  /** Whether the logger is open for a new set — the live dome's only reason. */
  readonly entering: boolean;
  /**
   * Whether another set can be started from here. False while a logged set is
   * being corrected: the editor owns the region below, so a `+` would be a
   * control that looks pressable and answers nothing.
   */
  readonly canAdd: boolean;
  readonly onEdit: (set: CompletedSet) => void;
  readonly onAddSet: () => void;
}) {
  const liveNumber = sets.length + 1;
  const count = Math.max(plannedSets, sets.length + (entering ? 1 : 0));

  return (
    // Wraps rather than scrolls. A strip you have to drag hides sets behind an
    // edge, and how many you have done is the one thing that must be legible at
    // a glance between sets — including the extra ones, which are exactly the
    // ones a scrolling strip would push out of sight.
    <div className="flex flex-wrap items-center gap-3 py-1">
      {Array.from({ length: count }, (_, index) => {
        const number = index + 1;
        const set = sets[index];

        if (set !== undefined) {
          // A logged dome is the way into correcting it (R-4). The set it shows
          // is the set you would be editing, so it is its own affordance and
          // nothing else has to be added to the screen to carry one.
          return (
            <button
              aria-label={`Edit set ${number}, ${set.weight} ${set.unit} for ${set.reps} reps at RIR ${set.rir}`}
              className={dome('logged', 'compact')}
              key={set.id}
              onClick={() => onEdit(set)}
              type="button"
            >
              <span>{set.weight}</span>
              <span className="type-label opacity-80">
                {set.reps}·{set.rir}
              </span>
            </button>
          );
        }

        const live = entering && number === liveNumber;
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

      {/* The offer of one more set, at the end of the strip where the next set
          would go. It replaces a button below: an extra set is one more of
          these circles, so it belongs among them rather than in a row of prose
          competing with the primary action (§21). */}
      {canAdd && (
        <button
          aria-label={`Add set ${liveNumber}`}
          className={dome('add', 'compact')}
          onClick={onAddSet}
          type="button"
        >
          <Plus aria-hidden="true" size={22} strokeWidth={ICON_STROKE} />
        </button>
      )}
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
