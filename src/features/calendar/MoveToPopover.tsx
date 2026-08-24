/**
 * Where a Placement goes (§11.3) — the Move control and the month it opens.
 *
 * Three answers were tried for this one question. A native `<input type="date">`
 * was the first: correct and accessible, and the only control in the product
 * wearing the operating system's face instead of this one, opening a picker
 * that covered the very month the move is relative to. A mode on the calendar's
 * own grid was the second: it read well, but the grid is the top of the screen
 * and the Placement is not, so pressing `Move` moved the lifter before it moved
 * anything else.
 *
 * This is the third. The picker is attached to the button that asked for it,
 * and it is the same month grid the screen already draws — so the day states
 * are visible while choosing, and nothing on the page has to scroll or change
 * mode. shadcn (Radix) supplies the part worth taking: positioning inside the
 * viewport, the portal that stops the card from clipping it, focus returned to
 * the trigger, Escape and outside-press to dismiss.
 */

import { useState } from 'react';
import { ArrowLeftRight, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { movePlacement } from '@/db';
import type { LocalDate } from '@/domain/dates';
import type { Placement } from '@/domain/types';
import { usePlacementsBetween, useSessionsBetween } from '@/features/data/queries';
import { MonthGrid, firstOfMonth, monthGrid } from '@/features/calendar/MonthGrid';
import { useAsyncAction } from '@/features/ui/useAsyncAction';
import { ICON_STROKE, LABEL } from '@/features/ui/styles';

interface MoveToPopoverProps {
  readonly placement: Placement;
  readonly name: string;
  readonly today: LocalDate;
  /** The screen follows the Placement to where it landed. */
  readonly onMoved: (date: LocalDate) => void;
  readonly disabled?: boolean;
}

export function MoveToPopover({
  placement,
  name,
  today,
  onMoved,
  disabled = false,
}: MoveToPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={`Move the ${name} placement to another day`}
          disabled={disabled}
          size="compact"
          type="button"
          variant="secondary"
        >
          <ArrowLeftRight aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          Move
        </Button>
      </PopoverTrigger>

      {/* Mounted only while open, so the month it reads is only queried while
          somebody is looking at it. */}
      <PopoverContent aria-label={`Move ${name} to another day`}>
        <MonthPicker
          name={name}
          onPicked={(date) => {
            setOpen(false);
            onMoved(date);
          }}
          placement={placement}
          today={today}
        />
      </PopoverContent>
    </Popover>
  );
}

interface MonthPickerProps {
  readonly placement: Placement;
  readonly name: string;
  readonly today: LocalDate;
  readonly onPicked: (date: LocalDate) => void;
}

function MonthPicker({ placement, name, today, onPicked }: MonthPickerProps) {
  const [month, setMonth] = useState<LocalDate>(() => firstOfMonth(placement.date));
  const { busy, failure, run } = useAsyncAction();

  const grid = monthGrid(month);
  const placements = usePlacementsBetween(grid[0] ?? month, grid[grid.length - 1] ?? month) ?? [];
  const sessions = useSessionsBetween(grid[0] ?? month, grid[grid.length - 1] ?? month) ?? [];

  return (
    <div className="flex w-[19rem] max-w-full flex-col gap-3">
      <p className={LABEL}>move {name} to</p>

      <MonthGrid
        month={month}
        onMonthChange={setMonth}
        onSelect={(date) => {
          // The day it is already on is the way out that needs no button.
          if (date === placement.date) return onPicked(date);
          void run(async () => {
            await movePlacement(placement.id, date);
            onPicked(date);
          });
        }}
        picking={{ name, from: placement.date }}
        placements={placements}
        selected={placement.date}
        sessions={sessions}
        today={today}
      />

      {busy && (
        <p className="flex items-center gap-2 type-body-sm text-ink-2">
          <LoaderCircle aria-hidden="true" className="animate-spin" size={16} strokeWidth={ICON_STROKE} />
          Moving it now.
        </p>
      )}

      {failure !== null && (
        <p className="type-body-sm text-missed-ink" role="alert">
          {failure}
        </p>
      )}
    </div>
  );
}
