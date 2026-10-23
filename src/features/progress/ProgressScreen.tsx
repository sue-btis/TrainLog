import { useState } from 'react';
import { Link } from 'react-router';
import { Search, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { normalizeExerciseName } from '@/domain/catalog';
import { addDays, formatLocalDate, mondayOfWeek } from '@/domain/dates';
import { exerciseSeries, summarizeExercise, type ExercisePoint } from '@/domain/history';
import { weeklyVolume, type VolumeRow } from '@/domain/volume';
import type { ExerciseId } from '@/domain/ids';
import {
  useActiveRoutine,
  useExerciseHistory,
  useExerciseNames,
  usePerformedExercisesByRecency,
  useWeekVolume,
} from '@/features/data/queries';
import { ExerciseChart, metricsFor, round, type Metric } from '@/features/progress/ExerciseChart';
import { shortDate } from '@/features/ui/format';
import { SetPill } from '@/features/ui/SetPill';
import { Reading } from '@/features/ui/Reading';
import { ICON_STROKE, LABEL, ROW_LIST, WELL } from '@/features/ui/styles';

type View = 'exercises' | 'week';

export function ProgressScreen() {
  const [view, setView] = useState<View>('exercises');

  return (
    <Tabs onValueChange={(value) => setView(value as View)} value={view}>
      {/* Two views, so a full-width segmented bar rather than a scrolling rail. */}
      <TabsList aria-label="Progress view" className="mx-0 grid grid-cols-2 px-0">
        <TabsTrigger className="justify-center" value="exercises">
          Exercises
        </TabsTrigger>
        <TabsTrigger className="justify-center" value="week">
          This week
        </TabsTrigger>
      </TabsList>
      <TabsContent value="exercises">
        <ExercisesView />
      </TabsContent>
      <TabsContent value="week">
        <WeekVolume />
      </TabsContent>
    </Tabs>
  );
}

function ExercisesView() {
  const performed = usePerformedExercisesByRecency();
  const names = useExerciseNames(performed?.map((entry) => entry.exerciseId) ?? []);
  const [query, setQuery] = useState('');
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

  // Most recently trained first, and the first is where the screen opens.
  const options = performed.map(({ exerciseId }) => ({
    id: exerciseId,
    name: names.get(exerciseId) ?? 'Exercise',
  }));
  const selected = picked ?? options[0]!.id;

  // The selected option stays listed whatever is typed, or the trigger would
  // go blank while the chart still shows it.
  const needle = normalizeExerciseName(query);
  const shown = options.filter(
    (option) => option.id === selected || normalizeExerciseName(option.name).includes(needle),
  );

  return (
    <>
      <section className={WELL}>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>
            <Search aria-hidden="true" className="mr-1.5 inline" size={13} strokeWidth={ICON_STROKE} />
            search
          </span>
          <Input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Squat, bench, row…"
            value={query}
          />
        </label>
        <label className={LABEL} htmlFor="progress-exercise">
          exercise
        </label>
        <Select
          onValueChange={(next) => {
            setPicked(next as ExerciseId);
            setQuery('');
          }}
          value={selected}
        >
          <SelectTrigger id="progress-exercise">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {shown.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {shown.length === 1 && needle !== '' && (
          <p className="type-body-sm text-ink-2">No other exercise matches “{query}”.</p>
        )}
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
        <Link
          className="inline-flex min-h-11 items-center type-body-sm text-ink-2 underline"
          to={`/exercises/${exerciseId}`}
        >
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
          <ExerciseChart key={`${exerciseId}:${shown}`} metric={shown} name={name} points={points} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function WeekVolume() {
  const active = useActiveRoutine();
  const monday = mondayOfWeek(formatLocalDate(new Date()));
  const week = useWeekVolume(active?.id ?? null, monday, addDays(monday, 6));

  if (active === undefined || week === undefined) return <Reading>this week</Reading>;

  const volume = weeklyVolume(week.planned, week.performed);
  const rows = volume.muscles.map((muscle) => ({
    key: muscle.category,
    label: muscle.category.replace('-', ' '),
    ...muscle,
  }));
  if (rows.length === 0 && volume.uncategorized.length === 0) {
    return (
      <section className={WELL}>
        <TrendingUp aria-hidden="true" className="text-ink-3" size={24} strokeWidth={ICON_STROKE} />
        <p className="type-title">Nothing this week yet</p>
        <p className="type-body-sm text-ink-2">
          Place a Workout on the calendar or log a set, and its sets per muscle show here.
        </p>
      </section>
    );
  }

  // One scale for every bar, so a short bar means fewer sets than a long one.
  const most = Math.max(1, ...[...rows, ...volume.uncategorized].flatMap((row) => [row.planned, row.performed]));

  return (
    <section aria-label="Sets this week" className={WELL}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={LABEL}>sets this week</span>
        <span className="type-measure-sm">
          <span className="text-actual-ink">logged</span>
          <span className="text-ink-3"> / </span>
          <span className="text-planned-ink">planned</span>
        </span>
      </div>
      <ul className={ROW_LIST}>
        {rows.map((row) => (
          <VolumeBar key={row.key} label={row.label} most={most} row={row} />
        ))}
      </ul>
      {volume.uncategorized.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className={LABEL}>other · no known muscle</span>
          <ul className={ROW_LIST}>
            {volume.uncategorized.map((row) => (
              <VolumeBar key={row.exerciseId} label={row.name} most={most} row={row} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function VolumeBar({
  label,
  row,
  most,
}: {
  readonly label: string;
  readonly row: VolumeRow;
  readonly most: number;
}) {
  return (
    <li className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 py-2 first:pt-0 last:pb-0">
      <span className="truncate type-body-sm text-ink first-letter:uppercase">{label}</span>
      <div aria-hidden="true" className="relative h-2 overflow-hidden rounded-line bg-card">
        <span
          className="absolute inset-0 origin-left bg-planned-wash"
          style={{ transform: `scaleX(${row.planned / most})` }}
        />
        <span
          className="absolute inset-0 origin-left bg-actual"
          style={{ transform: `scaleX(${row.performed / most})` }}
        />
      </div>
      <span className="type-measure tabular-nums">
        <span className="text-actual-ink">{row.performed}</span>
        <span className="text-ink-3">/</span>
        <span className="text-planned-ink">{row.planned}</span>
      </span>
    </li>
  );
}
