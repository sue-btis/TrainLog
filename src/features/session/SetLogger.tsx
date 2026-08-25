/**
 * The set a lifter is about to perform (§11.5 "Current Session", §20).
 *
 * Three readouts and one green button, and that is deliberately all: §21 says
 * nothing that does not contribute to the current set may compete with it.
 *
 * Two ways to the same number, and they are not equals. Stepping is the default
 * path and the one the gym is designed around: one hand is occupied, the phone
 * is on a bench, and a numeric keypad over the bottom half of the screen is a
 * bad thing to put between a lifter and the button they came here to press.
 * DESIGN.md §Inputs says as much, and says steppers *only*.
 *
 * Typing was added because that rule costs too much at the edges: going from 20
 * to 90 is 28 presses, and the first set of an exercise is exactly when the
 * jump is largest. So the readout is the input rather than a second control
 * beside it — one value, reachable either way, never two that can disagree.
 *
 * The cost is a parse, and it is paid in `Field` below: a draft string while
 * focused, committed on blur and Enter, and anything that is not a non-negative
 * number falls back to the last good value rather than raising an error nobody
 * can read mid-set.
 *
 * The weight steps by the exercise's own increment where its rule declares one,
 * because that is the granularity its plates actually come in (§29).
 */

import { useId, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  primaryAxisOf,
  shapeOf,
  targetsReps,
  weightMeaningOf,
  type Measurement,
  type SetField,
} from '@/domain/measurement';
import type { CompletedSet, ExerciseSession } from '@/domain/types';
import { DISTANCE_UNITS, UNITS, type DistanceUnit, type Unit } from '@/domain/units';
import { ICON_STROKE, LABEL, READOUT, READOUT_INPUT, STEPPER } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

/**
 * What the fields hold while a set is being entered.
 *
 * Every value is a number here, including the ones a given type does not
 * collect: a control that is not on screen still has to hold *something*, and
 * a nullable draft would put the absence in two places — the shape table and
 * the form state — free to disagree. `valuesFor` below is the one place the
 * projection to the domain's nulls happens, and it reads the shape table.
 */
export interface SetValues {
  readonly weight: number;
  /**
   * The unit the load in front of you is in.
   *
   * A fact about the set, not about the Exercise: the same movement is kilos on
   * one gym's plates and pounds on the next one's, and a lifter who travels
   * must be able to say so without editing their programme. The chain that
   * *opens* it is still the exercise's (`ExerciseView`) — this only holds what
   * the lifter chose from that opening, exactly as `distanceUnit` does.
   */
  readonly unit: Unit;
  readonly reps: number;
  readonly rir: number;
  readonly durationSeconds: number;
  /** The distance as entered, in `distanceUnit`. The metres are derived. */
  readonly distance: number;
  readonly distanceUnit: DistanceUnit;
}

/** What a set opens on before anything is known about it. */
export const EMPTY_VALUES: SetValues = {
  weight: 0,
  // Never what a screen shows: `openingValues` writes the exercise's own unit
  // over this before the form is rendered. It exists so the shape is complete.
  unit: 'kg',
  reps: 0,
  rir: 0,
  durationSeconds: 0,
  distance: 0,
  distanceUnit: 'm',
};

/**
 * The values a set of this type actually carries — everything else `null`
 * (REQ-106).
 *
 * The projection reads the shape table rather than guessing from which numbers
 * are non-zero: a plank held for zero seconds and a squat that collects no
 * seconds are different facts, and only the type tells them apart.
 */
export function valuesFor(
  measurement: Measurement,
  values: SetValues,
): {
  readonly weight: number;
  readonly reps: number | null;
  readonly durationSeconds: number | null;
  readonly distance: number | null;
  readonly distanceUnit: DistanceUnit | null;
} {
  const carries = (field: SetField): boolean => shapeOf(measurement).fields.includes(field);
  return {
    // `weight` stays required and non-null on the stored set (DER-1); a type
    // that collects none stores the zero every row already carries.
    weight: carries('weight') ? values.weight : 0,
    reps: carries('reps') ? values.reps : null,
    durationSeconds: carries('durationSeconds') ? values.durationSeconds : null,
    distance: carries('distance') ? values.distance : null,
    distanceUnit: carries('distance') ? values.distanceUnit : null,
  };
}

