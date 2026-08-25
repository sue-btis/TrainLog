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
 * **One metric at a time.** Load and e1RM are kilograms, reps are a count,
 * seconds and metres are their own, and volume is whichever unit the type's
 * family accumulates — and DESIGN.md forbids a second Y axis. They are readings
 * of the same sessions, so the switch is above the chart and the axis always
 * means one thing (REQ-118).
 *
 * **Which metrics are on offer is asked, never restated.** Every membership
 * test below goes through `measurement.ts`'s own accessors. REQ-102 puts field
 * shape, axis and direction in exactly one place, and a list of "the types that
 * have an e1RM" written out here would be a second one.
 *
 * Everything is plotted in kilograms even for an exercise logged in pounds:
 * `weightKg` is the only value that means the same thing across units (§11.7),
 * and a chart that switched scale halfway through its own history would be
 * drawing two different questions on one line.
 */

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

/** Whether the type reads `axis` at all — either as its target or its progress axis. */
function hasAxis(measurement: Measurement, axis: Axis): boolean {
  return targetAxisOf(measurement) === axis || progressAxisOf(measurement) === axis;
}

/**
 * The unit the work of each family is counted in (REQ-116).
 *
 * Volume is the one metric whose unit is not fixed by the metric: four families,
 * four units, never summed. `kg·reps` is the notation §11.11 already uses.
 */
const VOLUME_UNIT: Record<VolumeFamily, string> = {
  kg_reps: 'kg·reps',
  reps: 'reps',
  seconds: 's',
  metres: 'm',
};

/**
 * What each metric reads off a point, how it is said in words, the unit its own
 * axis is stated in, and which types offer it at all.
 *
 * `offeredFor` never names a type. It asks the measurement module the same
 * question the logger asks when it decides which fields a form shows.
 */
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
    // No `?? 0`: a type without an estimate is not offered the metric at all
    // (AC-121), and a session that carries none is a gap in the line rather
    // than a day the lifter estimated zero.
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
    // The field, not the axis: a type collecting seconds has seconds to plot
    // even where its axes are stated elsewhere — a run is timed but read on
    // pace. Every type with a duration axis collects the field, so this is the
    // wider of the two tests, never the narrower.
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
    // The one axis with no field of its own, so it can only be asked for as an
    // axis: seconds per metre exists exactly where the type is read on it.
    offeredFor: (measurement) => hasAxis(measurement, 'pace'),
  },
  volume: {
    label: 'Volume',
    noun: 'volume',
    of: (point) => point.volume,
    unit: (measurement) => VOLUME_UNIT[volumeFamilyOf(measurement)],
    // Every type accumulates work into one of the four families (REQ-116), so
    // volume is the metric that is always there to fall back to.
    offeredFor: () => true,
  },
};

/** The metric switch's order, once the type has had its say about membership. */
const ORDER: readonly Metric[] = ['load', 'e1rm', 'reps', 'duration', 'distance', 'pace', 'volume'];

/**
 * The metrics the switch offers for a type (REQ-118, AC-127).
 *
 * Never empty: `volume` is defined for all nine, which is what lets a caller
 * fall back when the exercise changes under a selection the new type has no
 * values for.
 */
export function metricsFor(
  measurement: Measurement,
): readonly { readonly id: Metric; readonly label: string }[] {
  return ORDER.filter((id) => READING[id].offeredFor(measurement)).map((id) => ({
    id,
    label: READING[id].label,
  }));
}

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
      // A record is Derived Violet, not Foil Green. The line is what was
      // performed; whether a session beat every one before it is something the
      // app worked out, and DESIGN.md reserves violet for exactly that — a
      // number nobody entered. Filling it green said the two were the same
      // kind of fact.
      fill={payload?.isRecord ? 'var(--color-progress)' : 'var(--color-card)'}
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
  const { of, noun } = READING[metric];
  // The unit is the metric's own, in the type's own family where that is what
  // decides it (AC-128) — the sentence and the axis say the same word.
  const unit = READING[metric].unit(points[0]!.measurement);
  // Sessions carrying nothing on this reading are skipped rather than read as
  // zero: a run of no distance has no pace, and saying "0 s/m" would be a lie
  // about a day that happened.
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
              // The selected metric's own unit, whatever it is (AC-128), and a
              // gutter wide enough for the tick plus that word.
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
