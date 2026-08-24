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
import type { ExerciseSession } from '@/domain/types';
import type { Unit } from '@/domain/units';
import { ICON_STROKE, LABEL, READOUT, READOUT_INPUT, STEPPER } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export interface SetValues {
  readonly weight: number;
  readonly reps: number;
  readonly rir: number;
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
  readonly reps: readonly [number, number] | null;
  readonly rir: readonly [number, number] | null;
}

/** No plan, so nothing to deviate from — an unplanned exercise (FR-14). */
export const NO_TARGETS: SetTargets = { reps: null, rir: null };

/**
 * The targets an ExerciseSession carries. An unplanned exercise has none, and
 * RIR is optional even on a planned one: §32 lets a programme leave it unsaid,
 * and an unsaid range must not be drawn as a range you are outside of.
 */
export function targetsOf(exerciseSession: ExerciseSession): SetTargets {
  if (exerciseSession.plannedExerciseId === null) return NO_TARGETS;
  const { plannedMinReps, plannedMaxReps, plannedMinRir, plannedMaxRir } = exerciseSession;
  return {
    reps: [plannedMinReps, plannedMaxReps],
    rir:
      plannedMinRir === null || plannedMaxRir === null ? null : [plannedMinRir, plannedMaxRir],
  };
}

interface SetLoggerProps {
  readonly setNumber: number;
  readonly values: SetValues;
  readonly onChange: (values: SetValues) => void;
  readonly unit: Unit;
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
  values,
  onChange,
  unit,
  weightStep,
  targets,
}: {
  readonly values: SetValues;
  readonly onChange: (values: SetValues) => void;
  readonly unit: Unit;
  readonly weightStep: number;
  readonly targets: SetTargets;
}) {
  return (
    <>
      <div className="flex items-stretch gap-2">
        <Field
          label="weight"
          onChange={(weight) => onChange({ ...values, weight })}
          step={weightStep}
          unit={unit}
          value={values.weight}
        />
      </div>

      <div className="flex items-stretch gap-2">
        <Field
          label="reps"
          onChange={(reps) => onChange({ ...values, reps })}
          step={1}
          target={targets.reps}
          value={values.reps}
        />
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

export function SetLogger({
  setNumber,
  values,
  onChange,
  unit,
  weightStep,
  targets,
  onComplete,
  busy,
}: SetLoggerProps) {
  return (
    <section className="flex flex-col gap-3">
      <span className={LABEL}>set {setNumber}</span>

      <SetFields
        onChange={onChange}
        targets={targets}
        unit={unit}
        values={values}
        weightStep={weightStep}
      />

      {/* Zero reps is the one combination that is not a set. A load of zero is
          a bodyweight exercise and an RIR of zero is a set taken to failure —
          both are real training and both stay loggable. */}
      <Button
        disabled={busy || values.reps === 0}
        onClick={onComplete}
        size="block"
        type="button"
        variant="primary"
      >
        <Check aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        {values.reps === 0 ? 'Set the reps first' : 'Complete set'}
      </Button>
    </section>
  );
}

interface FieldProps {
  readonly label: string;
  readonly value: number;
  readonly step: number;
  readonly unit?: Unit;
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
function Field({ label, value, step, unit, target, onChange }: FieldProps) {
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
          {unit !== undefined && <span className="text-ink-3"> · {unit}</span>}
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
          aria-label={unit === undefined ? label : `${label} in ${unit}`}
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
