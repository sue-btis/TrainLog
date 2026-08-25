/**
 * How an Exercise is measured (REQ-101, REQ-102, REQ-103).
 *
 * This module is the **only** place in the tree that states, for a measurement
 * type: which value fields a set collects, what its weight field means, which
 * axis a programme states a target on, which axis a record and an advance are
 * read on, and whether higher or lower is better on that axis. Nothing outside
 * this file restates any of those five facts — that is the seam the change
 * exists for, and `grep` finding a second statement of one is a defect.
 *
 * The *type* is declared on `Exercise` and snapshotted onto `ExerciseSession`
 * (DEC-H). The *values* live on `CompletedSet`, which carries no discriminator,
 * so a set can never contradict the ExerciseSession above it. Every function
 * here takes the measurement as a parameter and never infers it from which
 * fields happen to be populated.
 */

/** The nine ways an Exercise can be measured (REQ-101, DEC-A, DEC-R). */
export type Measurement =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'weighted_bodyweight'
  | 'assisted_bodyweight'
  | 'duration'
  | 'duration_weight'
  | 'distance_duration'
  | 'weight_distance'
  | 'distance';

/** Every member of the union, in declaration order. Exhaustive by construction. */
export const MEASUREMENTS = [
  'weight_reps',
  'bodyweight_reps',
  'weighted_bodyweight',
  'assisted_bodyweight',
  'duration',
  'duration_weight',
  'distance_duration',
  'weight_distance',
  'distance',
] as const satisfies readonly Measurement[];

/** A value field a `CompletedSet` collects for some types and not others. */
export type SetField = 'weight' | 'reps' | 'durationSeconds' | 'distance';

/**
 * What the weight field means for a type that collects one.
 *
 * `external` — load moved that is not the lifter (a barbell, a carried sandbag).
 * `added`    — load added to the lifter's own bodyweight (a dip belt).
 * `assisted` — load taken *off* the lifter (a band, an assist machine).
 *
 * The distinction is not cosmetic: it decides the label the logger shows
 * (REQ-109) and, through `direction`, which way a record moves (REQ-103).
 */
export type WeightMeaning = 'external' | 'added' | 'assisted';

/**
 * An axis a measurement can be read on.
 *
 * `pace` is derived — `durationSeconds / distanceM`, seconds per metre — and is
 * the only axis with no field of its own.
 */
export type Axis = 'reps' | 'load' | 'duration' | 'distance' | 'pace';

/** Which way is better along an axis. */
export type Direction = 'higher' | 'lower';

/** The unit a target range on an axis is stated in (REQ-138, REQ-139). */
export type TargetUnit = 'reps' | 'seconds' | 'metres';

/** Everything this module knows about one measurement type. */
export interface MeasurementShape {
  /** The value fields a set of this type collects, in the order a form asks for them. */
  readonly fields: readonly SetField[];
  /** What `weight` means here, or `null` when the type collects no weight. */
  readonly weightMeaning: WeightMeaning | null;
  /** The axis a programme states a range on (§29: reps, for `weight_reps`). */
  readonly targetAxis: Axis;
  /** The axis a record and a progression advance are read on (§29: load). */
  readonly progressAxis: Axis;
  /** Which way is better along `progressAxis`. */
  readonly direction: Direction;
  /**
   * Whether the load a set of this type states is read against the lifter's own
   * bodyweight (REQ-108).
   *
   * True where the lifter *is* the load, whole or in part: the three bodyweight
   * types. False for a type whose weight field is `external` and for the
   * duration and distance types, which state no load at all — a plank is held
   * by a body, but nothing about it is read in kilograms.
   */
  readonly movesBodyweight: boolean;
}

/**
 * The one table. Every fact about the nine types lives in this literal.
 *
 * The two axes differ for most types, and already differ today: §29 states a
 * target in reps and advances the load.
 */
