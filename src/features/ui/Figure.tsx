/**
 * One labelled figure — §11.10's readout unit: a quiet label over a value.
 *
 * It lived inside the Exercise History screen until the training screen wanted
 * the same block. Copying it would have left two definitions of what a readout
 * looks like, free to drift; this is the one both import.
 *
 * `compact` is the training screen's variant: three figures across a 390px
 * card, where the 30px readout would wrap `52.5 kg` onto two lines.
 *
 * `tone` exists for exactly one figure — a suggested load, which nobody
 * entered. DESIGN.md gives that Derived Violet, and it is the hue's whole
 * point that it is not spent on figures that were observed.
 */

import { LABEL } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function Figure({
  label,
  value,
  tone = 'ink',
  compact = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'ink' | 'progress';
  readonly compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL}>{label}</span>
      <span
        className={cn(
          compact ? 'type-title' : 'type-readout',
          tone === 'progress' ? 'text-progress-ink' : 'text-ink',
          'tabular-nums',
        )}
      >
        {value}
      </span>
    </div>
  );
}
