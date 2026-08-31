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
  readonly date: LocalDate;
  readonly placements: readonly Placement[];
  readonly sessions: readonly Session[];
  readonly workouts: ReadonlyMap<WorkoutId, Workout> | undefined;
  readonly onMoved: (date: LocalDate) => void;
}

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
              state={placementState(placement, sessions, today)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type DayRecordProps = Pick<DayProps, 'date' | 'sessions' | 'workouts'>;

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


function SessionRow({ session, name }: { readonly session: Session; readonly name: string }) {
  const started = new Date(session.startedAt);
  const tone: Parameters<typeof chip>[0] =
    session.status === 'completed' ? 'actual' : session.status === 'partial' ? 'missed' : 'neutral';

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
