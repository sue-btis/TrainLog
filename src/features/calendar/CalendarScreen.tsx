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
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { CalendarOff, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deletePlacement, movePlacement } from '@/db';
import {
  addDays,
  formatLocalDate,
  isLocalDate,
  mondayOfWeek,
  parseLocalDate,
  toLocalDate,
  type LocalDate,
} from '@/domain/dates';
import type { WorkoutId } from '@/domain/ids';
import { dayState, type DayState } from '@/domain/scheduling';
import type { Placement, Session, Workout } from '@/domain/types';
import {
  usePlacementsBetween,
  useSessionsBetween,
  useWorkoutsById,
} from '@/features/data/queries';
import { longDate, monthName, plural } from '@/features/ui/format';
import { DayCell, STATE_LABEL, STATE_ORDER } from '@/features/calendar/DayCell';
import {
  ICON_STROKE,
  LABEL,
  PRESS,
  ROW,
  ROW_LIST,
  WELL,
  chip,
} from '@/features/ui/styles';
import { cn } from '@/lib/utils';

const WEEKDAY_INITIALS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function CalendarScreen() {
  const today = formatLocalDate(new Date());
  const [month, setMonth] = useState<LocalDate>(() => firstOfMonth(today));
  const [selected, setSelected] = useState<LocalDate | null>(null);

  const grid = monthGrid(month);
  const first = grid[0] ?? month;
  const last = grid[grid.length - 1] ?? month;

  const placements = usePlacementsBetween(first, last) ?? [];
  const sessions = useSessionsBetween(first, last) ?? [];
  const workouts = useWorkoutsById([
    ...placements.map((placement) => placement.workoutId),
    ...sessions.map((session) => session.workoutId),
  ]);

  const empty = placements.length === 0 && sessions.length === 0;

  function goToMonth(offset: number) {
    setSelected(null);
    setMonth(addMonths(month, offset));
  }

  return (
    <>
      <p className="type-lede text-ink-2">
        What you planned and what you did. A day nobody planned is rest, not a failure.
      </p>

      <Card>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Previous month"
            onClick={() => goToMonth(-1)}
            size="icon"
            type="button"
            variant="nav"
          >
            <ChevronLeft aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
          </Button>
          <h2 className="flex-1 text-center type-title">{monthName(month)}</h2>
          <Button
            aria-label="Next month"
            onClick={() => goToMonth(1)}
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

        <div className="grid grid-cols-7 gap-1.5" role="grid">
          {grid.map((date) => (
            <DayCell
              date={date}
              inMonth={sameMonth(date, month)}
              isToday={date === today}
              key={date}
              onSelect={() => setSelected(date === selected ? null : date)}
              selected={date === selected}
              state={dayState(placements, sessions, date, today)}
            />
          ))}
        </div>

        {firstOfMonth(today) !== month && (
          <Button
            className="self-center"
            onClick={() => {
              setSelected(null);
              setMonth(firstOfMonth(today));
            }}
            size="compact"
            type="button"
            variant="ghost"
          >
            Back to this month
          </Button>
        )}
      </Card>

      <Legend />

      {empty ? (
        <section className={WELL}>
          <CalendarOff aria-hidden="true" className="text-ink-3" size={24} strokeWidth={ICON_STROKE} />
          <p className="type-title">Nothing planned this month</p>
          <p className="type-body-sm text-ink-2">
            Placements are generated when you accept a routine import, and they are yours
            from that moment — move them or delete them freely.
          </p>
        </section>
      ) : selected === null ? (
        <section className={WELL}>
          <p className="type-body-sm text-ink-2">
            Choose a day to see what was planned for it and what happened.
          </p>
        </section>
      ) : (
        <DaySheet
          date={selected}
          onMoved={(moved) => {
            // Follow the Placement to where it landed, month included: a sheet
            // left on the day it just left is a question nobody asked.
            setMonth(firstOfMonth(moved));
            setSelected(moved);
          }}
          placements={placements.filter((placement) => placement.date === selected)}
          sessions={sessions.filter(
            (session) => formatLocalDate(new Date(session.startedAt)) === selected,
          )}
          workouts={workouts}
        />
      )}
    </>
  );
}

function Legend() {
  return (
    <section className="flex flex-wrap gap-2" aria-label="What the days mean">
      {STATE_ORDER.map((state) => (
        <span className={chip(state === 'completed' ? 'actual' : 'neutral')} key={state}>
          {STATE_LABEL[state]}
        </span>
      ))}
    </section>
  );
}

interface DaySheetProps {
  readonly date: LocalDate;
  readonly placements: readonly Placement[];
  readonly sessions: readonly Session[];
  readonly workouts: ReadonlyMap<WorkoutId, Workout> | undefined;
  readonly onMoved: (date: LocalDate) => void;
}

