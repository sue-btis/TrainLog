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
