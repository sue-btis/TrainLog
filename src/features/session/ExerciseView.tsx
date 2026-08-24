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
import { ArrowRight, CheckCircle2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CompletedSetId } from '@/domain/ids';
import type { CompletedSet, ExerciseSession } from '@/domain/types';
import type { LoadSuggestion } from '@/domain/progression';
import { projectNextLoad, suggestLoad } from '@/domain/progression';
import type { Unit } from '@/domain/units';
import { SetEditor } from '@/features/session/SetEditor';
import { SetLogger, type SetValues } from '@/features/session/SetLogger';
import { useExerciseHistory, usePreviousPerformance } from '@/features/data/queries';
import { snapshotLine } from '@/features/ui/format';
import { ICON_STROKE, RULED, chip, dome } from '@/features/ui/styles';

/** The plate granularity of an exercise, where its rule declares one (§29). */
const DEFAULT_STEP = 2.5;

interface ExerciseViewProps {
  readonly exerciseSession: ExerciseSession;
  readonly name: string;
  readonly sets: readonly CompletedSet[];
  /** The unit an unplanned exercise logs in — it has no plan to take one from. */
  readonly defaultUnit: Unit;
  /** The settings default RIR, or `null` when the lifter has no opinion (§32). */
  readonly defaultRir: number | null;
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
  defaultRir,
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

  // What the sets already logged will make the next load — shown while the
  // lifter can still change it, never on the row they are entering.
  const projected = projectNextLoad(exerciseSession, sets);

  const opening = openingValues(exerciseSession, sets, suggestion, previousSets, defaultRir);
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
            <span className="type-measure text-ink-3">{snapshotLine(planned)}</span>
          )}
          {sets.length > (planned?.plannedSets ?? Infinity) && (
            <span className={chip('actual')}>{sets.length - planned!.plannedSets} extra</span>
          )}
        </div>
      </header>

      <DomeStrip
        canAdd={editedSet === null && !entering}
        entering={entering}
        onAddSet={() => setAddingExtra(true)}
        onEdit={(set) => setEditing(set.id)}
        plannedSets={planned?.plannedSets ?? 0}
        previousSets={previousSets}
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

      {/* The consequence of the sets in hand, at the foot of the exercise.
          Progression is derived and explainable (Principle 6), and until now the
          explaining happened a week later, when the load simply arrived heavier.
          Violet, because neither number here was entered by anybody.

          It says nothing at all unless the rule has been satisfied — a line
          reading "no change" is not news, and §21 forbids anything that does
          not serve the set in front of you. Absence is the message. */}
      {projected !== null && sets[0] !== undefined && (
        <p className="type-measure text-progress-ink">
          next time · {sets[0].weight} → {projected.weight} {projected.unit}
        </p>
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
  previousSets,
  entering,
  canAdd,
  onEdit,
  onAddSet,
}: {
  readonly plannedSets: number;
  readonly sets: readonly CompletedSet[];
  /**
   * The same exercise's sets from the last Session it was performed in, in the
   * order they were logged — so set 2 sits under set 2.
   *
   * Last time's numbers used to live in a panel below the finish control, off
   * the bottom of the screen and reduced to a heaviest and a lightest. That
   * answers "what was I working at" but not "did my reps fall off across the
   * sets", which is the question that actually decides the next load. Per set,
   * above the fold, answers both without a scroll (Principle 3).
   */
  readonly previousSets: readonly CompletedSet[];
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
        const before = previousSets[index];

        if (set !== undefined) {
          // A logged dome is the way into correcting it (R-4). The set it shows
          // is the set you would be editing, so it is its own affordance and
          // nothing else has to be added to the screen to carry one.
          return (
            <Cell before={before} key={set.id}>
              <button
                aria-label={`Edit set ${number}, ${set.weight} ${set.unit} for ${set.reps} reps at RIR ${set.rir}${ghostLabel(before)}`}
                className={dome('logged', 'compact')}
                onClick={() => onEdit(set)}
                type="button"
              >
                <span>{set.weight}</span>
                <span className="type-label opacity-80">
                  {set.reps}·{set.rir}
                </span>
              </button>
            </Cell>
          );
        }

        const live = entering && number === liveNumber;
        return (
          <Cell before={before} key={number}>
            <div
              aria-label={`Set ${number}, ${live ? 'in progress' : 'planned'}${ghostLabel(before)}`}
              // `default` (76px), not the `live` 96px DESIGN.md calls "the
              // largest thing on screen" — measured, and deliberate.
              //
              // With the rest timer mounted, 96px plus the ghost row put
              // "Complete set" at y=801 in an 812px viewport: the most-pressed
              // control in the product, half off the bottom of the screen. The
              // usage scene outranks the flourish, and PRODUCT.md binds primary
              // controls to comfortable thumb zones.
              //
              // The 96px dome becomes affordable the moment the timer stops
              // being a 170px block: its second row exists only to hold a
              // "seconds to add" field, and folding that into the control
              // cluster returns more height than the dome costs.
              className={dome(live ? 'live' : 'planned', live ? 'default' : 'compact')}
            >
              <span>{number}</span>
            </div>
          </Cell>
        );
      })}

      {/* The offer of one more set, at the end of the strip where the next set
          would go. It replaces a button below: an extra set is one more of
          these circles, so it belongs among them rather than in a row of prose
          competing with the primary action (§21). */}
      {canAdd && (
        <Cell before={undefined}>
          <button
            aria-label={`Add set ${liveNumber}`}
            className={dome('add', 'compact')}
            onClick={onAddSet}
            type="button"
          >
            <Plus aria-hidden="true" size={22} strokeWidth={ICON_STROKE} />
          </button>
        </Cell>
      )}
    </div>
  );
}