const SHAPES: { readonly [M in Measurement]: MeasurementShape } = {
  weight_reps: {
    fields: ['weight', 'reps'],
    weightMeaning: 'external',
    targetAxis: 'reps',
    progressAxis: 'load',
    direction: 'higher',
    movesBodyweight: false,
  },
  bodyweight_reps: {
    fields: ['reps'],
    weightMeaning: null,
    targetAxis: 'reps',
    progressAxis: 'reps',
    direction: 'higher',
    movesBodyweight: true,
  },
  weighted_bodyweight: {
    fields: ['weight', 'reps'],
    weightMeaning: 'added',
    targetAxis: 'reps',
    progressAxis: 'load',
    direction: 'higher',
    movesBodyweight: true,
  },
  assisted_bodyweight: {
    fields: ['weight', 'reps'],
    weightMeaning: 'assisted',
    targetAxis: 'reps',
    progressAxis: 'load',
    // Less assistance is a better set (REQ-103). One of exactly two inversions.
    direction: 'lower',
    movesBodyweight: true,
  },
  duration: {
    fields: ['durationSeconds'],
    weightMeaning: null,
    targetAxis: 'duration',
    progressAxis: 'duration',
    direction: 'higher',
    movesBodyweight: false,
  },
  duration_weight: {
    fields: ['durationSeconds', 'weight'],
    weightMeaning: 'external',
    targetAxis: 'duration',
    progressAxis: 'load',
    direction: 'higher',
    movesBodyweight: false,
  },
  distance_duration: {
    fields: ['distance', 'durationSeconds'],
    weightMeaning: null,
    targetAxis: 'distance',
    progressAxis: 'pace',
    // Seconds per metre: a lower pace is a faster one (REQ-103). The second inversion.
    direction: 'lower',
    movesBodyweight: false,
  },
  weight_distance: {
    fields: ['weight', 'distance'],
    weightMeaning: 'external',
    targetAxis: 'distance',
    progressAxis: 'load',
    direction: 'higher',
    movesBodyweight: false,
  },
  distance: {
    fields: ['distance'],
    weightMeaning: null,
    targetAxis: 'distance',
    progressAxis: 'distance',
    // A longer jump is a better jump (REQ-103, DEC-R).
    direction: 'higher',
    movesBodyweight: false,
  },
};

/** The shape of one measurement type. Total over the union; no fallback branch. */
export function shapeOf(measurement: Measurement): MeasurementShape {
  return SHAPES[measurement];
}

/** Whether a set of this type collects `field` (REQ-109, REQ-111, REQ-112). */
export function collects(measurement: Measurement, field: SetField): boolean {
  return SHAPES[measurement].fields.includes(field);
}

/** The axis a programme states a range on (REQ-102). */
export function targetAxisOf(measurement: Measurement): Axis {
  return SHAPES[measurement].targetAxis;
}

/** The axis a record and a progression advance are read on (REQ-102). */
export function progressAxisOf(measurement: Measurement): Axis {
  return SHAPES[measurement].progressAxis;
}

/** Which way is better along the progress axis (REQ-103). */
export function directionOf(measurement: Measurement): Direction {
  return SHAPES[measurement].direction;
}

/** Whether the lifter's own bodyweight is part of what a set of this type moves (REQ-108). */
export function movesBodyweight(measurement: Measurement): boolean {
  return SHAPES[measurement].movesBodyweight;
}

/**
 * The axis a tie on the progress axis breaks on, or `null` where the type has
 * only one axis (REQ-113).
 *
 * The target axis, whenever it differs from the progress axis: two sets at the
 * same load are separated by reps, two runs at the same pace by distance. It is
 * always read higher-is-better, and can be: a target axis is only ever reps,
 * duration or distance, and more of each is more work done.
 */
export function secondaryAxisOf(measurement: Measurement): Axis | null {
  const { targetAxis, progressAxis } = SHAPES[measurement];
  return targetAxis === progressAxis ? null : targetAxis;
}

/** What the weight field means, or `null` where the type collects none (REQ-109). */
export function weightMeaningOf(measurement: Measurement): WeightMeaning | null {
  return SHAPES[measurement].weightMeaning;
}

/**
 * The unit a target range on `axis` is stated in.
 *
 * Canonical, as `restSeconds` already is: seconds for a duration axis, metres
 * for a distance axis. `pace` and `load` are never target axes — no type states
 * a programme range on either — so they are not reachable here.
 */
