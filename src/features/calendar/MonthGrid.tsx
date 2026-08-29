import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  addDays,
  formatLocalDate,
  mondayOfWeek,
  parseLocalDate,
  toLocalDate,
  type LocalDate,
} from '@/domain/dates';
import { dayState } from '@/domain/scheduling';
import type { Placement, Session } from '@/domain/types';
import { DayCell } from '@/features/calendar/DayCell';
import { monthName } from '@/features/ui/format';
import { ICON_STROKE } from '@/features/ui/styles';

const WEEKDAY_INITIALS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface MonthGridProps {
  readonly month: LocalDate;
  readonly onMonthChange: (month: LocalDate) => void;
  readonly today: LocalDate;
  readonly selected: LocalDate | null;
  readonly placements: readonly Placement[];
  readonly sessions: readonly Session[];
  readonly onSelect: (date: LocalDate) => void;
  readonly caption?: ReactNode;
  readonly picking?: { readonly name: string; readonly from: LocalDate } | null;
}

export function MonthGrid({
  month,
  onMonthChange,
  today,
  selected,
  placements,
  sessions,
  onSelect,
  caption,
  picking = null,
}: MonthGridProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          aria-label="Previous month"
          onClick={() => onMonthChange(addMonths(month, -1))}
          size="icon"
          type="button"
          variant="nav"
        >
          <ChevronLeft aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
          <h2 className="text-center type-title">{monthName(month)}</h2>
          {caption}
        </div>
        <Button
          aria-label="Next month"
          onClick={() => onMonthChange(addMonths(month, 1))}
          size="icon"
          type="button"
          variant="nav"
        >
          <ChevronRight aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        </Button>
      </div>

      <div aria-hidden="true" className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_INITIALS.map((day) => (
          <span className="type-micro text-center text-ink-3" key={day}>
            {day}
          </span>
        ))}
      </div>

      {/* Each day is an independent button, so this is a labeled group rather than a keyboard grid. */}
      <div
        aria-label={monthName(month)}
        className="arrive grid grid-cols-7 gap-1.5"
        key={month}
        role="group"
      >
        {monthGrid(month).map((date) => (
          <DayCell
            date={date}
            inMonth={sameMonth(date, month)}
            isToday={date === today}
            key={date}
            moving={picking?.name ?? null}
            onSelect={() => onSelect(date)}
            origin={picking !== null && date === picking.from}
            selected={date === selected}
            state={dayState(placements, sessions, date, today)}
          />
        ))}
      </div>
    </>
  );
}


export function firstOfMonth(date: LocalDate): LocalDate {
  return toLocalDate(`${date.slice(0, 7)}-01`);
}

export function addMonths(date: LocalDate, offset: number): LocalDate {
  const day = parseLocalDate(date);
  day.setDate(1);
  day.setMonth(day.getMonth() + offset);
  return formatLocalDate(day);
}

export function sameMonth(date: LocalDate, month: LocalDate): boolean {
  return date.slice(0, 7) === month.slice(0, 7);
}

export function monthGrid(month: LocalDate): LocalDate[] {
  const start = mondayOfWeek(firstOfMonth(month));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}
