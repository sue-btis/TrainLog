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
import { exerciseSeries, summarizeExercise, type ExercisePoint } from '@/domain/history';
import type { ExerciseId } from '@/domain/ids';
import { useExerciseHistory, useExerciseNames, usePerformedExercises } from '@/features/data/queries';
import { ExerciseChart, metricsFor, round, type Metric } from '@/features/progress/ExerciseChart';
import { shortDate } from '@/features/ui/format';
import { SetPill } from '@/features/ui/SetPill';
import { Reading } from '@/features/ui/Reading';
import { ICON_STROKE, LABEL, WELL } from '@/features/ui/styles';

export function ProgressScreen() {
  const performed = usePerformedExercises();
  const names = useExerciseNames(performed ?? []);
  const [picked, setPicked] = useState<ExerciseId | null>(null);
  const [metric, setMetric] = useState<Metric>('load');

  // `undefined` is a read still in flight; an empty array is a lifter who has
  // not trained yet. They must not render the same thing.
  if (performed === undefined || names === undefined) {
    return <Reading>history</Reading>;
  }

  if (performed.length === 0) {
    return (
      <section className={WELL}>
        <TrendingUp aria-hidden="true" className="text-ink-3" size={24} strokeWidth={ICON_STROKE} />
        <p className="type-title">Nothing to plot yet</p>
        <p className="type-body-sm text-ink-2">
          Log a set and this fills in.
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
    return <Reading>history</Reading>;
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

  // The maximum, not the last point flagged `isRecord`: the first session never
  // carries that flag — it has nothing to beat — so a one-session history would
  // name no day at all. A tie keeps the earlier point, which is the day the
  // estimate was reached, and the same strictly-greater rule the flag applies.
  //
  // `null` where the type has no estimate at all, which is how the figure below
  // knows not to state one (REQ-114, AC-120): a plank has no 1RM and no figure
  // substitutes for it. Read off the points rather than re-asked of the type —
  // `estimatedOneRepMaxKg` is already that answer.
  const best = points.reduce<{ point: ExercisePoint; estimate: number } | null>(
    (found, point) =>
      point.estimatedOneRepMaxKg !== null &&
      (found === null || point.estimatedOneRepMaxKg > found.estimate)
        ? { point, estimate: point.estimatedOneRepMaxKg }
        : found,
    null,
  );

  // The switch offers only what the type defines (AC-127), and the selection
  // falls back when the lifter picks an exercise of a type that has no values
  // for the metric they were looking at — otherwise the chart draws an axis the
  // type never reads. `metricsFor` is never empty, so the fallback always lands.
  const metrics = metricsFor(points[0]!.measurement);
  const shown = metrics.some((entry) => entry.id === metric) ? metric : metrics[0]!.id;

  return (
    <section className={WELL}>
      <div className="flex flex-wrap items-center gap-2">
        <SetPill label="best" measurement={summary.measurement} set={summary.bestSet} />
        <Link className="type-body-sm text-ink-2 underline" to={`/exercises/${exerciseId}`}>
          Full history
        </Link>
      </div>

      {/* §39 A·1 said once in words: the strongest this exercise has shown, and
          when. It is not the pill above it — `bestSet` ranks by load, and load
          is not what the estimate ranks by (105 × 1 estimates under 100 × 5) —
          but it is derived from the same points the chart draws, so §11.10's
          `ExerciseSummary` is left exactly as that screen renders it. The day
          is in the axis's own notation, so it is findable on the line below. */}
      {best !== null && (
        <div className="flex flex-col gap-1">
          <span className={LABEL}>best estimated 1RM</span>
          <span className="type-readout text-ink">{round(best.estimate)} kg</span>
          <span className="type-measure text-ink-3">{shortDate(best.point.date)}</span>
        </div>
      )}

      {/* Radix owns the strip: arrow keys move between metrics, and the chart
          below is the panel of the one that is selected. */}
      <Tabs onValueChange={(value) => onMetric(value as Metric)} value={shown}>
        <TabsList aria-label="Metric">
          {metrics.map((entry) => (
            <TabsTrigger key={entry.id} value={entry.id}>
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={shown}>
          <ExerciseChart metric={shown} name={name} points={points} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