/**
 * What is on one day, and the two things §11.3 allows doing to a Placement.
 *
 * Inline rather than a modal: nothing here needs protected focus, and a sheet
 * that covers the grid hides the very thing the move is relative to.
 */
function DaySheet({ date, placements, sessions, workouts, onMoved }: DaySheetProps) {
  const nameOf = (workoutId: WorkoutId): string => workouts?.get(workoutId)?.name ?? '…';

  return (
    <Card>
      <h2 className="type-title">{longDate(date)}</h2>

      {placements.length === 0 && sessions.length === 0 ? (
        <p className="type-body-sm text-ink-2">Nothing planned, nothing recorded. A rest day.</p>
      ) : (
        <div className={ROW_LIST}>
          {placements.map((placement) => (
            <PlacementRow
              key={placement.id}
              name={nameOf(placement.workoutId)}
              onMoved={onMoved}
              placement={placement}
            />
          ))}
          {sessions.map((session) => (
            <SessionRow key={session.id} name={nameOf(session.workoutId)} session={session} />
          ))}
        </div>
      )}
    </Card>
  );
}

interface PlacementRowProps {
  readonly placement: Placement;
  readonly name: string;
  readonly onMoved: (date: LocalDate) => void;
}

function PlacementRow({ placement, name, onMoved }: PlacementRowProps) {
  const [confirming, setConfirming] = useState(false);
  const moveId = `move-${placement.id}`;

  return (
    <article className={cn(ROW, 'gap-3')}>
      <div className="flex items-center gap-2">
        <span className={chip('planned')}>planned</span>
        <span className="min-w-0 flex-1 truncate type-title">{name}</span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor={moveId}>move to</Label>
          <Input
            className="type-measure"
            id={moveId}
            onChange={(event) => {
              const next = event.target.value;
              if (!isLocalDate(next)) return; // a half-typed date is not a date
              const date = toLocalDate(next);
              void movePlacement(placement.id, date).then(() => onMoved(date));
            }}
            type="date"
            value={placement.date}
          />
        </div>

        <div className="flex items-center gap-2">
          {confirming && (
            <Button
              onClick={() => setConfirming(false)}
              size="compact"
              type="button"
              variant="quiet"
            >
              Keep it
            </Button>
          )}
          <Button
            aria-label={confirming ? `Confirm deleting the ${name} placement` : `Delete the ${name} placement`}
            className={confirming ? 'shadow-none' : undefined}
            onClick={() => {
              if (confirming) void deletePlacement(placement.id);
              else setConfirming(true);
            }}
            size="compact"
            type="button"
            variant="danger"
          >
            <Trash2 aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            {confirming ? 'Delete it' : 'Delete'}
          </Button>
        </div>
      </div>

      {confirming && (
        <p className={LABEL}>this removes the plan for that day — any session you recorded stays</p>
      )}
    </article>
  );
}

function SessionRow({ session, name }: { readonly session: Session; readonly name: string }) {
  const started = new Date(session.startedAt);
  const tone: Parameters<typeof chip>[0] =
    session.status === 'completed' ? 'actual' : session.status === 'partial' ? 'missed' : 'neutral';

  // A recorded session opens its own detail: the calendar says one happened,
  // and the next question is always what was in it.
  return (
    <Link className={cn(ROW, PRESS, 'rounded-field')} to={`/sessions/${session.id}`}>
      <div className="flex items-center gap-2">
        <span className={chip(tone)}>{session.status.replace('_', ' ')}</span>
        <span className="min-w-0 flex-1 truncate type-title">{name}</span>
        <ChevronRight aria-hidden="true" className="text-ink-3" size={18} strokeWidth={ICON_STROKE} />
      </div>
      <p className="type-measure-sm text-ink-3">
        started {started.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        {session.completedAt !== null &&
          ` · ${plural(Math.max(1, Math.round((session.completedAt - session.startedAt) / 60000)), 'min')}`}
      </p>
    </Link>
  );
}

/* ── Month arithmetic ───────────────────────────────────────────────────── */

function firstOfMonth(date: LocalDate): LocalDate {
  return toLocalDate(`${date.slice(0, 7)}-01`);
}

function addMonths(date: LocalDate, offset: number): LocalDate {
  const day = parseLocalDate(date);
  day.setDate(1);
  day.setMonth(day.getMonth() + offset);
  return formatLocalDate(day);
}

function sameMonth(date: LocalDate, month: LocalDate): boolean {
  return date.slice(0, 7) === month.slice(0, 7);
}

/**
 * The six weeks a month grid always shows, Monday first: the whole month plus
 * the neighbouring days that fill its first and last rows. A fixed length keeps
 * the grid from changing height as the months are paged through.
 */
function monthGrid(month: LocalDate): LocalDate[] {
  const start = mondayOfWeek(firstOfMonth(month));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export type { DayState };
