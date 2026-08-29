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

export interface SetValues {
  readonly weight: number;
  readonly unit: Unit;
  readonly reps: number;
  readonly rir: number;
  readonly durationSeconds: number;
  readonly distance: number;
  readonly distanceUnit: DistanceUnit;
}

/** What a set opens on before anything is known about it. */
export const EMPTY_VALUES: SetValues = {
  weight: 0,
  unit: 'kg',
  reps: 0,
  rir: 0,
  durationSeconds: 0,
  distance: 0,
  distanceUnit: 'm',
};

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
    weight: carries('weight') ? values.weight : 0,
    reps: carries('reps') ? values.reps : null,
    durationSeconds: carries('durationSeconds') ? values.durationSeconds : null,
    distance: carries('distance') ? values.distance : null,
    distanceUnit: carries('distance') ? values.distanceUnit : null,
  };
}

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

export function isComplete(measurement: Measurement, values: SetValues): boolean {
  switch (primaryAxisOf(measurement)) {
    case 'reps':
      return values.reps > 0;
    case 'duration':
      return values.durationSeconds > 0;
    case 'distance':
      return values.distance > 0;
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

export interface SetTargets {
  readonly primary: readonly [number, number] | null;
  readonly rir: readonly [number, number] | null;
}

export const NO_TARGETS: SetTargets = { primary: null, rir: null };

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
  readonly weightStep: number;
  readonly targets: SetTargets;
  readonly onComplete: () => void;
  readonly busy: boolean;
}

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

function normalize(value: number): number {
  return Math.round(value * 100) / 100;
}

function Field({ label, value, step, target, onChange }: FieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const hintId = useId();

  const off = target !== null && target !== undefined && (value < target[0] || value > target[1]);

  const shift = (by: number) => {
    setDraft(null);
    onChange(Math.max(0, normalize(value + by)));
  };

  function commit() {
    if (draft === null) return;
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
