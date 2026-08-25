/**
 * The figures §11.10 puts at the top of an exercise's history screen, and the
 * series §11.11 charts below it.
 *
 * Derived on demand from the session history, never stored — the same rule the
 * progression engine follows (§11.9). There is no `currentWorkingWeight` field
 * anywhere in the schema and there must not be one: it would be a second
 * account of what the sets already say, free to disagree with them.
 *
 * Every comparison here reads `weightKg`, because that is the only value that
 * means the same thing across units (§11.7). A 100 lb set is lighter than a
 * 50 kg one, and the bigger number is the wrong answer.
 */

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
  /** The type every figure below is read under (REQ-102). */
  readonly measurement: Measurement;
  /** How many sessions actually hold sets for this exercise. */
  readonly sessions: number;
  /**
   * §11.10's "current working weight": the heaviest set of the most recent
   * `completed` session. Partial sessions are visible in history but do not
   * define what a lifter is currently working with (§11.9).
   */
  readonly workingWeight: CompletedSet | null;
  /** The heaviest set ever, ties broken by reps — the more work at that load. */
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

/**
 * The better of two sets, on the type's own progress axis in that axis's own
 * direction, ties broken on the secondary axis (REQ-113).
 *
 * For `weight_reps` this is the heavier set, or the one with more reps when the
 * load is equal — §11.10's `77.5 × 5`, unchanged. For `assisted_bodyweight` it
 * is the *less assisted* set, which is the same rule read through a sign the
 * axis owns rather than a comparison this function decides.
 *
 * `a` wins a dead heat, so the earlier set of two identical ones is kept and a
 * repeat is not a new best.
 */
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

/**
 * The set a Session's record is credited to (REQ-115).
 *
 * For a type with an estimated 1RM that is the set with the highest estimate,
 * not the heaviest: a lighter set taken closer to failure can be the one that
 * beat the record, and naming the heaviest would credit the wrong lift. For
 * every other type it is simply the best set on the progress axis.
 */
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

/**
 * Orders two progress-axis values in a type's own direction, exported so that
 * a caller ranking records does not have to restate the sign (REQ-102).
 * Positive when `a` is the better of the two.
 */
export function compareProgress(
  a: number | null,
  b: number | null,
  measurement: Measurement,
): number {
  return compareValues(a, b, directionOf(measurement));
}

/**
 * The measurement a history is read under.
 *
 * Every ExerciseSession in one exercise's history carries the same type — the
 * declaration lives on the Exercise, and correcting it is refused once any set
 * references it (REQ-133) — so the first one found is the answer. An empty
 * history reads `weight_reps`, the same fallback the migration applies and for
 * the same reason (REQ-125).
 */
export function measurementOf(history: readonly SessionHistory[]): Measurement {
  for (const entry of history) {
    for (const exercise of entry.exercises) {
      return exercise.exerciseSession.measurement;
    }
  }
  return 'weight_reps';
}

/**
 * Epley over reps *and* RIR: `weightKg x (1 + (reps + rir) / 30)`.
 *
 * The RIR term is the point. §30 stores RIR as a real result and says the
 * historical value must not be discarded; a set stopped two reps short of
 * failure demonstrates the capacity of a set two reps longer, and reading reps
 * alone would understate every disciplined session the same way.
 *
 * Read off `weightKg`, like every comparison in this module (§11.7): a 225 lb
 * set estimates from 102 kg, not from 225.
 *
 * Not capped at high repetitions. Epley is known to overstate above roughly ten
 * reps, and a cap is a product decision nobody has taken — the consequence is
 * recorded in this change's spec rather than papered over here.
 */
