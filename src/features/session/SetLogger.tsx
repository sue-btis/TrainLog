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

import { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Unit } from '@/domain/units';
import { ICON_STROKE, LABEL, READOUT, READOUT_INPUT, STEPPER } from '@/features/ui/styles';

export interface SetValues {
  readonly weight: number;
  readonly reps: number;
  readonly rir: number;
}

interface SetLoggerProps {
  readonly setNumber: number;
  readonly values: SetValues;
  readonly onChange: (values: SetValues) => void;
  readonly unit: Unit;
  /** The plate granularity of this exercise (§29), or 2.5 where none is declared. */
  readonly weightStep: number;
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
}: {
  readonly values: SetValues;
  readonly onChange: (values: SetValues) => void;
  readonly unit: Unit;
  readonly weightStep: number;
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
          value={values.reps}
        />
        <Field
          label="RIR"
          onChange={(rir) => onChange({ ...values, rir })}
          step={1}
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
  onComplete,
  busy,
}: SetLoggerProps) {
  return (
    <section className="flex flex-col gap-3">
      <span className={LABEL}>set {setNumber}</span>

      <SetFields onChange={onChange} unit={unit} values={values} weightStep={weightStep} />

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
function Field({ label, value, step, unit, onChange }: FieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

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

      <label className={READOUT}>
        <span className={LABEL}>
          {label}
          {unit !== undefined && <span className="text-ink-3"> · {unit}</span>}
        </span>
        <input
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
