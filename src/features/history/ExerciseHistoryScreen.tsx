/**
 * Exercise History (§11.10) — one screen per exercise.
 *
 * The four figures at the top and the session list below are the whole of what
 * §11.10 asks for. None of them is stored: every one is `summarizeExercise` over
 * the history, recomputed on arrival, for the same reason progression is derived
 * (§11.9). Correcting a set on the training screen changes these figures on the
 * next read, with nothing to keep in step.
 *
 * History is read by `exerciseId`, never by `plannedExerciseId` (§26), so it
 * spans Routines: re-importing a corrected file continues the same history
 * rather than starting a second one beside it.
 *
 * Every session appears here, of any status. §11.8's rule holds — this is what
 * happened, not what fed the engine — so a `partial` session is listed and
 * marked rather than hidden.
 */

import { useParams } from 'react-router';
import { ChevronDown, Dumbbell } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatLocalDate } from '@/domain/dates';
import { summarizeExercise, type ExerciseSummary } from '@/domain/history';
import type { ExerciseId } from '@/domain/ids';
import type { SessionHistory } from '@/domain/progression';
import type { CompletedSet } from '@/domain/types';
import { useExerciseHistory, useExerciseNames } from '@/features/data/queries';
import { longDate, plural, shortDate } from '@/features/ui/format';
import { SetPill } from '@/features/ui/SetPill';
import { ICON_STROKE, LABEL, RULED, WELL, chip } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function ExerciseHistoryScreen() {
  const { exerciseId } = useParams<{ exerciseId: ExerciseId }>();
  const id = (exerciseId ?? '') as ExerciseId;

  const history = useExerciseHistory(id);
  const names = useExerciseNames(id === '' ? [] : [id]);
  const name = names?.get(id);

  // `undefined` is a read still in flight; an empty array is an exercise never
  // performed. They must not render the same thing.
  if (history === undefined) {
    return (
      <section className={WELL}>
        <p className="type-body-sm text-ink-2">Reading history…</p>
      </section>
    );
  }

  const summary = summarizeExercise(history);
  const performed = history.filter((entry) =>
    entry.exercises.some((exercise) => exercise.sets.length > 0),
  );

  return (
    <>
      <header className="flex flex-col gap-1">
        <h2 className="type-display">{name ?? 'Exercise'}</h2>
        <p className="type-measure text-ink-3">
          {summary.sessions === 0
            ? 'not performed yet'
            : `${plural(summary.sessions, 'session')} · last ${shortDate(
                formatLocalDate(new Date(summary.lastPerformed!)),
              )}`}
        </p>
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

/** §11.10's readout: working weight, best set, sessions, last performed. */
function Figures({ summary }: { readonly summary: ExerciseSummary }) {
  return (
    <Card>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Figure label="current working weight" value={load(summary.workingWeight)} />
        <Figure label="best set" value={setLine(summary.bestSet)} />
        <Figure label="heaviest" value={setLine(summary.heaviest)} />
        <Figure label="lightest" value={setLine(summary.lightest)} />
      </div>
    </Card>
  );
}

function Figure({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL}>{label}</span>
      <span className="type-readout text-ink">{value}</span>
    </div>
  );
}

/**
 * Every session, newest first. The day is the row; the sets are behind it.
 *
 * §11.10 asks for the sets, not for all of them at once: a lifter scanning a
 * year of squats is looking for a date and a load, and twelve rows of five sets
 * each buries both. Collapsed, a row answers "when, and how heavy" — the
 * session's heaviest and lightest set. Opening one gives the sets in full.
 *
 * `<details>` because the browser already does this: disclosure state, keyboard
 * operation and the accessible name come free, and none of it is ours to keep
 * working.
 */
function Sessions({ entries }: { readonly entries: readonly SessionHistory[] }) {
  return (
    <section className={RULED}>
      <span className={LABEL}>every session</span>

      {/* Cards, not ruled rows: each session here says what gym mode's previous
          panel says — a day and the two ends of it — and one card per session is
          the same shape repeated rather than a second way of drawing it. */}
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
  // The same derivation the figures above use, over one session instead of all
  // of them — comparing on `weightKg`, which is the only load that compares
  // across units (§11.7).
  const { heaviest, lightest } = summarizeExercise([entry]);

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
              {entry.session.status.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <SetPill label="heaviest" set={heaviest} />
          {/* One set is both, and saying so twice reads as two different sets. */}
          {sets.length > 1 && <SetPill label="lightest" set={lightest} />}
        </div>
      </summary>

      <ol className="mt-3 flex flex-col items-start gap-1.5">
        {sets.map((set, index) => (
          <li className={chip('neutral')} key={set.id}>
            <span className="text-ink-3">{index + 1}</span>
            <span className="text-ink">
              {set.weight} {set.unit} × {set.reps}
            </span>
            <span className="text-ink-3">RIR {set.rir}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

/** `75 kg`, in the unit it was actually lifted in (§11.7). */
function load(set: CompletedSet | null): string {
  return set === null ? '—' : `${set.weight} ${set.unit}`;
}

/** `77.5 × 5` — §11.10's own notation for a set. */
function setLine(set: CompletedSet | null): string {
  return set === null ? '—' : `${set.weight} × ${set.reps}`;
}
