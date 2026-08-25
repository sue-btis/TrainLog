/**
 * §11.8 — what happened last time, which the PRD calls one of the product's
 * main functions. Sessions of any status count: this is "what you did", not
 * what progression feeds on.
 *
 * It sits at the foot of the screen, below the finish control: it is reference,
 * read once between sets, and §21 gives the space above the logger to the set in
 * front of you.
 *
 * The figures are the Exercise History screen's own readout, borrowed rather
 * than reinvented: the same `summarizeExercise` over the same history, drawn by
 * the same `Figure`. A lifter who taps through to the full screen therefore
 * lands on a page whose top block they have already read — which is what makes
 * the card read as a preview of the door it is, instead of a second opinion.
 *
 * Two of the three are observed and one is not, and the card must not blur
 * that. The suggested load wears Derived Violet for exactly the reason DESIGN.md
 * reserves the hue: nobody lifted it yet.
 */

import { ChevronRight, History } from 'lucide-react';
import { Link } from 'react-router';
import { summarizeExercise } from '@/domain/history';
import { suggestLoad } from '@/domain/progression';
import type { ExerciseSession } from '@/domain/types';
import { useExerciseHistory } from '@/features/data/queries';
import { Figure } from '@/features/ui/Figure';
import { setLine } from '@/features/ui/format';
import { FOCUS_RING, ICON_STROKE, LABEL, PANEL_CARD, PRESS, WELL } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function PreviousPanel({ exerciseSession }: { readonly exerciseSession: ExerciseSession }) {
  const history = useExerciseHistory(exerciseSession.exerciseId);

  // `undefined` is a read still in flight; an empty summary is an exercise
  // never performed. They must not render the same thing.
  if (history === undefined) return null;

  const summary = summarizeExercise(history);

  // §11.9 — no suggestion for an unplanned exercise, and none without history.
  const suggestion = suggestLoad(exerciseSession, history);

  // Nothing to look back on, so nothing to press into. Flat, and a sentence.
  if (summary.sessions === 0) {
    return (
      <section className={WELL}>
        <span className={LABEL}>previous</span>
        <p className="type-body-sm text-ink-2">
          First time on this exercise. Whatever you log becomes the baseline.
        </p>
      </section>
    );
  }

  return (
    // The whole card is the door to the rest of the history, so the whole card
    // presses: a raised panel rather than a flat well, which is how DESIGN.md
    // says a surface admits it is pressable (§11.10, §21).
    <Link className={cn(PANEL_CARD, PRESS, FOCUS_RING)} to={`/exercises/${exerciseSession.exerciseId}`}>
      <span className={cn(LABEL, 'flex items-center')}>
        <History aria-hidden="true" className="mr-1.5 inline" size={13} strokeWidth={ICON_STROKE} />
        previous · all history
        <ChevronRight aria-hidden="true" className="ml-auto" size={16} strokeWidth={ICON_STROKE} />
      </span>

      {/* Three across, or two when there is no rule to suggest from — an
          unplanned exercise has history but nothing derived from it, and a
          third column standing empty would read as a figure that failed to
          load rather than one that does not exist (REQ-065). */}
      <div
        className={cn(
          'grid gap-x-3 border-t border-rule pt-3',
          suggestion === null ? 'grid-cols-2' : 'grid-cols-3',
        )}
      >
        <Figure compact label="best set" value={setLine(summary.bestSet, summary.measurement)} />
        <Figure compact label="heaviest" value={setLine(summary.heaviest, summary.measurement)} />
        {suggestion !== null && (
          <Figure
            compact
            label="suggested"
            tone="progress"
            value={`${suggestion.weight} ${suggestion.unit}`}
          />
        )}
      </div>
    </Link>
  );
}
