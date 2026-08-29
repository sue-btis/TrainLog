import { useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Measurement } from '@/domain/measurement';
import type { CompletedSet } from '@/domain/types';
import {
  isComplete,
  missingAxis,
  SetFields,
  valuesOf,
  type SetTargets,
  type SetValues,
} from '@/features/session/SetLogger';
import { ICON_STROKE, LABEL } from '@/features/ui/styles';

interface SetEditorProps {
  readonly set: CompletedSet;
  readonly measurement: Measurement;
  readonly weightStep: number;
  /** The same windows the logger marks against — a correction is measured by
      the plan too, or the marking would vanish the moment you fixed a typo. */
  readonly targets: SetTargets;
  readonly onSave: (values: SetValues) => void;
  readonly onDelete: () => void;
  readonly onCancel: () => void;
  readonly busy: boolean;
}

export function SetEditor({
  set,
  measurement,
  weightStep,
  targets,
  onSave,
  onDelete,
  onCancel,
  busy,
}: SetEditorProps) {
  const [values, setValues] = useState<SetValues>(() => valuesOf(set));
  const [armed, setArmed] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className={LABEL}>editing set {set.setNumber}</span>
        <div className="flex items-center gap-1">
          {!armed && (
            <Button
              aria-label={`Delete set ${set.setNumber}`}
              disabled={busy}
              onClick={() => setArmed(true)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            </Button>
          )}
          <Button aria-label="Cancel" onClick={onCancel} size="icon" type="button" variant="ghost">
            <X aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
          </Button>
        </div>
      </div>

      <SetFields
        measurement={measurement}
        onChange={setValues}
        targets={targets}
        values={values}
        weightStep={weightStep}
      />

      {armed ? (
        <div className="arrive flex flex-col gap-3">
          <p className="type-body-sm text-ink-2">
            Set {set.setNumber} goes for good, and the sets after it move up a place.
          </p>
          <Button disabled={busy} onClick={onDelete} size="block" type="button" variant="danger">
            Delete it
          </Button>
          <Button
            disabled={busy}
            onClick={() => setArmed(false)}
            size="block"
            type="button"
            variant="quiet"
          >
            Keep it
          </Button>
        </div>
      ) : (
        <Button
          disabled={busy || !isComplete(measurement, values)}
          onClick={() => onSave(values)}
          size="block"
          type="button"
          variant="primary"
        >
          <Check aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
          {isComplete(measurement, values) ? 'Save the correction' : missingAxis(measurement)}
        </Button>
      )}
    </section>
  );
}
