import { useLayoutEffect, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { ExercisePoint } from '@/domain/history';
import {
  collects,
  hasOneRepMax,
  progressAxisOf,
  targetAxisOf,
  volumeFamilyOf,
  type Axis,
  type Measurement,
  type VolumeFamily,
} from '@/domain/measurement';
import { chartDate, plural } from '@/features/ui/format';

export type Metric = 'load' | 'e1rm' | 'reps' | 'duration' | 'distance' | 'pace' | 'volume';

function hasAxis(measurement: Measurement, axis: Axis): boolean {
  return targetAxisOf(measurement) === axis || progressAxisOf(measurement) === axis;
}

const VOLUME_UNIT: Record<VolumeFamily, string> = {
  kg_reps: 'kg·reps',
  reps: 'reps',
  seconds: 's',
  metres: 'm',
};

const READING: Record<
  Metric,
  {
    readonly label: string;
    readonly noun: string;
    readonly of: (point: ExercisePoint) => number | null;
    readonly unit: (measurement: Measurement) => string;
    readonly offeredFor: (measurement: Measurement) => boolean;
  }
> = {
  load: {
    label: 'Load',
    noun: 'top set',
    of: (point) => point.topSetKg,
    unit: () => 'kg',
    offeredFor: (measurement) => collects(measurement, 'weight'),
  },
  e1rm: {
    label: 'e1RM',
    noun: 'estimated 1RM',
    of: (point) => point.estimatedOneRepMaxKg,
    unit: () => 'kg',
    offeredFor: hasOneRepMax,
  },
  reps: {
    label: 'Reps',
    noun: 'reps',
    of: (point) => point.reps,
    unit: () => 'reps',
    offeredFor: (measurement) => collects(measurement, 'reps'),
  },
  duration: {
    label: 'Time',
    noun: 'time',
    of: (point) => point.durationSeconds,
    unit: () => 's',
    offeredFor: (measurement) => collects(measurement, 'durationSeconds'),
  },
  distance: {
    label: 'Distance',
    noun: 'distance',
    of: (point) => point.distanceM,
    unit: () => 'm',
    offeredFor: (measurement) => collects(measurement, 'distance'),
  },
  pace: {
    label: 'Pace',
    noun: 'pace',
    of: (point) => point.pace,
    unit: () => 's/m',
    offeredFor: (measurement) => hasAxis(measurement, 'pace'),
  },
  volume: {
    label: 'Volume',
    noun: 'volume',
    of: (point) => point.volume,
    unit: (measurement) => VOLUME_UNIT[volumeFamilyOf(measurement)],
    offeredFor: () => true,
  },
};

const ORDER: readonly Metric[] = ['load', 'e1rm', 'reps', 'duration', 'distance', 'pace', 'volume'];

export function metricsFor(
  measurement: Measurement,
): readonly { readonly id: Metric; readonly label: string }[] {
  return ORDER.filter((id) => READING[id].offeredFor(measurement)).map((id) => ({
    id,
    label: READING[id].label,
  }));
}

function Dot({
  cx,
  cy,
  index,
  last,
  payload,
}: {
  cx?: number;
  cy?: number;
  index?: number;
  last: number;
  payload?: { readonly isRecord: boolean; readonly value: number | null };
}) {
  if (cx === undefined || cy === undefined) return null;
  const isLast = index === last;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        fill={payload?.isRecord ? 'var(--color-progress)' : 'var(--color-card)'}
        r={isLast ? 7 : 4.5}
        stroke="var(--color-actual)"
        strokeWidth={2.5}
      />
      {isLast && payload?.value != null && (
        <text
          fill="var(--color-ink)"
          fontFamily="var(--font-measure)"
          fontSize="0.8125rem"
          fontWeight={700}
          textAnchor="middle"
          x={cx}
          y={cy - 14}
        >
          {payload.value}
        </text>
      )}
    </g>
  );
}

const TICK = {
  fill: 'var(--color-ink-3)',
  fontFamily: 'var(--font-measure)',
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
};

const STEPS = [1, 2, 2.5, 5, 10];

/**
 * The y range a line should be drawn on: the data padded a little and snapped
 * to round ticks, so a 75→82.5 climb fills the plot instead of sitting in the
 * top eighth of a 0–100 axis. A series that cannot go negative never does.
 */
export function niceDomain(values: readonly number[]): { lo: number; hi: number; ticks: number[] } {
  if (values.length === 0) return { lo: 0, hi: 1, ticks: [0, 1] };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.max(Math.abs(max) * 0.1, 1);
  const paddedLo = min - range * 0.1;
  const paddedHi = max + range * 0.15;

  const raw = (paddedHi - paddedLo) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fitted = (STEPS.find((candidate) => candidate * magnitude >= raw) ?? 10) * magnitude;
  // A flat series has no spread to space ticks by; whole numbers read better
  // than quarter steps around a value like 12 reps.
  const step = min === max && Number.isInteger(max) ? Math.max(fitted, 1) : fitted;

  const lo = Math.floor(paddedLo / step) * step;
  const hi = Math.ceil(paddedHi / step) * step;
  const floor = min >= 0 && lo < 0 ? 0 : lo;

  const ticks: number[] = [];
  for (let tick = floor; tick <= hi + step / 1000; tick += step) ticks.push(round(tick));
  return { lo: floor, hi, ticks };
}

