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
import { plural, shortDate } from '@/features/ui/format';

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
  payload?: { readonly isRecord: boolean };
}) {
  if (cx === undefined || cy === undefined) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      fill={payload?.isRecord ? 'var(--color-progress)' : 'var(--color-card)'}
      r={index === last ? 6 : 4.5}
      stroke="var(--color-actual)"
      strokeWidth={2.5}
    />
  );
}

const TICK = {
  fill: 'var(--color-ink-3)',
  fontFamily: 'var(--font-measure)',
  fontSize: '0.625rem',
  fontWeight: 600,
  letterSpacing: '0.12em',
};

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
      date: shortDate(point.date),
      isRecord: point.isRecord,
      value: value === null ? null : round(value),
    };
  });

  return (
    <div className="overflow-x-auto">
      <div
        aria-label={describe(name, metric, points)}
        className="h-56 min-w-[19rem]"
        role="img"
        style={{ width: `${Math.max(19, data.length * 3.5)}rem` }}
      >
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="var(--color-rule)" strokeDasharray="3 5" vertical={false} />
            <XAxis axisLine={false} dataKey="date" tick={TICK} tickLine={false} />
            <YAxis
              axisLine={false}
              tick={TICK}
              tickLine={false}
              unit={` ${unit}`}
              width={Math.max(40, 30 + unit.length * 8)}
            />
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
  );
}
