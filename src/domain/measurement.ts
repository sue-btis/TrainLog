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

export type SetField = 'weight' | 'reps' | 'durationSeconds' | 'distance';

export type WeightMeaning = 'external' | 'added' | 'assisted';

export type Axis = 'reps' | 'load' | 'duration' | 'distance' | 'pace';

export type Direction = 'higher' | 'lower';

export type TargetUnit = 'reps' | 'seconds' | 'metres';

export interface MeasurementShape {
  readonly fields: readonly SetField[];
  readonly weightMeaning: WeightMeaning | null;
  readonly targetAxis: Axis;
  readonly progressAxis: Axis;
  readonly direction: Direction;
  /** Whether the movement's own bodyweight contributes to its load. */
  readonly movesBodyweight: boolean;
}

// Keep measurement semantics here; callers must not infer them from populated fields.
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
    // Less assistance is better on this inverted load axis.
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
    // Seconds per metre: a lower pace is faster.
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
    // A longer jump is better.
    direction: 'higher',
    movesBodyweight: false,
  },
};

export function shapeOf(measurement: Measurement): MeasurementShape {
  return SHAPES[measurement];
}

export function collects(measurement: Measurement, field: SetField): boolean {
  return SHAPES[measurement].fields.includes(field);
}

export function targetAxisOf(measurement: Measurement): Axis {
  return SHAPES[measurement].targetAxis;
}

export function progressAxisOf(measurement: Measurement): Axis {
  return SHAPES[measurement].progressAxis;
}

export function directionOf(measurement: Measurement): Direction {
  return SHAPES[measurement].direction;
}

export function movesBodyweight(measurement: Measurement): boolean {
  return SHAPES[measurement].movesBodyweight;
}

export function secondaryAxisOf(measurement: Measurement): Axis | null {
  const { targetAxis, progressAxis } = SHAPES[measurement];
  return targetAxis === progressAxis ? null : targetAxis;
}

export function weightMeaningOf(measurement: Measurement): WeightMeaning | null {
  return SHAPES[measurement].weightMeaning;
}

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

export function targetsReps(measurement: Measurement): boolean {
  return SHAPES[measurement].targetAxis === 'reps';
}

export function primaryAxisOf(measurement: Measurement): Axis {
  return SHAPES[measurement].targetAxis;
}

export interface AxisValues {
  readonly weightKg: number;
  readonly reps: number | null;
  readonly durationSeconds: number | null;
  readonly distanceM: number | null;
}

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

export function compareOnAxis(a: number, b: number, direction: Direction): number {
  return direction === 'higher' ? a - b : b - a;
}

export type VolumeFamily = 'kg_reps' | 'reps' | 'seconds' | 'metres';

export function volumeFamilyOf(measurement: Measurement): VolumeFamily {
  const shape = SHAPES[measurement];
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

export function hasOneRepMax(measurement: Measurement): boolean {
  return measurement === 'weight_reps' || measurement === 'weighted_bodyweight';
}
