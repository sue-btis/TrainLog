import { useParams } from 'react-router';
import { ChevronDown, Dumbbell } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatLocalDate } from '@/domain/dates';
import { summarizeExercise, type ExerciseSummary } from '@/domain/history';
import type { ExerciseId } from '@/domain/ids';
import type { SessionHistory } from '@/domain/progression';
import { useExerciseHistory, useExerciseNames } from '@/features/data/queries';
import { ExerciseArt } from '@/features/exercises/ExerciseArt';
import { Figure } from '@/features/ui/Figure';
import { load, longDate, plural, sessionStatusLabel, setLine, shortDate } from '@/features/ui/format';
import { SetPill } from '@/features/ui/SetPill';
import { Reading } from '@/features/ui/Reading';
import { ICON_STROKE, LABEL, RULED, WELL, chip } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function ExerciseHistoryScreen() {
  const { exerciseId } = useParams<{ exerciseId: ExerciseId }>();
  const id = (exerciseId ?? '') as ExerciseId;

  const history = useExerciseHistory(id);
  const names = useExerciseNames(id === '' ? [] : [id]);
  const name = names?.get(id);

  if (history === undefined) {
    return <Reading>history</Reading>;
  }

  const summary = summarizeExercise(history);
  const performed = history.filter((entry) =>
    entry.exercises.some((exercise) => exercise.sets.length > 0),
  );

  return (
    <>
      {/* The whole screen is about one movement, so the figure belongs in its
          title rather than beside a row. Bigger than anywhere else in the app
          for the same reason: nothing here competes with it. */}
      <header className="flex items-center gap-4">
        <ExerciseArt className="size-20 text-planned-ink" id={id} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="type-display">{name ?? 'Exercise'}</h2>
          <p className="type-measure text-ink-3">
            {summary.sessions === 0
              ? 'not performed yet'
              : `${plural(summary.sessions, 'session')} · last ${shortDate(
                  formatLocalDate(new Date(summary.lastPerformed!)),
                )}`}
          </p>
        </div>
      </header>

      {summary.sessions === 0 ? (
        <section className={WELL}>
          <Dumbbell aria-hidden="true" className="text-ink-3" size={24} />
          <p className="type-title">No history yet</p>
          <p className="type-body-sm text-ink-2">
            Train this exercise and every session shows up here.
          </p>
        </section>
      ) : (
        <>
          <Figures summary={summary} />
          <Sessions entries={performed} />
        </>
      )}
    </>
  );
}

function Figures({ summary }: { readonly summary: ExerciseSummary }) {
  return (
    <Card>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Figure label="current working weight" value={load(summary.workingWeight)} />
        <Figure label="best set" value={setLine(summary.bestSet, summary.measurement)} />
        <Figure label="heaviest" value={setLine(summary.heaviest, summary.measurement)} />
        <Figure label="lightest" value={setLine(summary.lightest, summary.measurement)} />
      </div>
    </Card>
  );
}

function Sessions({ entries }: { readonly entries: readonly SessionHistory[] }) {
  return (
    <section className={RULED}>
      <span className={LABEL}>every session</span>

      <div className="flex flex-col gap-3">
        {entries.map((entry) => (
          <SessionRow entry={entry} key={entry.session.id} />
        ))}
      </div>
    </section>
  );
}

function SessionRow({ entry }: { readonly entry: SessionHistory }) {
  const sets = entry.exercises.flatMap((exercise) => exercise.sets);
  const { heaviest, lightest, measurement } = summarizeExercise([entry]);

  return (
    <details className={cn(WELL, 'group')}>
      <summary className="flex cursor-pointer list-none flex-col gap-2 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="type-measure text-ink-2">
            <ChevronDown
              aria-hidden="true"
              className="mr-1.5 inline text-ink-3 transition-transform group-open:rotate-180"
              size={14}
              strokeWidth={ICON_STROKE}
            />
            {longDate(formatLocalDate(new Date(entry.session.startedAt)))}
          </span>
          {entry.session.status !== 'completed' && (
            <span className={chip(entry.session.status === 'partial' ? 'neutral' : 'planned')}>
              {sessionStatusLabel(entry.session.status)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <SetPill label="heaviest" measurement={measurement} set={heaviest} />
          {/* One set is both, and saying so twice reads as two different sets. */}
          {sets.length > 1 && (
            <SetPill label="lightest" measurement={measurement} set={lightest} />
          )}
        </div>
      </summary>

      <ol className="mt-3 flex flex-col items-start gap-1.5">
        {sets.map((set, index) => (
          <li className={chip('neutral')} key={set.id}>
            <span className="text-ink-3">{index + 1}</span>
            <span className="text-ink">{setLine(set, measurement, true)}</span>
            <span className="text-ink-3">RIR {set.rir}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