function describe(name: string, metric: Metric, points: readonly ExercisePoint[]): string {
  const { of, noun } = READING[metric];
  const unit = READING[metric].unit(points[0]!.measurement);
  const values = points.map(of).filter((value): value is number => value !== null);
  const records = points.filter((point) => point.isRecord).length;
  const best = records === 0 ? '' : ` ${plural(records, 'personal record')} along the way.`;

  if (values.length === 0) return `${name} ${noun}: nothing recorded.${best}`;

  const first = values[0]!;
  const last = values[values.length - 1]!;
  const direction = last > first ? 'rising' : last < first ? 'falling' : 'level';

  if (values.length === 1) {
    return `${name} ${noun}: one session, ${round(first)} ${unit}.${best}`;
  }
  return `${name} ${noun} across ${values.length} sessions, from ${round(first)} to ${round(last)} ${unit} — ${direction}.${best}`;
}

export function round(value: number): number {
  return Math.round(value * 10) / 10;
}

// The left margin keeps the first date label, centred on the first point, inside the plot.
const PLOT_MARGIN = { top: 28, right: 24, bottom: 4, left: 20 };
const X_AXIS_HEIGHT = 28;
const POINT_WIDTH_REM = 3.5;

export function ExerciseChart({
  name,
  metric,
  points,
}: {
  readonly name: string;
  readonly metric: Metric;
  readonly points: readonly ExercisePoint[];
}) {
  const { of } = READING[metric];
  const unit = READING[metric].unit(points[0]!.measurement);
  const data = points.map((point) => {
    const value = of(point);
    return {
      date: chartDate(point.date),
      isRecord: point.isRecord,
      value: value === null ? null : round(value),
    };
  });
  const { lo, hi, ticks } = niceDomain(
    data.map((point) => point.value).filter((value): value is number => value !== null),
  );
  const axisWidth = 16 + Math.max(...ticks.map((tick) => String(tick).length)) * 8;

  const scroller = useRef<HTMLDivElement>(null);
  const [hiddenBefore, setHiddenBefore] = useState(false);

  // The newest session is the one a lifter opens this screen to see, so the
  // strip starts at its right edge; the fade says there is more to the left.
  useLayoutEffect(() => {
    const strip = scroller.current;
    if (strip === null) return;
    const toLatest = () => {
      strip.scrollLeft = strip.scrollWidth;
      setHiddenBefore(strip.scrollLeft > 1);
    };
    toLatest();
    // The first measure can precede the container's final width.
    const frame = requestAnimationFrame(toLatest);
    return () => cancelAnimationFrame(frame);
  }, [data.length, metric]);

  return (
    <div
      aria-label={describe(name, metric, points)}
      className="relative flex h-60"
      role="img"
    >
      <span aria-hidden="true" className="absolute top-0 left-0 type-label text-ink-3 normal-case">
        {unit}
      </span>

      <div className="shrink-0" style={{ width: axisWidth }}>
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={data} margin={{ ...PLOT_MARGIN, left: 0, right: 0 }}>
            <XAxis axisLine={false} height={X_AXIS_HEIGHT} tick={false} tickLine={false} />
            <YAxis
              axisLine={false}
              domain={[lo, hi]}
              tick={TICK}
              tickLine={false}
              ticks={ticks}
              width={axisWidth}
            />
            {/* An axis with no series draws no ticks; this one draws nothing else. */}
            <Line dataKey="value" dot={false} isAnimationActive={false} stroke="none" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="relative min-w-0 flex-1">
        <div
          className="rail h-full"
          onScroll={(event) => setHiddenBefore(event.currentTarget.scrollLeft > 1)}
          ref={scroller}
        >
          <div
            className="h-full"
            style={{ minWidth: '100%', width: `${data.length * POINT_WIDTH_REM}rem` }}
          >
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={data} margin={PLOT_MARGIN}>
                <CartesianGrid stroke="var(--color-rule)" strokeDasharray="3 5" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="date"
                  height={X_AXIS_HEIGHT}
                  interval="preserveStartEnd"
                  tick={TICK}
                  tickLine={false}
                />
                <YAxis domain={[lo, hi]} hide ticks={ticks} />
                <Line
                  activeDot={false}
                  dataKey="value"
                  dot={<Dot last={data.length - 1} />}
                  isAnimationActive={false}
                  stroke="var(--color-actual)"
                  strokeWidth={3.5}
                  type="linear"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {hiddenBefore && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-card to-transparent"
          />
        )}
      </div>
    </div>
  );
}
