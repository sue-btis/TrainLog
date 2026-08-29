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

  if (history === undefined) return null;

  const summary = summarizeExercise(history);

  const suggestion = suggestLoad(exerciseSession, history);

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
    <Link className={cn(PANEL_CARD, PRESS, FOCUS_RING)} to={`/exercises/${exerciseSession.exerciseId}`}>
      <span className={cn(LABEL, 'flex items-center')}>
        <History aria-hidden="true" className="mr-1.5 inline" size={13} strokeWidth={ICON_STROKE} />
        previous · all history
        <ChevronRight aria-hidden="true" className="ml-auto" size={16} strokeWidth={ICON_STROKE} />
      </span>

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
