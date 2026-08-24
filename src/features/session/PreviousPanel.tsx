/**
 * §11.8 — what happened last time, which the PRD calls one of the product's
 * main functions. Sessions of any status count: this is "what you did", not
 * what progression feeds on.
 *
 * It sits at the foot of the screen, below the finish control: it is reference,
 * read once between sets, and §21 gives the space above the logger to the set in
 * front of you.
 */

import { History } from 'lucide-react';
import { Link } from 'react-router';
import { formatLocalDate } from '@/domain/dates';
import type { ExerciseSession } from '@/domain/types';
import { suggestLoad } from '@/domain/progression';
import { useExerciseHistory, usePreviousPerformance } from '@/features/data/queries';
import { longDate } from '@/features/ui/format';
import { ICON_STROKE, LABEL, WELL, chip } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function PreviousPanel({ exerciseSession }: { readonly exerciseSession: ExerciseSession }) {
  const history = useExerciseHistory(exerciseSession.exerciseId);
  const previous = usePreviousPerformance(exerciseSession.exerciseId, exerciseSession.sessionId);

  // §11.9 — no suggestion for an unplanned exercise, and none without history.
  const suggestion = history === undefined ? null : suggestLoad(exerciseSession, history);

  return (
    <section className={WELL}>
      <div className="flex items-center justify-between gap-3">
        {/* The card shows one session — the last one. Everything before it is a
            tap away rather than crowded in here (§11.10, §21). */}
        <Link
          className={cn(LABEL, 'underline decoration-rule underline-offset-4')}
          to={`/exercises/${exerciseSession.exerciseId}`}
        >
          <History aria-hidden="true" className="mr-1.5 inline" size={13} strokeWidth={ICON_STROKE} />
          previous · all history
        </Link>
        {suggestion !== null && (
          // Violet, not green. The load below is a number the engine derived;
          // Foil Green means "what actually happened", and painting a suggestion
          // in it tells the lifter a computed figure is an observed one
          // (DESIGN.md, the five hues).
          <span className={chip('progress')}>
            {suggestion.targetMet ? 'target met' : 'repeat'} · {suggestion.weight} {suggestion.unit}
          </span>
        )}
      </div>

      {previous === undefined ? (
        <p className="type-body-sm text-ink-2">
          First time on this exercise. Whatever you log becomes the baseline.
        </p>
      ) : (
        // Only the day. Every set of it is now drawn under its own dome in the
        // strip above, per set and above the fold — which answers both "what
        // was I working at" and "did my reps fall off", where a heaviest and a
        // lightest answered only the first and did it below the finish control.
        <span className="type-measure text-ink-2">
          {longDate(formatLocalDate(new Date(previous.session.startedAt)))}
        </span>
      )}

    </section>
  );
}