export function targetUnitOf(measurement: Measurement): TargetUnit {
  switch (SHAPES[measurement].targetAxis) {
    case 'reps':
      return 'reps';
    case 'duration':
      return 'seconds';
    case 'distance':
      return 'metres';
    case 'load':
    case 'pace':
      throw new Error(`no target range is stated on the ${SHAPES[measurement].targetAxis} axis`);
  }
}

/**
 * Whether a target range is stated in `minReps`/`maxReps` rather than in
 * `minTarget`/`maxTarget` (REQ-139).
 *
 * Exactly one of the two pairs is populated per PlannedExercise, and this is
 * the single accessor that decides which. No reader tests which field happens
 * to be non-null.
 */
export function targetsReps(measurement: Measurement): boolean {
  return SHAPES[measurement].targetAxis === 'reps';
}

/**
 * The axis whose absence means the set was never really performed (REQ-110).
 *
 * The target axis: a plank with no seconds, a jump with no distance, a bench
 * press with no reps. `reps === 0` is no longer the universal guard.
 */
export function primaryAxisOf(measurement: Measurement): Axis {
  return SHAPES[measurement].targetAxis;
}

/**
 * The value fields an axis is read from, canonical units throughout.
 *
 * `load` reads `weightKg`, `distance` reads `distanceM`, `duration` reads
 * `durationSeconds`, `pace` divides the second by the third.
 */
export interface AxisValues {
  readonly weightKg: number;
  readonly reps: number | null;
  readonly durationSeconds: number | null;
  readonly distanceM: number | null;
}

/**
 * The value of `axis` for one set, or `null` where the set does not carry it.
 *
 * `pace` is `durationSeconds / distanceM`. A zero distance yields `null` rather
 * than infinity: a run of no distance has no pace.
 */
export function axisValue(values: AxisValues, axis: Axis): number | null {
  switch (axis) {
    case 'load':
      return values.weightKg;
    case 'reps':
      return values.reps;
    case 'duration':
      return values.durationSeconds;
    case 'distance':
      return values.distanceM;
    case 'pace': {
      const { durationSeconds, distanceM } = values;
      if (durationSeconds === null || distanceM === null || distanceM === 0) return null;
      return durationSeconds / distanceM;
    }
  }
}

/**
 * Compares two values along `direction`, as `Array.prototype.sort` expects:
 * negative when `a` is worse, positive when `a` is better, zero when tied.
 *
 * This is the one place the sign of an inverted axis is applied.
 */
export function compareOnAxis(a: number, b: number, direction: Direction): number {
  return direction === 'higher' ? a - b : b - a;
}

/**
 * Which of the four volume families a type accumulates into (REQ-116, DEC-D).
 *
 * Never summed across families: kilogram-reps, reps, seconds and metres are
 * four numbers, never one.
 */
export type VolumeFamily = 'kg_reps' | 'reps' | 'seconds' | 'metres';

/** The volume family of a measurement type (REQ-116). */
export function volumeFamilyOf(measurement: Measurement): VolumeFamily {
  const shape = SHAPES[measurement];
  // A type carrying both an external-or-added load and a rep count accumulates
  // kilogram-reps, which is what §11.11 has always called volume.
  if (
    shape.fields.includes('reps') &&
    (shape.weightMeaning === 'external' || shape.weightMeaning === 'added')
  ) {
    return 'kg_reps';
  }
  if (shape.fields.includes('reps')) return 'reps';
  if (shape.targetAxis === 'distance') return 'metres';
  return 'seconds';
}

/**
 * Whether an estimated 1RM is defined for this type (REQ-114, DEC-P).
 *
 * Only the two types carrying an external or added load *with* a rep count.
 * For every other type the estimate is `null` and no figure substitutes one:
 * Riegel and every endurance equivalent were rejected.
 */
export function hasOneRepMax(measurement: Measurement): boolean {
  return measurement === 'weight_reps' || measurement === 'weighted_bodyweight';
}
