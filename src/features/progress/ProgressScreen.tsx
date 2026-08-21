/**
 * Progress (§11.11) — one exercise at a time, over time.
 *
 * Nothing here is stored. The series is `exerciseSeries` over the same history
 * `/exercises/:id` reads, and the best set is the same `summarizeExercise` call
 * that screen makes, so the figure above the chart and the figure on the
 * exercise's own screen cannot disagree — they are one function, called twice.
 *
 * §11.10 and §11.11 divide the work rather than repeat it: Exercise History is
 * the record — every session, every set, in words — and this is the shape of
 * that record. There is deliberately no session list on this screen.
 *
 * The selector offers only exercises that have been trained. An exercise nobody
 * has performed has no line to draw, and offering it would be offering an empty
 * state as if it were a destination.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exerciseSeries, summarizeExercise } from '@/domain/history';
import type { ExerciseId } from '@/domain/ids';
import { useExerciseHistory, useExerciseNames, usePerformedExercises } from '@/features/data/queries';
import { ExerciseChart, METRICS, type Metric } from '@/features/progress/ExerciseChart';
import { SetPill } from '@/features/ui/SetPill';
import { ICON_STROKE, LABEL, WELL } from '@/features/ui/styles';

export function ProgressScreen() {
  const performed = usePerformedExercises();
  const names = useExerciseNames(performed ?? []);
  const [picked, setPicked] = useState<ExerciseId | null>(null);
  const [metric, setMetric] = useState<Metric>('load');

  // `undefined` is a read still in flight; an empty array is a lifter who has
  // not trained yet. They must not render the same thing.
  if (performed === undefined || names === undefined) {
    return (
      <section className={WELL}>
        <p className="type-body-sm text-ink-2">Reading history…</p>
      </section>
    );
  }

  if (performed.length === 0) {
    return (
      <section className={WELL}>
        <TrendingUp aria-hidden="true" className="text-ink-3" size={24} strokeWidth={ICON_STROKE} />
        <p className="type-title">Nothing to plot yet</p>
        <p className="type-body-sm text-ink-2">
          Log a set and this fills in — what you lifted, how many reps you did, and how
          much work that came to, session after session.
        </p>
        <Button asChild size="block" variant="secondary">
          <Link to="/today">Go to today</Link>
        </Button>
      </section>
    );
  }

  // Alphabetical, and the first is where the screen opens. Sorting by whichever
  // was trained most recently would read better and costs a second query; it is
  // not worth one until the list is long enough to scroll.
  const options = [...performed]
    .map((id) => ({ id, name: names.get(id) ?? 'Exercise' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const selected = picked ?? options[0]!.id;

  return (
    <>
      <section className={WELL}>
        <label className={LABEL} htmlFor="progress-exercise">
          exercise
        </label>
        <Select onValueChange={(next) => setPicked(next as ExerciseId)} value={selected}>
          <SelectTrigger id="progress-exercise">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <ExerciseProgress
        exerciseId={selected}
        metric={metric}
        name={options.find((option) => option.id === selected)?.name ?? 'Exercise'}
        onMetric={setMetric}
      />
    </>
  );
}

/**
 * One exercise's panel. Split out so the history read is keyed by the selected
 * exercise: `useExerciseHistory` re-runs when the id changes, and a component
 * that renders one exercise is the honest place to ask for one exercise.
 */
function ExerciseProgress({
  exerciseId,
  name,
  metric,
  onMetric,
}: {
  readonly exerciseId: ExerciseId;
  readonly name: string;
  readonly metric: Metric;
  readonly onMetric: (metric: Metric) => void;
}) {
  const history = useExerciseHistory(exerciseId);

  if (history === undefined) {
    return (
      <section className={WELL}>
        <p className="type-body-sm text-ink-2">Reading history…</p>
      </section>
    );
  }

  const points = exerciseSeries(history);

  // An exercise can be started and then skipped, which puts it on the selector
  // with nothing to draw. Saying so is better than an axis with no line on it.
  if (points.length === 0) {
    return (
      <section className={WELL}>
        <TrendingUp aria-hidden="true" className="text-ink-3" size={24} strokeWidth={ICON_STROKE} />
        <p className="type-title">No sets for {name}</p>
        <p className="type-body-sm text-ink-2">
          This exercise has been started but never logged. The first set you record
          becomes the first point here.
        </p>
      </section>
    );
  }

  const summary = summarizeExercise(history);

  return (
    <section className={WELL}>
      <div className="flex flex-wrap items-center gap-2">
        <SetPill label="best" set={summary.bestSet} />
        <Link className="type-body-sm text-ink-2 underline" to={`/exercises/${exerciseId}`}>
          Full history
        </Link>
      </div>

      {/* Radix owns the strip: arrow keys move between metrics, and the chart
          below is the panel of the one that is selected. */}
      <Tabs onValueChange={(value) => onMetric(value as Metric)} value={metric}>
        <TabsList aria-label="Metric">
          {METRICS.map((entry) => (
            <TabsTrigger key={entry.id} value={entry.id}>
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={metric}>
          <ExerciseChart metric={metric} name={name} points={points} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