/** The values a logged set is corrected from — the mirror of `valuesFor`. */
export function valuesOf(set: CompletedSet): SetValues {
  return {
    weight: set.weight,
    unit: set.unit,
    reps: set.reps ?? 0,
    rir: set.rir,
    durationSeconds: set.durationSeconds ?? 0,
    distance: set.distance ?? 0,
    distanceUnit: set.distanceUnit ?? 'm',
  };
}

/**
 * Whether this set can be logged (REQ-110, AC-115).
 *
 * Per type, and read off the primary axis: a plank with no seconds and a jump
 * with no distance are as unfinished as a bench press with no reps.
 * `reps === 0` is no longer the universal guard — a plank held 30 seconds for
 * zero reps is a real set.
 */
export function isComplete(measurement: Measurement, values: SetValues): boolean {
  switch (primaryAxisOf(measurement)) {
    case 'reps':
      return values.reps > 0;
    case 'duration':
      return values.durationSeconds > 0;
    case 'distance':
      return values.distance > 0;
    // No type states its programme range on load or on pace, so neither is a
    // primary axis and neither is reachable.
    case 'load':
    case 'pace':
      return true;
  }
}

/** What the button says while the primary axis is still empty. */
export function missingAxis(measurement: Measurement): string {
  switch (primaryAxisOf(measurement)) {
    case 'duration':
      return 'Set the seconds first';
    case 'distance':
      return 'Set the distance first';
    default:
      return 'Set the reps first';
  }
}

/** What the weight field is called, for a type that collects one (REQ-109). */
function weightLabel(measurement: Measurement): string {
  switch (weightMeaningOf(measurement)) {
    case 'added':
      return 'added weight';
    case 'assisted':
      return 'assistance';
    default:
      return 'weight';
  }
}

/**
 * The window the programme asked for, per value — `null` where it asked for
 * nothing. Weight has none on purpose: §29 makes the load the thing that moves,
 * and a plan states reps and RIR, never a weight to hit.
 *
 * Read off the ExerciseSession's own snapshot, never through
 * `plannedExerciseId` (ADR 0002), so a routine edited mid-session cannot change
 * what the set in front of you was measured against.
 */
export interface SetTargets {
  /**
   * The window on the type's **target axis** — reps for a rep-axis type,
   * seconds or metres otherwise. Which of the two stored pairs it comes from
   * is decided by the measurement, never by testing which is non-null
   * (REQ-139).
   */
  readonly primary: readonly [number, number] | null;
  readonly rir: readonly [number, number] | null;
}

/** No plan, so nothing to deviate from — an unplanned exercise (FR-14). */
export const NO_TARGETS: SetTargets = { primary: null, rir: null };

/**
 * The targets an ExerciseSession carries. An unplanned exercise has none, and
 * RIR is optional even on a planned one: §32 lets a programme leave it unsaid,
 * and an unsaid range must not be drawn as a range you are outside of.
 */
export function targetsOf(exerciseSession: ExerciseSession): SetTargets {
  if (exerciseSession.plannedExerciseId === null) return NO_TARGETS;
  const {
    measurement,
    plannedMinReps,
    plannedMaxReps,
    plannedMinTarget,
    plannedMaxTarget,
    plannedMinRir,
    plannedMaxRir,
  } = exerciseSession;

  const [min, max] = targetsReps(measurement)
    ? [plannedMinReps, plannedMaxReps]
    : [plannedMinTarget, plannedMaxTarget];

  return {
    primary: min === null || max === null ? null : [min, max],
    rir:
      plannedMinRir === null || plannedMaxRir === null ? null : [plannedMinRir, plannedMaxRir],
  };
}

interface SetLoggerProps {
  readonly measurement: Measurement;
  readonly setNumber: number;
  readonly values: SetValues;
  readonly onChange: (values: SetValues) => void;
  /** The plate granularity of this exercise (§29), or 2.5 where none is declared. */
  readonly weightStep: number;
  readonly targets: SetTargets;
  readonly onComplete: () => void;
  readonly busy: boolean;
}

/**
 * The three numbers of a set, on their own.
 *
 * Extracted because a set is entered in two places — logging a new one and
 * correcting one already logged — and those must be the same control. Two
 * copies would be two chances for stepping, parsing and the zero floor to drift
 * apart on the screen a lifter uses one-handed.
 */
