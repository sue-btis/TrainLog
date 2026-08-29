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

  const best = points.reduce<{ point: ExercisePoint; estimate: number } | null>(
    (found, point) =>
      point.estimatedOneRepMaxKg !== null &&
      (found === null || point.estimatedOneRepMaxKg > found.estimate)
        ? { point, estimate: point.estimatedOneRepMaxKg }
        : found,
    null,
  );

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
