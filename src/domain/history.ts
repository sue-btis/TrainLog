import { formatLocalDate, type LocalDate } from '@/domain/dates';
import type { SessionHistory } from '@/domain/progression';
import {
  axisValue,
  compareOnAxis,
  directionOf,
  hasOneRepMax,
  progressAxisOf,
  secondaryAxisOf,
  volumeFamilyOf,
  type Direction,
  type Measurement,
  type VolumeFamily,
} from '@/domain/measurement';
import type { CompletedSet, Timestamp } from '@/domain/types';

export interface ExerciseSummary {
  readonly measurement: Measurement;
  /** How many sessions actually hold sets for this exercise. */
  readonly sessions: number;
  /** The best set in the most recent completed Session; partial work is visible but not current. */
  readonly workingWeight: CompletedSet | null;
  /** The best set ever on the measurement's progress axis, with its target axis as the tie-breaker. */
  readonly bestSet: CompletedSet | null;
  readonly heaviest: CompletedSet | null;
  readonly lightest: CompletedSet | null;
  /** When the exercise was last actually performed. */
  readonly lastPerformed: Timestamp | null;
}

/** Every set of an exercise in one Session, in the order they were logged. */
function setsOf(entry: SessionHistory): readonly CompletedSet[] {
  return entry.exercises.flatMap((exercise) => exercise.sets);
}

/**
 * Orders two values along a direction, `null` meaning "the set does not carry
 * this axis" and losing to any number it is compared with.
 *
 * Positive when `a` is the better of the two, negative when `b` is.
 */
function compareValues(a: number | null, b: number | null, direction: Direction): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return compareOnAxis(a, b, direction);
}

export function better(a: CompletedSet, b: CompletedSet, measurement: Measurement): CompletedSet {
  const axis = progressAxisOf(measurement);
  const primary = compareValues(
    axisValue(a, axis),
    axisValue(b, axis),
    directionOf(measurement),
  );
  if (primary !== 0) return primary > 0 ? a : b;

  const secondary = secondaryAxisOf(measurement);
  if (secondary === null) return a;
  return compareValues(axisValue(a, secondary), axisValue(b, secondary), 'higher') >= 0
    ? a
    : b;
}

/** The best of several sets. Empty input is a caller error, as `reduce` says. */
function bestOf(sets: readonly CompletedSet[], measurement: Measurement): CompletedSet {
  return sets.reduce((a, b) => better(a, b, measurement));
}

export function recordSetOf(
  sets: readonly CompletedSet[],
  measurement: Measurement,
): CompletedSet {
  if (!hasOneRepMax(measurement)) return bestOf(sets, measurement);
  return sets.reduce((best, performed) =>
    (estimateOneRepMaxKg(performed, measurement) ?? 0) >
    (estimateOneRepMaxKg(best, measurement) ?? 0)
      ? performed
      : best,
  );
}

export function compareProgress(
  a: number | null,
  b: number | null,
  measurement: Measurement,
): number {
  return compareValues(a, b, directionOf(measurement));
}

export function measurementOf(history: readonly SessionHistory[]): Measurement {
  // One exercise's history has one snapshotted measurement; an empty history
  // uses the legacy default because there is no row from which to read it.
  for (const entry of history) {
    for (const exercise of entry.exercises) {
      return exercise.exerciseSession.measurement;
    }
  }
  return 'weight_reps';
}

export function estimateOneRepMaxKg(
  performed: CompletedSet,
  measurement: Measurement,
): number | null {
  // Only weight_reps and weighted_bodyweight have a meaningful load estimate.
  if (!hasOneRepMax(measurement)) return null;
  // Weighted bodyweight records added weight only; folding in Session.bodyweightKg
  // would silently reinterpret historical sets when the lifter's weight changes.
  return performed.weightKg * (1 + ((performed.reps ?? 0) + performed.rir) / 30);
}

const EMPTY: ExerciseSummary = {
  measurement: 'weight_reps',
  sessions: 0,
  workingWeight: null,
  bestSet: null,
  heaviest: null,
  lightest: null,
  lastPerformed: null,
};

export function summarizeExercise(history: readonly SessionHistory[]): ExerciseSummary {
  const performed = history.filter((entry) => setsOf(entry).length > 0);
  if (performed.length === 0) return EMPTY;

  const measurement = measurementOf(history);
  const allSets = performed.flatMap(setsOf);

  const latestCompleted = performed
    .filter((entry) => entry.session.status === 'completed')
    .reduce<SessionHistory | null>(
      (latest, entry) =>
        latest === null || entry.session.startedAt > latest.session.startedAt ? entry : latest,
      null,
    );

  return {
    measurement,
    sessions: performed.length,
    workingWeight:
      latestCompleted === null ? null : bestOf(setsOf(latestCompleted), measurement),
    bestSet: bestOf(allSets, measurement),
    heaviest: allSets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a)),
    lightest: allSets.reduce((a, b) => (b.weightKg < a.weightKg ? b : a)),
    lastPerformed: performed.reduce(
      (latest, entry) => Math.max(latest, entry.session.startedAt),
      0,
    ),
  };
}

