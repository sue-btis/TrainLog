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
import { summarizeExercise } from '@/domain/history';
import type { ExerciseSession } from '@/domain/types';
import { suggestLoad } from '@/domain/progression';
import { useExerciseHistory, usePreviousPerformance } from '@/features/data/queries';
import { longDate } from '@/features/ui/format';
import { SetPill } from '@/features/ui/SetPill';
import { ICON_STROKE, LABEL, WELL, chip } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function PreviousPanel({ exerciseSession }: { readonly exerciseSession: ExerciseSession }) {
  const history = useExerciseHistory(exerciseSession.exerciseId);
  const previous = usePreviousPerformance(exerciseSession.exerciseId, exerciseSession.sessionId);

  // §11.9 — no suggestion for an unplanned exercise, and none without history.
  const suggestion = history === undefined ? null : suggestLoad(exerciseSession, history);
  const sets = previous?.exercises.flatMap((entry) => entry.sets) ?? [];
  // Comparing on `weightKg`, the only load that compares across units (§11.7);
  // the same derivation Exercise History's rows use, over one session.
  const { heaviest, lightest } = summarizeExercise(previous === undefined ? [] : [previous]);

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
          <span className={chip(suggestion.targetMet ? 'actual' : 'neutral')}>
            {suggestion.targetMet ? 'target met' : 'repeat'} · {suggestion.weight} {suggestion.unit}
          </span>
        )}
      </div>

      {previous === undefined ? (
        <p className="type-body-sm text-ink-2">
          First time on this exercise. Whatever you log becomes the baseline.
        </p>
      ) : (
        // The day, and the two ends of what was lifted on it — the same
        // shorthand Exercise History uses for a session. The full set list
        // lives there; between sets a lifter is reading for a load, and a row
        // per set pushes the finish control off the screen to say it.
        <div className="flex flex-col gap-2">
          <span className="type-measure text-ink-2">
            {longDate(formatLocalDate(new Date(previous.session.startedAt)))}
          </span>
          <div className="flex flex-wrap gap-2">
            <SetPill label="heaviest" set={heaviest} />
            {/* One set is both, and saying so twice reads as two different sets. */}
            {sets.length > 1 && <SetPill label="lightest" set={lightest} />}
          </div>
        </div>
      )}

    </section>
  );
}
