/**
 * Correcting or removing a set already logged (R-4, §37).
 *
 * A set gets mistyped — the wrong load, a rep miscounted, the button pressed
 * twice. Before this, the only record of that was permanent, which made the
 * history slightly untrue and, through `weightKg`, moved what progression
 * suggested next.
 *
 * It reuses `SetFields`, the same control the logger uses, so a correction is
 * entered exactly the way the original was.
 *
 * Delete arms rather than fires (§37, DESIGN.md's destructive-armed pattern).
 * It stays red at rest — a control that removes something must be identifiable
 * before it is touched — and the second press names the consequence.
 */

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
  /**
   * The type the correction collects fields for — the same control the logger
   * uses, so a duration set is corrected in seconds and never in weight and
   * reps (REQ-111, AC-116).
   */
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
      {/* Delete sits up here, beside cancel — not under Save.
          The two used to be stacked full-width and adjacent: solid green
          "Save the correction" directly above solid red "Delete this set", both
          landing in the thumb zone, on a screen used with wet hands. The arming
          step catches the first mis-tap and nothing catches the second, so the
          answer is distance rather than another confirmation. */}
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
        // One `arrive` on the group, not three racing each other: the warning and
        // the two buttons that follow it are a single change of what this panel
        // is asking.
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
