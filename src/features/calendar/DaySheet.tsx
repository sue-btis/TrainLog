/**
 * The day you selected, and only that day (§11.3).
 *
 * The grid above is the index and the selector; this is what one of its cells
 * contains. Listing the whole month here was tried and thrown out: a month of
 * days is a wall you scroll past twice to reach the one you pressed, and every
 * upcoming day printed the same two buttons again. One cell, one answer,
 * directly under the cell that asked.
 *
 * **The plan lives inside the calendar; the record is its own card.** They are
 * separate entities that never reference each other (ADR 0001), so one list
 * holding both said the opposite. But a Placement is not separate from the
 * grid — it *is* what a cell contains, so `DayPlan` sits in the calendar's own
 * card, below the month behind a hairline (DESIGN.md: a block set off from what
 * precedes it takes a single `border-t`, never a second surface). Pressing a
 * cell changes what that block holds, inside the object that was pressed.
 *
 * `DayRecord` is the card underneath, and it appears only when something was
 * recorded. An absent card is the honest rendering of a day nothing happened
 * on; it is never an empty box saying zero.
 *
 * Inside both, entries are rows divided by a hairline. Cards do not nest
 * (DESIGN.md §Cards), so no row carries a surface of its own.
 *
 * A Placement its Session already answered still appears, chipped `kept` rather
 * than `planned`: on the day you deliberately opened, the plan behind the
 * record is information, and it is the only place its controls are any use.
 *
 * `Move` opens its own month, attached to the button (`MoveToPopover`), so the
 * question is asked and answered in one place without the screen changing mode
 * or scrolling anywhere.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, LoaderCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { deletePlacement } from '@/db';
import { formatLocalDate, type LocalDate } from '@/domain/dates';
import type { WorkoutId } from '@/domain/ids';
import { placementState, type PlacementState } from '@/domain/scheduling';
import type { Placement, Session, Workout } from '@/domain/types';
import { longDate, plural, sessionStatusLabel } from '@/features/ui/format';
import { MoveToPopover } from '@/features/calendar/MoveToPopover';
import { useAsyncAction } from '@/features/ui/useAsyncAction';
import {
  FOCUS_RING,
  ICON_STROKE,
  LABEL,
  PRESS,
  ROW,
  ROW_LIST,
  RULED,
  chip,
} from '@/features/ui/styles';
import { cn } from '@/lib/utils';

interface DayProps {
  readonly today: LocalDate;
  /** The day the grid has selected. There is always one. */
  readonly date: LocalDate;
  readonly placements: readonly Placement[];
  readonly sessions: readonly Session[];
  readonly workouts: ReadonlyMap<WorkoutId, Workout> | undefined;
  /** Where a moved Placement landed, so the screen can follow it. */
  readonly onMoved: (date: LocalDate) => void;
}

