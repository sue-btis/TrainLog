/**
 * One exercise's series, drawn (§11.11).
 *
 * The skin is DESIGN.md §Charts and nothing is invented here: dashed horizontal
 * grid in `rule`, Label type in `ink-3` on both axes, no axis or tick lines, and
 * the Actual series in `actual` at 3.5 px with white-filled dots — green because
 * every point on this chart is something that happened (DESIGN.md §Colors).
 *
 * Recharts takes colours as SVG attributes rather than classes, so the tokens
 * arrive as `var(--color-…)`. That is still the token: the Token-Only Rule bans
 * a raw hex literal, not the name the value is stored under.
 *
 * **One metric at a time.** Load and e1RM are kilograms, reps are a count and
 * volume is kilogram-reps — three units, and DESIGN.md forbids a second Y axis.
 * They are four readings of the same sessions, so the switch is above the chart
 * and the axis always means one thing.
 *
 * Everything is plotted in kilograms even for an exercise logged in pounds:
 * `weightKg` is the only value that means the same thing across units (§11.7),
 * and a chart that switched scale halfway through its own history would be
 * drawing two different questions on one line.
 */

import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { ExercisePoint } from '@/domain/history';
import { plural, shortDate } from '@/features/ui/format';

export type Metric = 'load' | 'e1rm' | 'reps' | 'volume';

export const METRICS: readonly { readonly id: Metric; readonly label: string }[] = [
  { id: 'load', label: 'Load' },
  { id: 'e1rm', label: 'e1RM' },
  { id: 'reps', label: 'Reps' },
  { id: 'volume', label: 'Volume' },
];

/** What each metric reads off a point, and how it is said in words. */
const READING: Record<
  Metric,
  { readonly of: (point: ExercisePoint) => number; readonly unit: string; readonly noun: string }
> = {
  load: { of: (point) => point.topSetKg, unit: 'kg', noun: 'top set' },
  e1rm: { of: (point) => point.estimatedOneRepMaxKg, unit: 'kg', noun: 'estimated 1RM' },
  reps: { of: (point) => point.reps, unit: 'reps', noun: 'reps' },
  volume: { of: (point) => point.volumeKg, unit: 'kg', noun: 'volume' },
};

/**
 * A dot per session, the latest one larger, a record filled.
 *
 * DESIGN.md sizes the series' dots at `r=4.5` and the most recent at `r=6`: the
 * point a lifter is actually looking for is the one they did last, so it is the
 * one the eye lands on first.
 *
 * A record fills that same circle with the stroke's own colour instead of the
 * card — solid reads as achieved, and it adds no hue, no radius and no shape to
 * the vocabulary DESIGN.md fixes. `progress` is deliberately not borrowed: on
 * this skin it names the *derived* segment, so a dot in it would say projected,
 * which is the opposite of what a record is. Fill is independent of radius, so
 * the latest point stays the larger one whether or not it is also a record.
 *
 * Recharts clones this element with the datum as `payload`, which is how the
 * flag arrives — the same path `index` already comes down. A record is a fact
 * about the session, not about the reading on the axis, so it is marked on
 * whichever metric is showing.
 */
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
      fill={payload?.isRecord ? 'var(--color-actual)' : 'var(--color-card)'}
      r={index === last ? 6 : 4.5}
      stroke="var(--color-actual)"
      strokeWidth={2.5}
    />
  );
}

/**
 * Label type, as an SVG tick. Recharts styles ticks through an object rather
 * than a class, so `type-label`'s four values are restated here against the same
 * tokens the utility itself uses (`theme.css:285`) — not re-chosen.
 */
const TICK = {
  fill: 'var(--color-ink-3)',
  fontFamily: 'var(--font-measure)',
  fontSize: '0.625rem',
  fontWeight: 600,
  letterSpacing: '0.12em',
};

/**
 * The trend, in words, for the screen reader that cannot see the line.
 *
 * DESIGN.md requires the label to state the trend rather than name the object,
 * so it reads as a sentence about training: what is charted, over how many
 * sessions, from what to what, which way it went — and how many of those
 * sessions beat everything before them. A series holding none says nothing at
 * all about records: "no personal records" is not a fact about training, it is
 * an absence, and reading it out on every chart is noise.
 */
function describe(name: string, metric: Metric, points: readonly ExercisePoint[]): string {
  const { of, unit, noun } = READING[metric];
  const first = of(points[0]!);
  const last = of(points[points.length - 1]!);
  const direction = last > first ? 'rising' : last < first ? 'falling' : 'level';
  const records = points.filter((point) => point.isRecord).length;
  const best = records === 0 ? '' : ` ${plural(records, 'personal record')} along the way.`;

  if (points.length === 1) {
    return `${name} ${noun}: one session, ${round(first)} ${unit}.${best}`;
  }
  return `${name} ${noun} across ${points.length} sessions, from ${round(first)} to ${round(last)} ${unit} — ${direction}.${best}`;
}

/**
 * Volume reaches five figures with decimals nobody reads. Load rarely does.
 *
 * Exported because the Progress screen states the best estimate as a figure over
 * the same series this chart draws and the same sentence it speaks. Two roundings
 * would be two answers to one question, on one screen.
 */
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
  const { of, unit } = READING[metric];
  const data = points.map((point) => ({
    date: shortDate(point.date),
    isRecord: point.isRecord,
    value: round(of(point)),
  }));

  return (
    // Wide content scrolls inside its own container; the page body never
    // scrolls sideways (DESIGN.md §Layout). The minimum width is what keeps a
    // long history legible instead of crushing twenty sessions into 320 px.
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
              unit={unit === 'reps' ? '' : ' kg'}
              width={unit === 'reps' ? 32 : 56}
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
