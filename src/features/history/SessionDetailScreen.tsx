/**
 * One Session, as it happened (§11.10).
 *
 * Read-only, at every status. Correcting a set belongs to gym mode, where the
 * set was logged; a history screen that can rewrite history is a way to lose
 * data with no undo.
 *
 * Every target on this screen comes from the ExerciseSession's own snapshot and
 * never from the PlannedExercise behind it (ADR 0002). That is the whole reason
 * the snapshot exists: re-importing a corrected file must not move what a
 * session six weeks ago says it was performed against. Nothing here reads
 * `plannedExercises`, and nothing here may start to.
 *
 * Skipped and pending exercises are listed and marked rather than dropped —
 * "you skipped the third exercise" is part of what happened.
 */

import { Link, useParams, useSearchParams } from 'react-router';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatLocalDate } from '@/domain/dates';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { SessionHistory } from '@/domain/progression';
import { summarizeSession, type SessionSummary } from '@/domain/session-summary';
import type { CompletedSet, ExerciseSession, Session } from '@/domain/types';
import {
  useExerciseHistories,
  useExerciseNames,
  useSessionRecord,
  useWorkoutsById,
} from '@/features/data/queries';
import {
  exerciseStatusLabel,
  longDate,
  plural,
  sessionStatusLabel,
  snapshotLine,
} from '@/features/ui/format';
import { Reading } from '@/features/ui/Reading';
import { ICON_STROKE, LABEL, RULED, WELL, chip } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function SessionDetailScreen() {
  const { sessionId } = useParams<{ sessionId: SessionId }>();
  const [search] = useSearchParams();
  const id = (sessionId ?? '') as SessionId;

  // Arriving straight from `finish()` rather than from the calendar. The record
  // is the same record either way — what changes is that the lifter has not
  // seen it yet, so it opens with what the hour amounted to instead of with a
  // list they would have to add up themselves.
  const justFinished = search.get('finished') === '1';

  const detail = useSessionRecord(id === '' ? null : id);
  const workouts = useWorkoutsById(detail ? [detail.session.workoutId] : []);
  const exerciseIds = detail?.exercises.map((exercise) => exercise.exerciseSession.exerciseId) ?? [];
  const names = useExerciseNames(exerciseIds);
  // Only the finish view asks for history: it is what decides whether a set
  // beat everything before it. The calendar's view of the same Session does not.
  const histories = useExerciseHistories(justFinished ? exerciseIds : []);

  // `undefined` is a read still in flight; `null` is a session that is not
  // there. A screen must not flash "no such session" during a running read.
  if (detail === undefined) {
    return <Reading>session</Reading>;
  }

  if (detail === null) {
    return (
      <section className={WELL}>
        <p className="type-title">No such session</p>
        <p className="type-body-sm text-ink-2">
          It may have been deleted, or replaced by a restored backup. The calendar draws
          every session this phone still holds.
        </p>
      </section>
    );
  }

  const { session } = detail;
  const performed = detail.exercises.filter(
    (exercise) => exercise.exerciseSession.status === 'performed',
  ).length;

  return (
    <>
      {justFinished && (
        <FinishSummary
          names={names}
          session={session}
          summary={summarizeSession(detail, histories ?? new Map())}
        />
      )}

      <header className="flex flex-col gap-2">
        <h2 className="type-display">{workouts?.get(session.workoutId)?.name ?? '…'}</h2>
        <p className="type-measure text-ink-3">
          {longDate(formatLocalDate(new Date(session.startedAt)))}
          {session.completedAt !== null &&
            ` · ${plural(
              Math.max(1, Math.round((session.completedAt - session.startedAt) / 60_000)),
              'min',
            )}`}
          {` · ${plural(performed, 'exercise')}`}
        </p>
        {session.status !== 'completed' && (
          <span className={chip(session.status === 'partial' ? 'missed' : 'neutral', 'self-start')}>
            {sessionStatusLabel(session.status)}
          </span>
        )}
      </header>

      {detail.exercises.length === 0 ? (
        <section className={WELL}>
          <p className="type-title">Nothing was recorded</p>
          <p className="type-body-sm text-ink-2">
            This session was started but no exercise was ever opened in it.
          </p>
        </section>
      ) : (
        detail.exercises.map((exercise) => (
          <ExerciseCard
            entry={exercise}
            key={exercise.exerciseSession.id}
            name={names?.get(exercise.exerciseSession.exerciseId) ?? 'Exercise'}
          />
        ))
      )}
    </>
  );
}

/**
 * What the hour amounted to, shown once, at the end of it.
 *
 * Finishing used to record the Session and navigate to Today without a word,
 * which made the moment repeated after every training session the only one in
 * the product that says nothing. The order here is deliberate and is the whole
 * design: **rarest fact first**. A lift that beat everything before it is rare,
 * so it leads; the counts are always true, so they follow; the status is a
 * consequence, so it closes.
 *
 * Records are drawn in Derived Violet, the hue DESIGN.md reserves for a number
 * nobody entered. The estimate is computed, the set beside it is not, so the
 * two are deliberately drawn apart rather than together.
 */
