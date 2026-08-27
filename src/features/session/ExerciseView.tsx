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

import { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CompletedSetId } from '@/domain/ids';
import { targetUnitOf, targetsReps } from '@/domain/measurement';
import type { CompletedSet, ExerciseSession } from '@/domain/types';
import type { LoadSuggestion } from '@/domain/progression';
import { suggestLoad } from '@/domain/progression';
import type { Unit } from '@/domain/units';
import { SetEditor } from '@/features/session/SetEditor';
import {
  EMPTY_VALUES,
  SetLogger,
  targetsOf,
  valuesOf,
  type SetValues,
} from '@/features/session/SetLogger';
import { useExerciseHistory, usePreviousPerformance } from '@/features/data/queries';
import { ExerciseArt } from '@/features/exercises/ExerciseArt';
import { Figure } from '@/features/ui/Figure';
import { snapshotFigures } from '@/features/ui/format';
import { ICON_STROKE, RULED, chip, dome } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

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
  readonly onLog: (values: SetValues, setNumber: number) => Promise<void>;
  /** Move to the next exercise, or finish when this is the last one (R-3). */
  readonly onAdvance: () => void;
  readonly isLast: boolean;
  /** Correct a set already logged, and remove one (R-4). */
  readonly onEditSet: (set: CompletedSet, values: SetValues) => Promise<void>;
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

  // §11.7 — the unit the exercise *opens* on. A set already logged carries it;
  // before that the snapshot does. The settings default is the last resort and
  // applies only to an unplanned exercise, which has no plan to take a unit
  // from. Getting this order wrong stores a pound load as kilograms.
  //
  // It opens the field and nothing more: the lifter can say the plates are in
  // pounds today without editing their programme, and from the second set on it
  // is the last set's own unit that leads this chain anyway.
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

  // The plan's windows for reps and RIR, derived once for both the logger
  // and the editor so a set and its correction are marked against the same
  // thing (§11.5, FR-14).
  const targets = targetsOf(exerciseSession);

  const opening = openingValues(exerciseSession, sets, suggestion, previousSets, defaultRir, unit);
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
      {/* The name and what the programme asked for. The three targets used to
          be one grey sentence under the title — `4×4–6 · RIR 1–2 · rest 210s` —
          which is fine to read once and wrong to read between sets: the eye has
          to parse a sentence to find the one figure it came for.

          Three labelled figures instead, in the same `Figure` the history card
          and the history screen use, so a number a lifter reads here looks like
          the same kind of thing everywhere it appears. */}
      <header className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          {/* The figure sits beside the title rather than above it: between
              sets the lifter is checking a position, not studying a diagram,
              and a full-width illustration would push the targets below the
              fold on a phone. */}
          <ExerciseArt className="size-16 text-planned-ink" id={exerciseSession.exerciseId} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <h2 className="type-display">{name}</h2>
            {planned === null && <span className={chip('neutral')}>Unplanned</span>}
            {sets.length > (planned?.plannedSets ?? Infinity) && (
              <span className={chip('actual')}>{sets.length - planned!.plannedSets} extra</span>
            )}
          </div>
        </div>

        {planned !== null && (
          <div className="grid grid-cols-3 gap-x-3 border-t border-rule pt-3">
            {snapshotFigures(planned).map((figure) => (
              <Figure compact key={figure.label} label={figure.label} value={figure.value} />
            ))}
          </div>
        )}
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
            measurement={exerciseSession.measurement}
            onCancel={() => setEditing(null)}
            onDelete={() => {
              setEditing(null);
              void onDeleteSet(editedSet);
            }}
            onSave={(next) => {
              setEditing(null);
              void onEditSet(editedSet, next);
            }}
            set={editedSet}
            targets={targets}
            weightStep={stepOf(exerciseSession)}
          />
        ) : !entering ? (
          // `disabled` matters most on the last exercise, where this control is
          // not a pager but the whole finish: it writes the Session, its
          // exercises and the progression behind them, then leaves.
          <Button disabled={busy} onClick={onAdvance} size="block" type="button" variant="primary">
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
            measurement={exerciseSession.measurement}
            onChange={setValues}
            onComplete={() => {
              setAddingExtra(false);
              void onLog(current, setNumber);
            }}
            setNumber={setNumber}
            targets={targets}
            values={current}
            weightStep={stepOf(exerciseSession)}
          />
        )}
      </div>

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

  // Which logged domes get the flood: the ones that were not already on screen
  // when this strip opened. A logged dome is keyed by its set's id, so it
  // mounts exactly once — at the moment the set is recorded — and a CSS
  // animation on it fires then and never again. Without this the four sets you
  // already did would all flood at once every time the exercise is opened,
  // which would say "recorded" about four things that were recorded an hour
  // ago. The set captured on the first render is the whole mechanism; it is a
  // ref rather than state because nothing should re-render when it is read.
  const openedRef = useRef<ReadonlySet<CompletedSetId> | null>(null);
  const opened = (openedRef.current ??= new Set(sets.map((set) => set.id)));

  // Which live dome gets the ignition, on the same principle and for the same
  // reason. `entering` is already true when an unfinished exercise opens, so
  // the live dome is on screen before a lifter has done anything — igniting it
  // would announce a set that has just been sitting there. This records which
  // set number was already live on arrival; every later one was started by a
  // press. `-1` is "none was", which is what a finished exercise looks like
  // until `+` is pressed, and that press is exactly the case this is for.
  const liveOnOpenRef = useRef<number | null>(null);
  const liveOnOpen = (liveOnOpenRef.current ??= entering ? liveNumber : -1);

  return (
    // Wraps rather than scrolls. A strip you have to drag hides sets behind an
    // edge, and how many you have done is the one thing that must be legible at
    // a glance between sets — including the extra ones, which are exactly the
    // ones a scrolling strip would push out of sight.
    <div className="flex flex-wrap items-center gap-3 py-1">
      <DomeGoo />

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
                className={dome(
                  'logged',
                  'compact',
                  opened.has(set.id) ? undefined : 'relative isolate dome-flood',
                )}
                onClick={() => onEdit(set)}
                type="button"
              >
                {!opened.has(set.id) && (
                  <span aria-hidden="true" className="dome-liquid">
                    <span className="dome-body bg-actual-ink" />
                    <span className="dome-sat dome-sat-a bg-actual-ink" />
                    <span className="dome-sat dome-sat-b bg-actual-ink" />
                    <span className="dome-sat dome-sat-c bg-actual-ink" />
                  </span>
                )}

                {/* Both numerals move as one so the flood uncovers a value
                    rather than two lines arriving separately. */}
                <span
                  className={cn(
                    'flex flex-col items-center gap-0.5',
                    opened.has(set.id) ? undefined : 'dome-value',
                  )}
                >
                  <span>{set.weight}</span>
                  <span className="type-label opacity-80">
                    {set.reps}·{set.rir}
                  </span>
                </span>
              </button>
            </Cell>
          );
        }

        const live = entering && number === liveNumber;
        const igniting = live && number !== liveOnOpen;
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
              className={dome(
                live ? 'live' : 'planned',
                live ? 'default' : 'compact',
                igniting ? 'relative isolate dome-ignite' : undefined,
              )}
            >
              {igniting && (
                <span aria-hidden="true" className="dome-liquid">
                  <span className="dome-ignite-body bg-live" />
                  <span className="dome-ignite-sat dome-ignite-sat-a bg-live" />
                  <span className="dome-ignite-sat dome-ignite-sat-b bg-live" />
                  <span className="dome-ignite-sat dome-ignite-sat-c bg-live" />
                </span>
              )}

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
 * The gooey filter the flooding dome uses, declared once for the strip rather
 * than once per set. It is what makes the satellites read as the same body of
 * liquid as the fill when they touch it: blur them together, then ramp the
 * alpha back to a hard edge so the overlap fuses instead of fading.
 *
 * The region is stated explicitly — a filter's default box is only 10% larger
 * than the element, and a satellite clears the 30px rim by some margin, so at
 * the default it would be cut off exactly where it is supposed to be visible.
 */
function DomeGoo() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute size-0" focusable="false">
      <defs>
        <filter height="260%" id="dome-goo" width="260%" x="-80%" y="-80%">
          <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="3" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
          />
        </filter>
      </defs>
    </svg>
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
  unit: Unit,
): SetValues {
  const planned = exerciseSession.plannedExerciseId === null ? null : exerciseSession;
  const rir = planned?.plannedMinRir ?? previousSets[0]?.rir ?? defaultRir ?? 0;

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

  const opening = targetsReps(exerciseSession.measurement)
    ? { ...base, reps: planned?.plannedMaxReps ?? base.reps }
    : { ...base, ...targetOpening(exerciseSession, planned?.plannedMaxTarget ?? null, base) };

  // §29 makes the load the thing that moves, so a suggestion overrides it and
  // nothing else.
  return suggestion === null ? opening : { ...opening, weight: suggestion.weight };
}

/**
 * The planned target, put on whichever axis the type states it — seconds or
 * metres, both canonical, so a `km` entry is left as the lifter last had it
 * rather than being handed a metre count in a kilometre field.
 */
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
