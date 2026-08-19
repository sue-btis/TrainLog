/**
 * One day in the month grid (§11.3).
 *
 * Two rules govern this component. Depth carries meaning — a recorded day is
 * sunk, a planned day is a raised dome with the planned ring, a rest day is a
 * cavity — and state is never carried by colour alone: `completed` and `missed`
 * are the pair a colour-blind lifter must still tell apart at arm's length, so
 * each takes a glyph, and every cell names its state in its accessible label.
 *
 * These cells are the one place DESIGN.md exempts from the 48 Rule: seven
 * columns will not fit a 390px viewport otherwise. They keep their separation,
 * and the day sheet they open is reachable from the keyboard, so they are never
 * the only route to a day.
 */

import { Check, CircleDot, X } from 'lucide-react';
import { parseLocalDate, type LocalDate } from '@/domain/dates';
import type { DayState } from '@/domain/scheduling';
import { FOCUS_RING, ICON_STROKE, PRESS } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

/** The order the legend reads in — planned, then what became of it. */
export const STATE_ORDER: readonly DayState[] = [
  'planned',
  'completed',
  'partial',
  'in_progress',
  'missed',
  'rest',
];

/** The product's own words for each state (CONTEXT.md). */
export const STATE_LABEL: Record<DayState, string> = {
  planned: 'planned',
  completed: 'completed',
  partial: 'partial',
  in_progress: 'training now',
  missed: 'missed',
  rest: 'rest',
};

const STATE_STYLE: Record<DayState, string> = {
  // A dome carrying the planned ring: marked, not yet filled — it has not happened.
  planned: 'bg-card text-planned-ink shadow-dome ring-2 ring-planned-wash ring-inset',
  completed: 'bg-actual-ink text-on-fill inset-shadow-sunk',
  partial: 'bg-actual-ink text-on-fill inset-shadow-sunk',
  in_progress: 'bg-live text-on-live shadow-dome-lift',
  missed: 'bg-missed-ink text-on-fill inset-shadow-sunk',
  rest: 'bg-well text-ink-3 inset-shadow-pressed',
};

interface DayCellProps {
  readonly date: LocalDate;
  readonly state: DayState;
  readonly inMonth: boolean;
  readonly isToday: boolean;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

export function DayCell({ date, state, inMonth, isToday, selected, onSelect }: DayCellProps) {
  const dayOfMonth = parseLocalDate(date).getDate();

  return (
    <button
      aria-label={`${date}, ${STATE_LABEL[state]}${isToday ? ', today' : ''}`}
      aria-pressed={selected}
      className={cn(
        'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-control',
        PRESS,
        FOCUS_RING,
        STATE_STYLE[state],
        !inMonth && 'opacity-40',
        isToday && 'ring-2 ring-live ring-offset-1 ring-offset-card',
        selected && 'ring-2 ring-planned ring-offset-1 ring-offset-card',
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="type-measure-sm">{dayOfMonth}</span>
      <Glyph state={state} />
    </button>
  );
}

/**
 * The non-colour half of the signal. Only the states that mean something get
 * one — a rest day is the absence of a mark, which is the honest rendering.
 */
function Glyph({ state }: { readonly state: DayState }) {
  const size = 12;
  switch (state) {
    case 'completed':
      return <Check aria-hidden="true" size={size} strokeWidth={2.5} />;
    case 'partial':
      return <CircleDot aria-hidden="true" size={size} strokeWidth={ICON_STROKE} />;
    case 'missed':
      return <X aria-hidden="true" size={size} strokeWidth={2.5} />;
    case 'in_progress':
      return <CircleDot aria-hidden="true" size={size} strokeWidth={2.5} />;
    case 'planned':
    case 'rest':
      return <span className="h-3" />;
  }
}