/** What is planned for the selected day. Renders inside the calendar's card. */
export function DayPlan({ today, date, placements, sessions, workouts, onMoved }: DayProps) {
  const onDay = placements.filter((placement) => placement.date === date);
  const trained = sessionsOn(sessions, date).length > 0;

  return (
    <section aria-label={`What is planned for ${longDate(date)}`} className={RULED}>
      <div className="flex flex-row items-baseline gap-2">
        <h3 className="type-title">{longDate(date)}</h3>
        {date === today && <span className="type-label text-live-ink">today</span>}
      </div>

      {onDay.length === 0 ? (
        <p className="type-body-sm text-ink-2">
          {trained
            ? 'Nothing was planned for this day.'
            : 'Nothing planned, nothing recorded. A rest day.'}
        </p>
      ) : (
        <div className={ROW_LIST}>
          {onDay.map((placement) => (
            <PlacementRow
              key={placement.id}
              name={workouts?.get(placement.workoutId)?.name ?? '…'}
              onMoved={onMoved}
              placement={placement}
              today={today}
              // The grid above already draws this day red with an X and tells a
              // screen reader "missed". One definition decides both, so the
              // block cannot contradict the cell it hangs under.
              state={placementState(placement, sessions, today)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type DayRecordProps = Pick<DayProps, 'date' | 'sessions' | 'workouts'>;

/** What was actually recorded on the selected day, or nothing at all. */
export function DayRecord({ date, sessions, workouts }: DayRecordProps) {
  const recorded = sessionsOn(sessions, date);
  if (recorded.length === 0) return null;

  return (
    <Card asChild>
      <section aria-label={`What was recorded on ${longDate(date)}`}>
        <CardHeader>
          <h2 className="type-title">{plural(recorded.length, 'session')} recorded</h2>
        </CardHeader>

        <div className={ROW_LIST}>
          {recorded.map((session) => (
            <SessionRow
              key={session.id}
              name={workouts?.get(session.workoutId)?.name ?? '…'}
              session={session}
            />
          ))}
        </div>
      </section>
    </Card>
  );
}

/** A Session belongs to the local day it started on, never its UTC one. */
function sessionsOn(sessions: readonly Session[], date: LocalDate): readonly Session[] {
  return sessions.filter((session) => formatLocalDate(new Date(session.startedAt)) === date);
}

/* ── The plan: it still has controls, because it is still yours ────────── */

/** Blue is what the programme said; a Placement it answered is done being blue. */
const PLACEMENT_CHIP: Record<PlacementState, Parameters<typeof chip>[0]> = {
  planned: 'planned',
  kept: 'neutral',
  missed: 'missed',
};

interface PlacementRowProps {
  readonly state: PlacementState;
  readonly placement: Placement;
  readonly name: string;
  readonly today: LocalDate;
  readonly onMoved: (date: LocalDate) => void;
}

function PlacementRow({ placement, name, state, today, onMoved }: PlacementRowProps) {
  const [confirming, setConfirming] = useState(false);
  // Per row rather than per screen: the row being deleted is the only one that
  // has anything to wait for, and a refusal belongs beside the Placement it
  // refused rather than at the top of a month.
  const { busy, failure, run } = useAsyncAction();

  return (
    <article className={cn(ROW, 'gap-3')}>
      <div className="flex items-center gap-2">
        <span className={chip(PLACEMENT_CHIP[state])}>{state}</span>
        <span className="min-w-0 flex-1 truncate type-title">{name}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MoveToPopover
          disabled={busy}
          name={name}
          onMoved={onMoved}
          placement={placement}
          today={today}
        />

        <div className="ml-auto flex items-center gap-2">
          {confirming && (
            <Button
              className="arrive"
              disabled={busy}
              onClick={() => setConfirming(false)}
              size="compact"
              type="button"
              variant="quiet"
            >
              Keep it
            </Button>
          )}
          <Button
            aria-label={
              confirming ? `Confirm deleting the ${name} placement` : `Delete the ${name} placement`
            }
            className={confirming ? 'shadow-none' : undefined}
            disabled={busy}
            onClick={() => {
              if (confirming) void run(() => deletePlacement(placement.id));
              else setConfirming(true);
            }}
            size="compact"
            type="button"
            variant="danger"
          >
            {busy ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={18} strokeWidth={ICON_STROKE} />
            ) : (
              <Trash2 aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            )}
            {confirming ? 'Delete it' : 'Delete'}
          </Button>
        </div>
      </div>

      {confirming && (
        <p className={cn(LABEL, 'arrive')}>
          this removes the plan for that day — any session you recorded stays
        </p>
      )}

      {failure !== null && (
        <p className="arrive type-body-sm text-missed-ink" role="alert">
          {failure}
        </p>
      )}
    </article>
  );
}

/* ── The record: a time, a duration and a way in ───────────────────────── */

function SessionRow({ session, name }: { readonly session: Session; readonly name: string }) {
  const started = new Date(session.startedAt);
  const tone: Parameters<typeof chip>[0] =
    session.status === 'completed' ? 'actual' : session.status === 'partial' ? 'missed' : 'neutral';

  // A recorded session opens its own detail: the calendar says one happened,
  // and the next question is always what was in it. It is a link and not a
  // control — there is nothing here left to decide, so it stays flat.
  return (
    <Link className={cn(ROW, 'rounded-field', PRESS, FOCUS_RING)} to={`/sessions/${session.id}`}>
      <div className="flex items-center gap-2">
        <span className={chip(tone)}>{sessionStatusLabel(session.status)}</span>
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
