/**
 * Calendar (§11.3).
 *
 * Two things overlaid: Placements, which are what the lifter planned, and
 * Sessions, which are what happened. They never reference each other
 * (ADR 0001), so the grid holds them side by side and derives each day's state
 * with `dayState` — including `missed`, which is a past Placement with no
 * Session and is never written down.
 *
 * The month reads across every Routine, not only the active one: a month can
 * span an archived programme, and the record does not stop being true when a
 * Routine is put away.
 *
 * **One object, and its record.** The screen used to be a grid, a legend
 * floating between cards, and a panel that appeared and vanished below them —
 * three surfaces with nothing binding them. The month, its tally and the day a
 * cell contains are now one card: pressing a cell changes a block behind a
 * hairline inside the very object that was pressed. What was *recorded* that
 * day is the one thing that keeps a card of its own, because a Session is not
 * something a calendar cell contains — it is what happened, and it outlives the
 * plan that asked for it.
 *
 * Moving a Placement belongs to the sheet, not to this screen: the sheet's own
 * `Move` opens a month attached to the button that asked for it
 * (`MoveToPopover`). This screen only hears where the Placement landed, and
 * follows it.
 *
 * **There is no colour key.** There was one, and it cost the screen a third of
 * a phone viewport to repeat what the screen already says in words: the rail
 * states the month ("7/13 kept · 2 missed"), the sheet names every entry on the
 * day you pressed ("missed", "kept", "completed"), and each cell carries a
 * glyph and an accessible label of its own. A legend that explains a signal the
 * signal already spells out is not an aid, it is the thing that pushed the
 * answer below the fold.
 */

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
  // A day is always selected — the ledger below always has somewhere to be, so
  // there is no "choose a day" placeholder standing in for a panel that is not
  // there yet.
  const [selected, setSelected] = useState<LocalDate>(today);

  const grid = monthGrid(month);
  const first = grid[0] ?? month;
  const last = grid[grid.length - 1] ?? month;

  // Held apart from the `?? []` below on purpose. Collapsing the read into an
  // empty array made a query still running indistinguishable from a month with
  // nothing in it, and the empty state does not hedge — it says "Nothing
  // planned this month" and offers to import a routine, over a calendar that
  // was about to draw one. `useLiveQuery` keeps its last result across a month
  // change, so this is the cold open and nothing else.
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

  /** Follow a moved Placement to where it landed, month included. */
  function followMove(date: LocalDate) {
    setMonth(firstOfMonth(date));
    setSelected(date);
  }

  return (
    <>
      <Card>
        <MonthGrid
          // The tally is the same sentence in miniature: "nothing planned"
          // under the month name, for a month whose Placements are in flight.
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
            Import a routine and the days it asks for land here.
          </p>
        </section>
      ) : (
        <DayRecord date={selected} sessions={sessions} workouts={workouts} />
      )}
    </>
  );
}

/**
 * The month in words: what it asked for, what answered, what is still ahead.
 *
 * Only the counts that are not zero, because "0 missed" is a sentence about
 * nothing, and a readout that always shows five figures stops being read.
 */
function tallyLine(tally: MonthTally): string {
  const parts: string[] = [];
  if (tally.planned > 0) parts.push(`${tally.kept}/${tally.planned} kept`);
  if (tally.missed > 0) parts.push(`${tally.missed} missed`);
  if (tally.upcoming > 0) parts.push(`${tally.upcoming} to come`);
  if (tally.unplanned > 0) parts.push(`${tally.unplanned} unplanned`);
  return parts.length === 0 ? 'nothing planned' : parts.join(' · ');
}

export type { DayState };
