/**
 * One day in the month grid (§11.3).
 *
 * Two rules govern this component. Depth carries meaning — a planned day is
 * raised because it is still ahead of you, and a recorded or rest day is flat
 * because it is settled — and state is never carried by colour alone:
 * `completed` and `missed`
 * are the pair a colour-blind lifter must still tell apart at arm's length, so
 * each takes a glyph, and every cell names its state in its accessible label.
 *
 * These cells are the one place DESIGN.md exempts from the 48 Rule: seven
 * columns will not fit a 390px viewport otherwise. They keep their separation,
 * and the day sheet they open is reachable from the keyboard, so they are never
 * the only route to a day.
 *
 * The grid is also the app's date picker. While a Placement is being moved
 * every cell becomes a target: it raises, because during a move every day *is*
 * pressable, and its label stops describing the day and starts naming what the
 * press will do. This is why there is no `<input type="date">` here — the month
 * the move is relative to is already on screen, and a native picker would cover
 * it to ask the question it answers.
 */

import { Check, CircleDot, X } from 'lucide-react';
import { parseLocalDate, type LocalDate } from '@/domain/dates';
import type { DayState } from '@/domain/scheduling';
import { longDate } from '@/features/ui/format';
import { FOCUS_RING, ICON_STROKE, PRESS } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

/** The product's own words for each state (CONTEXT.md). */
/**
 * What each day state is called — in the lifter's words, not the model's.
 *
 * `partial` was the stored enum reaching the screen: it is the one state whose
 * name explains nothing, and it is also the one carrying a consequence (the
 * session is left out of progression). This label and `sessionStatusLabel` say
 * the same thing about the same fact, deliberately.
 */
const STATE_LABEL: Record<DayState, string> = {
  planned: 'planned',
  completed: 'completed',
  partial: 'work left undone',
  in_progress: 'training now',
  missed: 'missed',
  rest: 'rest',
};

const STATE_STYLE: Record<DayState, string> = {
  // Raised means "you can still act on this"; flat means it already happened.
  planned: 'bg-card text-planned-ink shadow-dome ring-2 ring-planned-wash ring-inset',
  completed: 'bg-actual-ink text-on-fill',
  partial: 'bg-actual-ink text-on-fill',
  in_progress: 'bg-live text-on-live shadow-dome-lift',
  missed: 'bg-missed-ink text-on-fill',
  rest: 'bg-well text-ink-3',
};

interface DayCellProps {
  readonly date: LocalDate;
  readonly state: DayState;
  readonly inMonth: boolean;
  readonly isToday: boolean;
  readonly selected: boolean;
  /** What is being moved onto this day, while a move is running. */
  readonly moving: string | null;
  /** Whether this is the day the Placement being moved is leaving. */
  readonly origin: boolean;
  readonly onSelect: () => void;
}

export function DayCell({
  date,
  state,
  inMonth,
  isToday,
  selected,
  moving,
  origin,
  onSelect,
}: DayCellProps) {
  const dayOfMonth = parseLocalDate(date).getDate();

  return (
    <button
      aria-label={
        moving === null
          ? `${date}, ${STATE_LABEL[state]}${isToday ? ', today' : ''}`
          : origin
            ? `${longDate(date)}, where ${moving} already is`
            : `Move ${moving} to ${longDate(date)}`
      }
      aria-pressed={moving === null ? selected : undefined}
      className={cn(
        'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-control',
        PRESS,
        FOCUS_RING,
        STATE_STYLE[state],
        !inMonth && 'opacity-40',
        isToday && 'ring-2 ring-live ring-offset-1 ring-offset-card',
        selected && moving === null && 'ring-2 ring-planned ring-offset-1 ring-offset-card',
        // A move makes every day pressable, so every day is raised for its
        // duration — the Two-Position Rule stating a mode rather than a state.
        moving !== null && 'shadow-dome hover:-translate-y-0.5 hover:shadow-dome-lift',
        origin && 'ring-2 ring-planned ring-offset-1 ring-offset-card',
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
