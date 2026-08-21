/**
 * Session History (§11.10) — everything you have trained, newest first.
 *
 * The exercise history screen answers "how has this movement gone"; this one
 * answers "what did I do, and when". Same record, read the other way round.
 *
 * One row is drawn entirely from its own `Session` — day, duration, status —
 * plus the Workout name, so the screen is two reads whether a lifter has ten
 * sessions or a thousand. Counting sets or exercises per row would be a query
 * per row, and the number it would print is one tap away on the detail.
 *
 * Every status is listed. A `partial` session is marked rather than hidden
 * (§11.9), and an `in_progress` one appears here too — the calendar shows it,
 * and two screens disagreeing about what happened is worse than a row a lifter
 * has to interpret.
 */

import { Link } from 'react-router';
import { History } from 'lucide-react';
import { formatLocalDate } from '@/domain/dates';
import type { Session } from '@/domain/types';
import { useAllSessions, useWorkoutsById } from '@/features/data/queries';
import { plural, shortDate } from '@/features/ui/format';
import { LABEL, PRESS, ROW, ROW_LIST, WELL, chip } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function SessionHistoryScreen() {
  const sessions = useAllSessions();
  const workouts = useWorkoutsById(sessions?.map((session) => session.workoutId) ?? []);

  // `undefined` is a read still in flight; an empty array is a lifter who has
  // not trained yet. They must not render the same thing.
  if (sessions === undefined) {
    return (
      <section className={WELL}>
        <p className="type-body-sm text-ink-2">Reading history…</p>
      </section>
    );
  }

  if (sessions.length === 0) {
    return (
      <section className={WELL}>
        <History aria-hidden="true" className="text-ink-3" size={24} />
        <p className="type-title">No sessions yet</p>
        <p className="type-body-sm text-ink-2">
          Finish a workout and it will be here — the day, the exercises, and every set
          you logged in it.
        </p>
      </section>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <h2 className="type-display">Session history</h2>
        <p className="type-measure text-ink-3">{plural(sessions.length, 'session')}</p>
      </header>

      <section className={WELL}>
        <span className={LABEL}>every session</span>
        <div className={ROW_LIST}>
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              name={workouts?.get(session.workoutId)?.name ?? '…'}
              session={session}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function SessionRow({ session, name }: { readonly session: Session; readonly name: string }) {
  return (
    <Link className={cn(ROW, PRESS, 'rounded-field')} to={`/sessions/${session.id}`}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate type-title">{name}</span>
        {session.status !== 'completed' && (
          <span className={chip(session.status === 'partial' ? 'missed' : 'neutral')}>
            {session.status.replace('_', ' ')}
          </span>
        )}
      </div>
      <p className="type-measure-sm text-ink-3">
        {shortDate(formatLocalDate(new Date(session.startedAt)))}
        {session.completedAt !== null && ` · ${durationLine(session)}`}
      </p>
    </Link>
  );
}

/** The same figure the calendar's session row prints, from the same rounding. */
function durationLine(session: Session): string {
  return plural(Math.max(1, Math.round((session.completedAt! - session.startedAt) / 60_000)), 'min');
}
