import { Check, CircleDot, X } from 'lucide-react';
import { parseLocalDate, type LocalDate } from '@/domain/dates';
import type { DayState } from '@/domain/scheduling';
import { longDate } from '@/features/ui/format';
import { FOCUS_RING, ICON_STROKE, PRESS } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

const STATE_LABEL: Record<DayState, string> = {
  planned: 'planned',
  completed: 'completed',
  partial: 'work left undone',
  in_progress: 'training now',
  missed: 'missed',
  rest: 'rest',
};

const STATE_STYLE: Record<DayState, string> = {
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
  readonly moving: string | null;
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
