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

import { useParams } from 'react-router';
import { formatLocalDate } from '@/domain/dates';
import type { SessionId } from '@/domain/ids';
import type { SessionHistory } from '@/domain/progression';
import type { CompletedSet, ExerciseSession } from '@/domain/types';
import { useExerciseNames, useSessionRecord, useWorkoutsById } from '@/features/data/queries';
import { longDate, plural, snapshotLine } from '@/features/ui/format';
import { LABEL, RULED, WELL, chip } from '@/features/ui/styles';

export function SessionDetailScreen() {
  const { sessionId } = useParams<{ sessionId: SessionId }>();
  const id = (sessionId ?? '') as SessionId;

  const detail = useSessionRecord(id === '' ? null : id);
  const workouts = useWorkoutsById(detail ? [detail.session.workoutId] : []);
  const names = useExerciseNames(
    detail?.exercises.map((exercise) => exercise.exerciseSession.exerciseId) ?? [],
  );

  // `undefined` is a read still in flight; `null` is a session that is not
  // there. A screen must not flash "no such session" during a running read.
  if (detail === undefined) {
    return (
      <section className={WELL}>
        <p className="type-body-sm text-ink-2">Reading session…</p>
      </section>
    );
  }

  if (detail === null) {
    return (
      <section className={WELL}>
        <p className="type-title">No such session</p>
        <p className="type-body-sm text-ink-2">
          It may have been replaced by a restored backup. Session history lists everything
          this phone still holds.
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
            {session.status.replace('_', ' ')}
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
      {exerciseSession.status}
    </span>
  );
}

/** `100 kg × 6`, in the unit it was actually lifted in (§11.7). */
function setLine(set: CompletedSet): string {
  return `${set.weight} ${set.unit} × ${set.reps}`;
}
