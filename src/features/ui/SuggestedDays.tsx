/**
 * Choosing the weekdays a Workout is authored to fall on (§12).
 *
 * One control, because there are two places that ask — step 2 of the wizard,
 * and adding a Workout to a Routine already running — and they were asking
 * differently. The wizard used a four-column grid of short mono labels at 48px.
 * The Routine screen used seven full-name pills that wrapped into three ragged
 * rows of 74–113px on a 390px phone, for the same seven-way choice, two taps
 * apart in the same product.
 *
 * A conflicted day reads red rather than blue. Both callers know about clashes
 * — the wizard from `suggested_day_shared`, the Routine form from
 * `claimantsOfDay` — and neither refuses one: a shared day is a warning, and
 * the prose beside it owes the lifter the consequence. This only marks which
 * day the prose is about.
 *
 * `Suggested Day` is advisory and read once, when the Workout enters a Routine,
 * to seed Placements (CONTEXT.md). Nothing here is the schedule.
 */

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
  /** The group's accessible name. Shown above it when `showLabel`. */
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
  /** The error line the group points at, when the caller renders one. */
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
        // The caption above was a loose `<span>` next to seven `aria-pressed`
        // buttons that named nothing: the group had no accessible name at all.
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
