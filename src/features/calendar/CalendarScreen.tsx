import { useState } from 'react';
import { CalendarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatLocalDate, type LocalDate } from '@/domain/dates';
import { tallyMonth, type DayState, type MonthTally } from '@/domain/scheduling';
import {
  usePlacementsBetween,
  useSessionsBetween,
  useWorkoutsById,
} from '@/features/data/queries';
import { DayPlan, DayRecord } from '@/features/calendar/DaySheet';
import { MonthGrid, firstOfMonth, monthGrid, sameMonth } from '@/features/calendar/MonthGrid';
import { Reading } from '@/features/ui/Reading';
import { ICON_STROKE, WELL } from '@/features/ui/styles';

export function CalendarScreen() {
  const today = formatLocalDate(new Date());
  const [month, setMonth] = useState<LocalDate>(() => firstOfMonth(today));
  const [selected, setSelected] = useState<LocalDate>(today);

  const grid = monthGrid(month);
  const first = grid[0] ?? month;
  const last = grid[grid.length - 1] ?? month;

  const monthPlacements = usePlacementsBetween(first, last);
  const monthSessions = useSessionsBetween(first, last);
  const reading = monthPlacements === undefined || monthSessions === undefined;

  const placements = monthPlacements ?? [];
  const sessions = monthSessions ?? [];
  const workouts = useWorkoutsById([
    ...placements.map((placement) => placement.workoutId),
    ...sessions.map((session) => session.workoutId),
  ]);

  const empty = placements.length === 0 && sessions.length === 0;

  // The readout speaks for the month it names, so it counts that month — not
  // the neighbouring days the grid borrows to fill its first and last rows.
  const tally = tallyMonth(
    placements.filter((placement) => sameMonth(placement.date, month)),
    sessions.filter((session) => sameMonth(formatLocalDate(new Date(session.startedAt)), month)),
    today,
  );

  function goToMonth(next: LocalDate) {
    setMonth(next);
    // Carry the selection into the month being shown, or the sheet would open
    // on a day the grid above it is not drawing.
    setSelected(sameMonth(today, next) ? today : next);
  }

  function followMove(date: LocalDate) {
    setMonth(firstOfMonth(date));
    setSelected(date);
  }

  return (
    <>
      <Card>
        <MonthGrid
          caption={
            <p className="text-center type-measure-sm text-ink-3">
              {reading ? 'reading…' : tallyLine(tally)}
            </p>
          }
          month={month}
          onMonthChange={goToMonth}
          onSelect={setSelected}
          placements={placements}
          selected={selected}
          sessions={sessions}
          today={today}
        />

        {firstOfMonth(today) !== month && (
          <Button
            className="self-center"
            onClick={() => goToMonth(firstOfMonth(today))}
            size="compact"
            type="button"
            variant="ghost"
          >
            Back to this month
          </Button>
        )}

        {/* The day a cell contains, inside the card that was pressed. */}
        {!empty && !reading && (
          <DayPlan
            date={selected}
            onMoved={followMove}
            placements={placements}
            sessions={sessions}
            today={today}
            workouts={workouts}
          />
        )}
      </Card>

      {reading ? (
        <Reading>this month</Reading>
      ) : empty ? (
        <section className={WELL}>
          <CalendarOff aria-hidden="true" className="text-ink-3" size={24} strokeWidth={ICON_STROKE} />
          <p className="type-title">Nothing planned this month</p>
          <p className="type-body-sm text-ink-2">
            Import a routine or build one, and the days it asks for land here.
          </p>
        </section>
      ) : (
        <DayRecord date={selected} sessions={sessions} workouts={workouts} />
      )}
    </>
  );
}

function tallyLine(tally: MonthTally): string {
  const parts: string[] = [];
  if (tally.planned > 0) parts.push(`${tally.kept}/${tally.planned} kept`);
  if (tally.missed > 0) parts.push(`${tally.missed} missed`);
  if (tally.upcoming > 0) parts.push(`${tally.upcoming} to come`);
  if (tally.unplanned > 0) parts.push(`${tally.unplanned} unplanned`);
  return parts.length === 0 ? 'nothing planned' : parts.join(' · ');
}

export type { DayState };
