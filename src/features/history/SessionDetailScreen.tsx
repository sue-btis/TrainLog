import { Link, useParams, useSearchParams } from 'react-router';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatLocalDate } from '@/domain/dates';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { SessionHistory } from '@/domain/progression';
import { summarizeSession, type SessionSummary } from '@/domain/session-summary';
import type { ExerciseSession, Session } from '@/domain/types';
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
  seconds,
  sessionStatusLabel,
  setLine,
  snapshotLine,
} from '@/features/ui/format';
import { ExerciseArt } from '@/features/exercises/ExerciseArt';
import { Reading } from '@/features/ui/Reading';
import { ICON_STROKE, LABEL, RULED, WELL, chip } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function SessionDetailScreen() {
  const { sessionId } = useParams<{ sessionId: SessionId }>();
  const [search] = useSearchParams();
  const id = (sessionId ?? '') as SessionId;

  const justFinished = search.get('finished') === '1';

  const detail = useSessionRecord(id === '' ? null : id);
  const workouts = useWorkoutsById(detail ? [detail.session.workoutId] : []);
  const exerciseIds = detail?.exercises.map((exercise) => exercise.exerciseSession.exerciseId) ?? [];
  const names = useExerciseNames(exerciseIds);
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
    <section className="arrive flex flex-col gap-4">
      {summary.records.length > 0 && (
        <div className="flex flex-col gap-3 rounded-card bg-progress-wash p-4">
          <span className={cn(LABEL, 'text-progress-ink')}>
            <Trophy aria-hidden="true" className="mr-1.5 inline" size={13} strokeWidth={ICON_STROKE} />
            {summary.records.length === 1 ? 'a new best' : `${summary.records.length} new bests`}
          </span>
          {summary.records.map((record) => (
            <div className="flex items-center gap-3" key={record.exerciseId}>
              <ExerciseArt className="size-12 text-progress-ink" id={record.exerciseId} reserve />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="type-title text-ink">
                  {names?.get(record.exerciseId) ?? 'Exercise'}
                </span>
                <span className="type-measure text-ink-2">
                  {setLine(record.set, record.measurement, true)} · beats everything before it
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={WELL}>
        <span className={LABEL}>recorded</span>
        <div className="flex flex-wrap gap-2">
          <Figure label="sets" value={String(summary.setsLogged)} />
          {summary.volumeKg > 0 && (
            <Figure
              label="volume"
              tone="progress"
              value={`${Math.round(summary.volumeKg).toLocaleString()} kg`}
            />
          )}
          {summary.volumeReps > 0 && (
            <Figure
              label="reps"
              tone="progress"
              value={summary.volumeReps.toLocaleString()}
            />
          )}
          {summary.volumeSeconds > 0 && (
            <Figure label="time under load" tone="progress" value={seconds(summary.volumeSeconds)} />
          )}
          {summary.volumeMetres > 0 && (
            <Figure
              label="distance"
              tone="progress"
              value={`${Math.round(summary.volumeMetres).toLocaleString()} m`}
            />
          )}
          {summary.minutes !== null && <Figure label="min" value={String(summary.minutes)} />}
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

function outcome(session: Session, summary: SessionSummary): string {
  if (session.status === 'partial') {
    const left = summary.pending + summary.skipped;
    return `Recorded, with ${plural(left, 'exercise')} left undone. It stays in your history and is left out of progression.`;
  }
  if (summary.setsLogged === 0) return 'Recorded. No sets were logged in it.';
  return 'Recorded in full. Every set here feeds the next load this exercise suggests.';
}

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
                <span className="text-ink">
                  {setLine(set, exerciseSession.measurement, true)}
                </span>
                <span className="text-ink-3">RIR {set.rir}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function statusChip(exerciseSession: ExerciseSession) {
  if (exerciseSession.status === 'performed') return null;
  return (
    <span className={chip(exerciseSession.status === 'skipped' ? 'missed' : 'neutral')}>
      {exerciseStatusLabel(exerciseSession.status)}
    </span>
  );
}