export interface ExercisePoint {
  /** The local day the Session started, which is the day a lifter trained. */
  readonly date: LocalDate;
  /** What orders the series. The date cannot: two Sessions can share a day. */
  readonly startedAt: Timestamp;
  readonly measurement: Measurement;
  readonly topSetKg: number;
  readonly topSetReps: number;
  /** Every rep of the exercise in that Session, at any load. */
  readonly reps: number;
  /** Every second held or worked in that Session. */
  readonly durationSeconds: number;
  /** Every metre covered in that Session. */
  readonly distanceM: number;
  /** Seconds per metre over the Session, or `null` for a type with no pace. */
  readonly pace: number | null;
  readonly volume: number;
  readonly volumeFamily: VolumeFamily;
  /**
   * The best `estimateOneRepMaxKg` of the session — across every set, not the
   * estimate of the set `better()` returns. `better()` chooses by load, so it
   * hands back a heavy double on a day a lighter set demonstrated more; taking
   * the estimate from it would throw that day's real showing away.
   */
  readonly estimatedOneRepMaxKg: number | null;
  readonly progressValue: number | null;
  /**
   * Whether this session beats every earlier one on that axis, in that axis's
   * own direction — strictly, so a repeat is not a record, and never for the
   * first session, which has nothing to beat. Marking every opening session
   * would make the mark mean nothing.
   */
  readonly isRecord: boolean;
}

export function exerciseSeries(history: readonly SessionHistory[]): ExercisePoint[] {
  // Sessions with sets contribute regardless of status, so an open Session's
  // work appears immediately while progression still filters it elsewhere.
  const measurement = measurementOf(history);
  const direction = directionOf(measurement);
  const family = volumeFamilyOf(measurement);

  const ordered = history
    .filter((entry) => setsOf(entry).length > 0)
    .map((entry) => {
      const sets = setsOf(entry);
      const top = bestOf(sets, measurement);
      const durationSeconds = total(sets, (set) => set.durationSeconds);
      const distanceM = total(sets, (set) => set.distanceM);
      const reps = total(sets, (set) => set.reps);

      return {
        date: formatLocalDate(new Date(entry.session.startedAt)),
        startedAt: entry.session.startedAt,
        measurement,
        topSetKg: top.weightKg,
        topSetReps: top.reps ?? 0,
        reps,
        durationSeconds,
        distanceM,
        // The Session's own pace, not the mean of its sets': a slow kilometre
        // and a fast one average by distance, not by count.
        pace: distanceM === 0 ? null : durationSeconds / distanceM,
        volume: volumeOf(sets, family),
        volumeFamily: family,
        estimatedOneRepMaxKg: bestEstimate(sets, measurement),
        progressValue: progressValueOf(sets, measurement),
      };
    })
    .sort((a, b) => a.startedAt - b.startedAt);

  // A running best, and only after the sort: the repository hands history over
  // newest first, and reading records in that order would crown the oldest
  // session and miss the newest. Running *best*, not running maximum: on an
  // inverted axis a maximum crowns the worst session there has been.
  //
  // `index > 0` rather than a sentinel on `best`, because a bodyweight set
  // logged at 0 kg estimates 0 — a real value, not an absent one, and the
  // session after it must still be able to beat it.
  let best: number | null = null;
  return ordered.map((point, index) => {
    const isRecord =
      index > 0 &&
      point.progressValue !== null &&
      compareValues(point.progressValue, best, direction) > 0;
    if (compareValues(point.progressValue, best, direction) > 0) best = point.progressValue;
    return { ...point, isRecord };
  });
}

/** Sums one nullable field over a Session's sets; an absent value adds nothing. */
function total(
  sets: readonly CompletedSet[],
  of: (set: CompletedSet) => number | null,
): number {
  return sets.reduce((sum, set) => sum + (of(set) ?? 0), 0);
}

function volumeOf(sets: readonly CompletedSet[], family: VolumeFamily): number {
  switch (family) {
    case 'kg_reps':
      return sets.reduce((sum, set) => sum + set.weightKg * (set.reps ?? 0), 0);
    case 'reps':
      return total(sets, (set) => set.reps);
    case 'seconds':
      return total(sets, (set) => set.durationSeconds);
    case 'metres':
      return total(sets, (set) => set.distanceM);
  }
}

/**
 * The best estimate of a Session — across every set, not the estimate of the
 * set `better()` returns. `better()` chooses by load, so it hands back a heavy
 * double on a day a lighter set demonstrated more.
 */
function bestEstimate(
  sets: readonly CompletedSet[],
  measurement: Measurement,
): number | null {
  if (!hasOneRepMax(measurement)) return null;
  return sets.reduce<number | null>((best, performed) => {
    const estimate = estimateOneRepMaxKg(performed, measurement);
    if (estimate === null) return best;
    return best === null ? estimate : Math.max(best, estimate);
  }, null);
}

function progressValueOf(
  sets: readonly CompletedSet[],
  measurement: Measurement,
): number | null {
  if (hasOneRepMax(measurement)) return bestEstimate(sets, measurement);

  const axis = progressAxisOf(measurement);
  const direction = directionOf(measurement);
  return sets.reduce<number | null>((best, performed) => {
    const value = axisValue(performed, axis);
    return compareValues(value, best, direction) > 0 ? value : best;
  }, null);
}
