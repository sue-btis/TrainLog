import type { Measurement } from '@/domain/measurement';
import type { CompletedSet } from '@/domain/types';
import { setLine } from '@/features/ui/format';
import { chip } from '@/features/ui/styles';

export function SetPill({
  label,
  set,
  measurement,
}: {
  readonly label: string;
  readonly set: CompletedSet | null;
  /** How the exercise is measured — taken as a parameter, never inferred. */
  readonly measurement: Measurement;
}) {
  if (set === null) return null;
  return (
    <span className={chip('neutral')}>
      <span className="text-ink-3">{label}</span>
      <span className="text-ink">{setLine(set, measurement, true)}</span>
    </span>
  );
}