export function SetFields({
  measurement,
  values,
  onChange,
  weightStep,
  targets,
}: {
  readonly measurement: Measurement;
  readonly values: SetValues;
  readonly onChange: (values: SetValues) => void;
  readonly weightStep: number;
  readonly targets: SetTargets;
}) {
  const { fields } = shapeOf(measurement);
  const primary = primaryAxisOf(measurement);
  const collects = (field: SetField): boolean => fields.includes(field);
  // The window belongs to the target axis, so it marks whichever field that
  // axis is read from — reps for a squat, seconds for a plank (REQ-102).
  const windowFor = (axis: 'reps' | 'duration' | 'distance') =>
    primary === axis ? targets.primary : null;

  return (
    <>
      {collects('weight') && (
        <div className="flex items-stretch gap-2">
          <Field
            label={weightLabel(measurement)}
            onChange={(weight) => onChange({ ...values, weight })}
            step={weightStep}
            value={values.weight}
          />
          <UnitPicker
            label="Weight unit"
            onChange={(unit) => onChange({ ...values, unit })}
            units={UNITS}
            value={values.unit}
          />
        </div>
      )}

      {collects('durationSeconds') && (
        <div className="flex items-stretch gap-2">
          <Field
            label="seconds"
            onChange={(durationSeconds) => onChange({ ...values, durationSeconds })}
            step={5}
            target={windowFor('duration')}
            value={values.durationSeconds}
          />
        </div>
      )}

      {collects('distance') && (
        <div className="flex items-stretch gap-2">
          <Field
            label="distance"
            onChange={(distance) => onChange({ ...values, distance })}
            step={1}
            // The window is stated in canonical metres, so it only marks the
            // field while the field is reading metres.
            target={values.distanceUnit === 'm' ? windowFor('distance') : null}
            value={values.distance}
          />
          <UnitPicker
            label="Distance unit"
            onChange={(distanceUnit) => onChange({ ...values, distanceUnit })}
            units={DISTANCE_UNITS}
            value={values.distanceUnit}
          />
        </div>
      )}

      <div className="flex items-stretch gap-2">
        {collects('reps') && (
          <Field
            label="reps"
            onChange={(reps) => onChange({ ...values, reps })}
            step={1}
            target={windowFor('reps')}
            value={values.reps}
          />
        )}
        {/* RIR is asked of every type: §30 stores the RIR actually achieved and
            `effortOf` is the one cross-modal figure, blind to nothing (DEC-E). */}
        <Field
          label="RIR"
          onChange={(rir) => onChange({ ...values, rir })}
          step={1}
          target={targets.rir}
          value={values.rir}
        />
      </div>
    </>
  );
}

/**
 * Which unit the number beside it is in — kg or lb for a load, m, km or mi for
 * a distance (§11.7, REQ-107).
 *
 * Buttons rather than a select: DESIGN.md keeps a keypad and a native picker
 * off this screen, and a two- or three-way choice fits in the space one field
 * label occupies.
 *
 * **Switching never rewrites the number the lifter typed.** The canonical value
 * — `weightKg`, `distanceM` — is derived from whichever unit is chosen, so the
 * readout keeps saying what the plates and the treadmill say. That is the whole
 * job at a rack in a gym that stocks pounds: you are not converting 60 kg to
 * 132 lb, you are stating that the 60 in front of you was never kilos.
 */
function UnitPicker<U extends string>({
  label,
  units,
  value,
  onChange,
}: {
  readonly label: string;
  readonly units: readonly U[];
  readonly value: U;
  readonly onChange: (unit: U) => void;
}) {
  return (
    <div aria-label={label} className="flex flex-col justify-center gap-1" role="group">
      {units.map((unit) => (
        <button
          aria-pressed={unit === value}
          className={cn(
            STEPPER,
            'h-8 w-12 type-body-sm',
            unit === value ? 'text-ink ring-1 ring-actual' : 'text-ink-3',
          )}
          key={unit}
          onClick={() => onChange(unit)}
          type="button"
        >
          {unit}
        </button>
      ))}
    </div>
  );
}