function FinishSummary({
  session,
  summary,
  names,
}: {
  readonly session: Session;
  readonly summary: SessionSummary;
  readonly names: ReadonlyMap<ExerciseId, string> | undefined;
}) {
  return (
    // The whole summary arrives as one thing. It is reached by finishing a
    // session — the app's own ending — and it used to be simply present, which
    // reads as a screen that was always there rather than as a result.
    <section className="arrive flex flex-col gap-4">
      {summary.records.length > 0 && (
        <div className="flex flex-col gap-3 rounded-card bg-progress-wash p-4">
          <span className={cn(LABEL, 'text-progress-ink')}>
            <Trophy aria-hidden="true" className="mr-1.5 inline" size={13} strokeWidth={ICON_STROKE} />
            {summary.records.length === 1 ? 'a new best' : `${summary.records.length} new bests`}
          </span>
          {summary.records.map((record) => (
            <div className="flex flex-col gap-1" key={record.exerciseId}>
              <span className="type-title text-ink">
                {names?.get(record.exerciseId) ?? 'Exercise'}
              </span>
              <span className="type-measure text-ink-2">
                {record.set.weight} {record.set.unit} × {record.set.reps} · beats everything
                before it
              </span>
            </div>
          ))}
        </div>
      )}

      <div className={WELL}>
        <span className={LABEL}>recorded</span>
        <div className="flex flex-wrap gap-2">
          <Figure label="sets" value={String(summary.setsLogged)} />
          {/* Volume is derived from the sets, so it carries the derived hue —
              and it is rounded, because the kilogram it would gain from a
              decimal is not a fact anybody reads. */}
          <Figure
            label="volume"
            tone="progress"
            value={`${Math.round(summary.volumeKg).toLocaleString()} kg`}
          />
          {summary.minutes !== null && <Figure label="min" value={String(summary.minutes)} />}
          {/* Derived from the sets like volume, so it carries the same hue —
              and it sits beside the minutes it is half made of, because the
              number only reads as effort next to the time it took. */}
          {summary.effort !== null && (
            <Figure label="effort" tone="progress" value={String(summary.effort)} />
          )}
          <Figure
            label="exercises"
            value={`${summary.performed} of ${summary.performed + summary.skipped + summary.pending}`}
          />
        </div>
        <p className="type-body-sm text-ink-2">{outcome(session, summary)}</p>
        <Button asChild size="block" variant="primary">
          <Link to="/today">Back to Today</Link>
        </Button>
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  tone = 'neutral',
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'neutral' | 'progress';
}) {
  return (
    <div className="flex min-w-24 flex-1 flex-col gap-0.5 rounded-field bg-panel px-3 py-2">
      <span className={cn('type-readout', tone === 'progress' ? 'text-progress-ink' : 'text-ink')}>
        {value}
      </span>
      <span className={LABEL}>{label}</span>
    </div>
  );
}

/**
 * The status as a sentence rather than as its enum. `partial` is a fact about a
 * lifter's history and it costs them progression, so it says so — the same
 * words the arming step used before they pressed it, because a consequence
 * named twice in two vocabularies reads as two different consequences.
 */
function outcome(session: Session, summary: SessionSummary): string {
  if (session.status === 'partial') {
    const left = summary.pending + summary.skipped;
    return `Recorded, with ${plural(left, 'exercise')} left undone. It stays in your history and is left out of progression.`;
  }
  if (summary.setsLogged === 0) return 'Recorded. No sets were logged in it.';
  return 'Recorded in full. Every set here feeds the next load this exercise suggests.';
}

/**
 * One exercise of the session: what it was aimed at, and what was actually
 * lifted. The two are deliberately adjacent — that pairing is the product
 * (planned vs actual, §16).
 */
function ExerciseCard({
  entry,
  name,
}: {
  readonly entry: SessionHistory['exercises'][number];
  readonly name: string;
}) {
  const { exerciseSession, sets } = entry;
  // The union discriminates on `plannedExerciseId`: reading a target forces
  // establishing that the exercise was planned at all.
  const planned = exerciseSession.plannedExerciseId === null ? null : exerciseSession;

  return (
    <section className={WELL}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate type-title">{name}</span>
        {statusChip(exerciseSession)}
      </div>

      {planned === null ? (
        <span className={chip('neutral', 'self-start')}>Unplanned</span>
      ) : (
        <p className="type-measure text-ink-3">{snapshotLine(planned)}</p>
      )}

      {sets.length === 0 ? (
        <p className="type-body-sm text-ink-2">No sets logged.</p>
      ) : (
        <div className={RULED}>
          <span className={LABEL}>sets</span>
          <ol className="flex flex-col items-start gap-1.5">
            {sets.map((set) => (
              <li className={chip('neutral')} key={set.id}>
                <span className="text-ink-3">{set.setNumber}</span>
                <span className="text-ink">{setLine(set)}</span>
                <span className="text-ink-3">RIR {set.rir}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/** `skipped` and `pending` are facts about the session; `performed` is the norm. */
function statusChip(exerciseSession: ExerciseSession) {
  if (exerciseSession.status === 'performed') return null;
  return (
    <span className={chip(exerciseSession.status === 'skipped' ? 'missed' : 'neutral')}>
      {exerciseStatusLabel(exerciseSession.status)}
    </span>
  );
}

/** `100 kg × 6`, in the unit it was actually lifted in (§11.7). */
function setLine(set: CompletedSet): string {
  return `${set.weight} ${set.unit} × ${set.reps}`;
}