/**
 * One dome, and under it what that set number was last time.
 *
 * The ghost line is reference, never a control: it is not pressable, it is
 * `text-ink-3` rather than any of the five semantic hues, and it holds its
 * height when there is nothing to show so the domes stay on one baseline
 * instead of jittering as a session fills in.
 */
function Cell({
  before,
  children,
}: {
  readonly before: CompletedSet | undefined;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {children}
      <span className="type-micro text-ink-3 tabular-nums">
        {before === undefined ? ' ' : `${before.weight}×${before.reps}`}
      </span>
    </div>
  );
}

/** The ghost value, spoken. A dome with nothing before it says nothing extra. */
function ghostLabel(before: CompletedSet | undefined): string {
  if (before === undefined) return '';
  return `. Last time ${before.weight} ${before.unit} for ${before.reps} reps`;
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
 *
 * `defaultRir` is the last word before that zero and nothing more: an exercise
 * with a plan opens on its target, and one with history opens on what was done.
 * It exists for the unplanned exercise nobody has logged before, where the
 * alternative is RIR 0 — a claim that the lifter trains that set to failure.
 */
function openingValues(
  exerciseSession: ExerciseSession,
  sets: readonly CompletedSet[],
  suggestion: LoadSuggestion | null,
  previousSets: readonly CompletedSet[],
  defaultRir: number | null,
): SetValues {
  const planned = exerciseSession.plannedExerciseId === null ? null : exerciseSession;
  const reps = planned?.plannedMaxReps ?? previousSets[0]?.reps ?? 0;
  const rir = planned?.plannedMinRir ?? previousSets[0]?.rir ?? defaultRir ?? 0;

  const lastLogged = sets.at(-1);
  if (lastLogged !== undefined) {
    return { weight: lastLogged.weight, reps: lastLogged.reps, rir: lastLogged.rir };
  }

  if (suggestion !== null) return { weight: suggestion.weight, reps, rir };
  const previous = previousSets[0];
  if (previous !== undefined) return { weight: previous.weight, reps, rir };
  return { weight: 0, reps, rir };
}