export function estimateOneRepMaxKg(
  performed: CompletedSet,
  measurement: Measurement,
): number | null {
  // Defined only for the two types carrying an external or added load with a
  // rep count (REQ-114). For the other seven there is no estimate and no
  // substitute: Riegel and every endurance equivalent were rejected (DEC-P).
  if (!hasOneRepMax(measurement)) return null;
  // `weighted_bodyweight` reads the added weight alone and never folds in
  // `Session.bodyweightKg`: the stored `weighted-dip` history means added
  // weight, and folding bodyweight in would silently restate every past
  // estimate (AC-160).
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

/**
 * §11.10's figures for one exercise, from the history
 * `listExerciseHistory(exerciseId)` returns.
 *
 * Sessions holding no sets for the exercise are skipped throughout: an exercise
 * that was started and then skipped is part of the Session's story but not part
 * of this exercise's, and counting it would make "Sessions: 12" mean something
 * other than twelve times you did this movement.
 *
 * The input may arrive in any order; nothing here assumes it is sorted.
 */
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

/**
 * One Session's work on one exercise, as §11.11 charts it.
 *
 * Three quantities, three units — kilograms, reps, and kilogram-reps — which is
 * why they are three readings of one point rather than three series on one
 * axis. `topSetKg` is the load the session reached; `reps` is everything done
 * at any load; `volumeKg` is the two multiplied and summed, the only one of the
 * three that moves when either of the others does.
 *
 * `topSetReps` is not a fourth quantity. It is what makes the top set nameable
 * — `77.5 × 5` rather than `77.5` — and it is how the tie-break is visible from
 * outside.
 */
export interface ExercisePoint {
  /** The local day the Session started, which is the day a lifter trained. */
  readonly date: LocalDate;
  /** What orders the series. The date cannot: two Sessions can share a day. */
  readonly startedAt: Timestamp;
  /** The type this point is read under (REQ-102). */
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
  /**
   * The work done, in the unit of the type's own family — kilogram-reps, reps,
   * seconds or metres. Never comparable across families and never summed with
   * one (REQ-116, DEC-D), which is why the family travels with the number.
   */
  readonly volume: number;
  readonly volumeFamily: VolumeFamily;
  /**
   * The best `estimateOneRepMaxKg` of the session — across every set, not the
   * estimate of the set `better()` returns. `better()` chooses by load, so it
   * hands back a heavy double on a day a lighter set demonstrated more; taking
   * the estimate from it would throw that day's real showing away.
   */
  readonly estimatedOneRepMaxKg: number | null;
  /**
   * What a record is read on: the best value of the Session on the type's
   * progress axis (REQ-115). For `weight_reps` and `weighted_bodyweight` that
   * is the estimated 1RM, which is today's rule unchanged; for the rest it is
   * the axis itself — assistance, pace, seconds, metres. `null` for a Session
   * whose sets carry nothing on that axis.
   */
  readonly progressValue: number | null;
  /**
   * Whether this session beats every earlier one on that axis, in that axis's
   * own direction — strictly, so a repeat is not a record, and never for the
   * first session, which has nothing to beat. Marking every opening session
   * would make the mark mean nothing.
   */
  readonly isRecord: boolean;
}

/**
 * §11.11's series for one exercise, from the history
 * `listExerciseHistory(exerciseId)` returns.
 *
 * The session rule is `summarizeExercise`'s, deliberately and exactly: a
 * Session counts when it holds sets, whatever its status. The two render on the
 * same screen — a best set above the chart that draws these points — and a
 * second, narrower rule here would let the figure disagree with the line under
 * it. An open Session is therefore today's point, which is also the honest
 * answer: those sets happened.
 *
 * Ordered oldest first, because that is the direction a chart is read. The
 * repository hands history over newest first, so this is a reversal, not a
 * formality — and the input may arrive in any order, so it is sorted rather
 * than reversed.
 */
export function exerciseSeries(history: readonly SessionHistory[]): ExercisePoint[] {
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

/** The work done, in the unit of its own family. Four accumulators (REQ-116). */
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

/**
 * What a record is read on for this type (REQ-115): the estimated 1RM where the
 * type has one, the progress axis itself otherwise.
 */
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
