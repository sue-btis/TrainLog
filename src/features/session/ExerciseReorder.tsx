/**
 * Reordering the session's exercises (FR-14, §11.5).
 *
 * A destination, not a direction. The two one-step controls this replaces made
 * the lifter do arithmetic — getting the fifth exercise to the front was four
 * presses, with nothing on screen saying how many were left — and they could
 * only ever move one exercise before the menu closed. Here the whole session is
 * on screen and any exercise goes anywhere, as many times as it takes.
 *
 * The positions are laid out as buttons rather than hidden in a select. Every
 * destination is one tap, with no popup opening over the list you are trying to
 * read — which matters most in exactly the place this screen is used, phone on a
 * bench and one hand occupied (§20). Drag would need either a dependency or
 * custom touch code to do worse than a row of numbers.
 *
 * Each move is written as it is made, like every other write in gym mode
 * (NFR-03). There is nothing to save and nothing lost by leaving.
 *
 * Only `ExerciseSession.order` is ever written. The PlannedExercises behind
 * these rows are not touched: deviation belongs to the Session, and a Routine is
 * immutable once accepted (AGENTS.MD).
 */

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExerciseId, ExerciseSessionId } from '@/domain/ids';
import type { ExerciseSession } from '@/domain/types';
import { ICON_STROKE, LABEL, ROW, ROW_LIST, chip, tab } from '@/features/ui/styles';

interface ExerciseReorderProps {
  readonly exerciseSessions: readonly ExerciseSession[];
  readonly names: ReadonlyMap<ExerciseId, string> | undefined;
  readonly onMove: (id: ExerciseSessionId, toPosition: number) => void;
  readonly onDone: () => void;
  readonly busy: boolean;
}

export function ExerciseReorder({
  exerciseSessions,
  names,
  onMove,
  onDone,
  busy,
}: ExerciseReorderProps) {
  const ordered = [...exerciseSessions].sort((a, b) => a.order - b.order);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="type-headline">Reorder exercises</h2>
        <Button aria-label="Done" onClick={onDone} size="icon" type="button" variant="ghost">
          <X aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        </Button>
      </header>

      <p className="type-body-sm text-ink-2">
        Give an exercise the position you want it in. The rest move around it, and the
        session keeps the order you leave here.
      </p>

      <div className={ROW_LIST}>
        {ordered.map((exerciseSession, index) => (
          <article className={ROW} key={exerciseSession.id}>
            <div className="flex items-start gap-3">
              <span className="type-measure-sm text-ink-3">{index + 1}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="type-title">
                  {names?.get(exerciseSession.exerciseId) ?? '…'}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {exerciseSession.plannedExerciseId === null && (
                    <span className={chip('neutral')}>Unplanned</span>
                  )}
                  {exerciseSession.status !== 'pending' && (
                    <span className={chip(exerciseSession.status === 'skipped' ? 'missed' : 'actual')}>
                      {exerciseSession.status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {ordered.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className={LABEL}>move to</span>
                {ordered.map((_, position) => (
                  <button
                    aria-current={position === index}
                    aria-label={`Move ${names?.get(exerciseSession.exerciseId) ?? 'exercise'} to position ${position + 1}`}
                    className={tab(position === index, 'min-h-11 w-11 justify-center px-0')}
                    disabled={busy || position === index}
                    key={position}
                    onClick={() => onMove(exerciseSession.id, position)}
                    type="button"
                  >
                    {position + 1}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      <Button onClick={onDone} size="block" type="button" variant="secondary">
        Back to training
      </Button>
    </section>
  );
}
