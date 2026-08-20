/**
 * The set a lifter is about to perform (§11.5 "Current Session", §20).
 *
 * Three readouts and one green button, and that is deliberately all: §21 says
 * nothing that does not contribute to the current set may compete with it.
 *
 * Adjustment is by steppers, never by keyboard (DESIGN.md §Inputs). One hand is
 * occupied, the phone is on a bench, and a numeric keypad over the bottom half
 * of the screen is the worst possible thing to put between a lifter and the
 * button they came here to press. It also means there is no text to parse and
 * nothing to validate: a value that can only be reached by stepping is always a
 * number, and the steppers themselves are what enforce the floor.
 *
 * The weight steps by the exercise's own increment where its rule declares one,
 * because that is the granularity its plates actually come in (§29).
 */

import { Check, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Unit } from '@/domain/units';
import { ICON_STROKE, LABEL, READOUT, STEPPER } from '@/features/ui/styles';

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
 * One readout between its two steppers.
 *
 * The floor is zero for every one of the three. A negative load, a negative rep
 * and a negative RIR are all meaningless, and refusing to step below zero is a
 * cheaper way to say so than an error message nobody can read at arm's length.
 *
 * The arithmetic is done in tenths so a 2.5 step does not accumulate binary
 * float dust into `77.50000000000001` on the fourth press.
 */
function Field({ label, value, step, unit, onChange }: FieldProps) {
  const shift = (by: number) => onChange(Math.max(0, Math.round((value + by) * 10) / 10));

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

      <div className={READOUT}>
        <span className={LABEL}>{label}</span>
        <span className="type-readout text-ink">
          {value}
          {unit !== undefined && <span className="type-body-sm text-ink-3"> {unit}</span>}
        </span>
      </div>

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