export function SetLogger({
  measurement,
  setNumber,
  values,
  onChange,
  weightStep,
  targets,
  onComplete,
  busy,
}: SetLoggerProps) {
  // Nothing on the type's primary axis is the one combination that is not a
  // set. A load of zero is a bodyweight exercise and an RIR of zero is a set
  // taken to failure — both are real training and both stay loggable.
  const complete = isComplete(measurement, values);

  return (
    <section className="flex flex-col gap-3">
      <span className={LABEL}>set {setNumber}</span>

      <SetFields
        measurement={measurement}
        onChange={onChange}
        targets={targets}
        values={values}
        weightStep={weightStep}
      />

      <Button
        disabled={busy || !complete}
        onClick={onComplete}
        size="block"
        type="button"
        variant="primary"
      >
        <Check aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        {complete ? 'Complete set' : missingAxis(measurement)}
      </Button>
    </section>
  );
}

interface FieldProps {
  readonly label: string;
  readonly value: number;
  readonly step: number;
  /** The programme's window for this value, or `null` where it stated none. */
  readonly target?: readonly [number, number] | null;
  readonly onChange: (value: number) => void;
}

/**
 * Rounds to hundredths.
 *
 * Stepping by 2.5 repeatedly accumulates binary float dust — `77.50000000000001`
 * by the fourth press — and hundredths is fine enough to erase it while still
 * holding the 0.25 kg microplates a lifter can actually load. Tenths would round
 * those away.
 */
function normalize(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * One value, reachable two ways: stepped with the buttons, or typed into.
 *
 * The steppers are what a hand on a barbell wants, and they are still the
 * default path. But a jump from 20 to 90 is 28 presses, and at that point typing
 * is the humane answer — so the readout is the input rather than a second
 * control beside it. They edit one number and neither is authoritative.
 *
 * The typed value is held as a draft string while the field has focus, because
 * `62.` and `` are both states a number cannot represent but a person passes
 * through on the way to one. It commits on blur and on Enter; anything that is
 * not a non-negative number falls back to the last good value rather than
 * announcing an error nobody can read mid-set.
 */
function Field({ label, value, step, target, onChange }: FieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const hintId = useId();

  // Deviating is legitimate training (FR-14): the field says so and stays
  // editable. Nothing here disables a stepper, refuses a value or blocks the
  // green button — a lifter who got eight reps on a four-to-six set did eight
  // reps, and a log that argues with them is a log that gets falsified.
  const off = target !== null && target !== undefined && (value < target[0] || value > target[1]);

  const shift = (by: number) => {
    setDraft(null);
    onChange(Math.max(0, normalize(value + by)));
  };

  function commit() {
    if (draft === null) return;
    // A comma is what half the world's keypads produce for a decimal point.
    const parsed = Number(draft.trim().replace(',', '.'));
    if (draft.trim() !== '' && Number.isFinite(parsed) && parsed >= 0) {
      onChange(normalize(parsed));
    }
    setDraft(null);
  }

  return (
    <div className="flex flex-1 items-center gap-2">
      <button
        aria-label={`Decrease ${label}`}
        className={STEPPER}
        disabled={value === 0}
        onClick={() => shift(-step)}
        type="button"
      >
        <Minus aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
      </button>

      <label className={cn(READOUT, off && 'ring-1 ring-missed')}>
        <span className={LABEL}>
          {label}
          {/* The mark, and only the mark. The window itself is already in the
              header snapshot — `4×4–6 · RIR 1–2` — and repeating the numbers
              here put the same two figures on screen twice, three lines apart.
              What the header cannot say is whether the value in this field is
              inside them. */}
          {off && (
            <span className="text-missed-ink" id={hintId}>
              {' · off plan'}
            </span>
          )}
        </span>
        <input
          aria-describedby={off ? hintId : undefined}
          aria-label={label}
          className={READOUT_INPUT}
          // `decimal` rather than `numeric`: reps and RIR are whole, but weight
          // is not, and one keypad across the three beats three that differ.
          inputMode="decimal"
          onBlur={commit}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          value={draft ?? String(value)}
        />
      </label>

      <button
        aria-label={`Increase ${label}`}
        className={STEPPER}
        onClick={() => shift(step)}
        type="button"
      >
        <Plus aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
      </button>
    </div>
  );
}
