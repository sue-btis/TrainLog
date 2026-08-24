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
import type { CompletedSet } from '@/domain/types';
import type { Unit } from '@/domain/units';
import { SetFields, type SetValues } from '@/features/session/SetLogger';
import { ICON_STROKE, LABEL } from '@/features/ui/styles';

interface SetEditorProps {
  readonly set: CompletedSet;
  readonly weightStep: number;
  readonly onSave: (values: SetValues, unit: Unit) => void;
  readonly onDelete: () => void;
  readonly onCancel: () => void;
  readonly busy: boolean;
}

export function SetEditor({
  set,
  weightStep,
  onSave,
  onDelete,
  onCancel,
  busy,
}: SetEditorProps) {
  const [values, setValues] = useState<SetValues>({
    weight: set.weight,
    reps: set.reps,
    rir: set.rir,
  });
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
        onChange={setValues}
        unit={set.unit}
        values={values}
        weightStep={weightStep}
      />

      {armed ? (
        <>
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
        </>
      ) : (
        <Button
          disabled={busy || values.reps === 0}
          onClick={() => onSave(values, set.unit)}
          size="block"
          type="button"
          variant="primary"
        >
          <Check aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
          {values.reps === 0 ? 'Set the reps first' : 'Save the correction'}
        </Button>
      )}
    </section>
  );
}
