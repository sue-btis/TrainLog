import { useId } from 'react';
import type { Weekday } from '@/domain/types';
import { weekdayName } from '@/features/ui/format';
import { FOCUS_RING, LABEL, PRESS } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

const WEEKDAYS: readonly { readonly day: Weekday; readonly short: string }[] = [
  { day: 'monday', short: 'mon' },
  { day: 'tuesday', short: 'tue' },
  { day: 'wednesday', short: 'wed' },
  { day: 'thursday', short: 'thu' },
  { day: 'friday', short: 'fri' },
  { day: 'saturday', short: 'sat' },
  { day: 'sunday', short: 'sun' },
];

interface SuggestedDaysProps {
  readonly label: string;
  /**
   * Whether that name is also drawn. The wizard's card already carries the
   * Workout's name as a heading, so a visible caption there would say it twice;
   * a bare form has nothing else naming the group and needs one.
   */
  readonly showLabel?: boolean;
  readonly selected: readonly Weekday[];
  readonly onToggle: (day: Weekday) => void;
  /** A chosen day another Workout also claims. Marked, never refused. */
  readonly conflicted?: (day: Weekday) => boolean;
  readonly describedBy?: string;
}

export function SuggestedDays({
  label,
  showLabel = false,
  selected,
  onToggle,
  conflicted,
  describedBy,
}: SuggestedDaysProps) {
  const labelId = useId();

  return (
    <div className="flex flex-col gap-2">
      {showLabel && (
        <span className={LABEL} id={labelId}>
          {label}
        </span>
      )}
      <div
        aria-describedby={describedBy}
        aria-label={showLabel ? undefined : label}
        aria-labelledby={showLabel ? labelId : undefined}
        className="grid grid-cols-4 gap-2"
        role="group"
      >
        {WEEKDAYS.map(({ day, short }) => {
          const on = selected.includes(day);
          const clashing = on && conflicted !== undefined && conflicted(day);
          return (
            <button
              aria-label={weekdayName(day)}
              aria-pressed={on}
              className={cn(
                'flex min-h-12 items-center justify-center rounded-control type-label',
                PRESS,
                FOCUS_RING,
                clashing
                  ? 'bg-missed-ink text-on-fill'
                  : on
                    ? 'bg-planned-ink text-on-fill'
                    : 'bg-card text-ink-3 shadow-dome hover:shadow-dome-lift',
              )}
              key={day}
              onClick={() => onToggle(day)}
              type="button"
            >
              {short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
