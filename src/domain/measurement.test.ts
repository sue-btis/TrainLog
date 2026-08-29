
import { describe, expect, it } from 'vitest';
import {
  axisValue,
  collects,
  compareOnAxis,
  directionOf,
  hasOneRepMax,
  MEASUREMENTS,
  movesBodyweight,
  primaryAxisOf,
  progressAxisOf,
  shapeOf,
  targetAxisOf,
  targetsReps,
  targetUnitOf,
  volumeFamilyOf,
  weightMeaningOf,
  type Axis,
  type AxisValues,
  type Measurement,
  type SetField,
  type TargetUnit,
  type VolumeFamily,
  type WeightMeaning,
} from '@/domain/measurement';

describe('MEASUREMENTS (TST-101)', () => {
  it('TST-101: has exactly nine members', () => {
    expect(MEASUREMENTS).toHaveLength(9);
  });

  it('TST-101: lists every member exactly once — no duplicate row shadows another', () => {
    expect(new Set(MEASUREMENTS).size).toBe(MEASUREMENTS.length);
  });

  it('TST-101: shapeOf is total over the union — every member has a shape', () => {
    for (const measurement of MEASUREMENTS) {
      expect(shapeOf(measurement)).toBeDefined();
    }
  });

  it('TST-101: every shape names fields, both axes and a direction', () => {
    for (const measurement of MEASUREMENTS) {
      const shape = shapeOf(measurement);
      expect(shape.fields.length).toBeGreaterThan(0);
      expect(shape.targetAxis).toBeDefined();
      expect(shape.progressAxis).toBeDefined();
      expect(shape.direction).toBeDefined();
    }
  });
});

describe('directionOf (TST-102, REQ-103)', () => {
  it('TST-102: exactly two types are lower-is-better — assistance and pace', () => {
    const lower = MEASUREMENTS.filter((m) => directionOf(m) === 'lower');
    expect(lower).toEqual(['assisted_bodyweight', 'distance_duration']);
  });

  it('TST-102: the other seven are higher-is-better', () => {
    const higher = MEASUREMENTS.filter((m) => directionOf(m) === 'higher');
    expect(higher).toHaveLength(7);
    expect(higher).not.toContain('assisted_bodyweight');
    expect(higher).not.toContain('distance_duration');
  });

  it('AC-168: distance is higher-is-better — a longer jump is a better jump', () => {
    expect(directionOf('distance')).toBe('higher');
  });
});

describe('movesBodyweight (REQ-108)', () => {
  it('is the three bodyweight types and nothing else', () => {
    expect(MEASUREMENTS.filter(movesBodyweight)).toEqual([
      'bodyweight_reps',
      'weighted_bodyweight',
      'assisted_bodyweight',
    ]);
  });

  it('a barbell lift and a plank state no load against the lifter', () => {
    expect(movesBodyweight('weight_reps')).toBe(false);
    expect(movesBodyweight('duration')).toBe(false);
  });
});

describe('the two axes (TST-127, REQ-102, AC-161)', () => {
  it('TST-127: weight_reps targets reps and progresses on load — the axes differ', () => {
    expect(targetAxisOf('weight_reps')).toBe('reps');
    expect(progressAxisOf('weight_reps')).toBe('load');
    expect(targetAxisOf('weight_reps')).not.toBe(progressAxisOf('weight_reps'));
  });

  it('TST-127: all nine name both axes', () => {
    for (const measurement of MEASUREMENTS) {
      expect(targetAxisOf(measurement)).toBeDefined();
      expect(progressAxisOf(measurement)).toBeDefined();
    }
  });

  const targetAxes: { readonly [M in Measurement]: Axis } = {
    weight_reps: 'reps',
    bodyweight_reps: 'reps',
    weighted_bodyweight: 'reps',
    assisted_bodyweight: 'reps',
    duration: 'duration',
    duration_weight: 'duration',
    distance_duration: 'distance',
    weight_distance: 'distance',
    distance: 'distance',
  };

  const progressAxes: { readonly [M in Measurement]: Axis } = {
    weight_reps: 'load',
    bodyweight_reps: 'reps',
    weighted_bodyweight: 'load',
    assisted_bodyweight: 'load',
    duration: 'duration',
    duration_weight: 'load',
    distance_duration: 'pace',
    weight_distance: 'load',
    distance: 'distance',
  };

  it.each(MEASUREMENTS)('TST-127: %s names the axes the table states', (measurement) => {
    expect(targetAxisOf(measurement)).toBe(targetAxes[measurement]);
    expect(progressAxisOf(measurement)).toBe(progressAxes[measurement]);
  });

  it('primaryAxisOf is the target axis — the axis whose absence means no set (REQ-110)', () => {
    for (const measurement of MEASUREMENTS) {
      expect(primaryAxisOf(measurement)).toBe(targetAxisOf(measurement));
    }
  });
});

describe('axisValue', () => {
  const values: AxisValues = {
    weightKg: 60,
    reps: 8,
    durationSeconds: 300,
    distanceM: 1000,
  };

  it('reads each axis from its own field', () => {
    expect(axisValue(values, 'load')).toBe(60);
    expect(axisValue(values, 'reps')).toBe(8);
    expect(axisValue(values, 'duration')).toBe(300);
    expect(axisValue(values, 'distance')).toBe(1000);
  });

  it('derives pace as seconds per metre', () => {
    expect(axisValue(values, 'pace')).toBe(0.3);
  });

  it('returns null for a set that does not carry the axis', () => {
    const empty: AxisValues = {
      weightKg: 0,
      reps: null,
      durationSeconds: null,
      distanceM: null,
    };
    expect(axisValue(empty, 'reps')).toBeNull();
    expect(axisValue(empty, 'duration')).toBeNull();
    expect(axisValue(empty, 'distance')).toBeNull();
  });

  it('has no pace for a run of no distance rather than an infinity', () => {
    expect(axisValue({ ...values, distanceM: 0 }, 'pace')).toBeNull();
    expect(axisValue({ ...values, distanceM: null }, 'pace')).toBeNull();
    expect(axisValue({ ...values, durationSeconds: null }, 'pace')).toBeNull();
  });
});

describe('compareOnAxis', () => {
  it('higher is better: the larger value sorts as better', () => {
    expect(compareOnAxis(100, 80, 'higher')).toBeGreaterThan(0);
    expect(compareOnAxis(80, 100, 'higher')).toBeLessThan(0);
    expect(compareOnAxis(100, 100, 'higher')).toBe(0);
  });

  it('lower is better: less assistance, faster pace (REQ-103)', () => {
    expect(compareOnAxis(10, 20, 'lower')).toBeGreaterThan(0);
    expect(compareOnAxis(20, 10, 'lower')).toBeLessThan(0);
    expect(compareOnAxis(10, 10, 'lower')).toBe(0);
  });
});

describe('the per-type table, named for all nine', () => {
  const fields: { readonly [M in Measurement]: readonly SetField[] } = {
    weight_reps: ['weight', 'reps'],
    bodyweight_reps: ['reps'],
    weighted_bodyweight: ['weight', 'reps'],
    assisted_bodyweight: ['weight', 'reps'],
    duration: ['durationSeconds'],
    duration_weight: ['durationSeconds', 'weight'],
    distance_duration: ['distance', 'durationSeconds'],
    weight_distance: ['weight', 'distance'],
    distance: ['distance'],
  };

  const allFields: readonly SetField[] = ['weight', 'reps', 'durationSeconds', 'distance'];

  it.each(MEASUREMENTS)('collects: %s collects exactly its own fields (REQ-109)', (measurement) => {
    for (const field of allFields) {
      expect(collects(measurement, field)).toBe(fields[measurement].includes(field));
    }
  });

  const weightMeanings: { readonly [M in Measurement]: WeightMeaning | null } = {
    weight_reps: 'external',
    bodyweight_reps: null,
    weighted_bodyweight: 'added',
    assisted_bodyweight: 'assisted',
    duration: null,
    duration_weight: 'external',
    distance_duration: null,
    weight_distance: 'external',
    distance: null,
  };

  it.each(MEASUREMENTS)('weightMeaningOf: %s (REQ-109)', (measurement) => {
    expect(weightMeaningOf(measurement)).toBe(weightMeanings[measurement]);
  });

  const targetUnits: { readonly [M in Measurement]: TargetUnit } = {
    weight_reps: 'reps',
    bodyweight_reps: 'reps',
    weighted_bodyweight: 'reps',
    assisted_bodyweight: 'reps',
    duration: 'seconds',
    duration_weight: 'seconds',
    distance_duration: 'metres',
    weight_distance: 'metres',
    distance: 'metres',
  };

  it.each(MEASUREMENTS)('targetUnitOf: %s (REQ-138, REQ-139)', (measurement) => {
    expect(targetUnitOf(measurement)).toBe(targetUnits[measurement]);
  });

  it.each(MEASUREMENTS)('targetsReps: %s agrees with its target unit (REQ-139)', (measurement) => {
    expect(targetsReps(measurement)).toBe(targetUnits[measurement] === 'reps');
  });

  it('targetsReps is true for exactly the four rep-targeted types', () => {
    expect(MEASUREMENTS.filter(targetsReps)).toEqual([
      'weight_reps',
      'bodyweight_reps',
      'weighted_bodyweight',
      'assisted_bodyweight',
    ]);
  });

  const volumeFamilies: { readonly [M in Measurement]: VolumeFamily } = {
    weight_reps: 'kg_reps',
    bodyweight_reps: 'reps',
    weighted_bodyweight: 'kg_reps',
    // Assistance is load taken off the lifter, so it never accumulates kg-reps.
    assisted_bodyweight: 'reps',
    duration: 'seconds',
    duration_weight: 'seconds',
    distance_duration: 'metres',
    weight_distance: 'metres',
    distance: 'metres',
  };

  it.each(MEASUREMENTS)('volumeFamilyOf: %s (REQ-116, DEC-D)', (measurement) => {
    expect(volumeFamilyOf(measurement)).toBe(volumeFamilies[measurement]);
  });

  it('hasOneRepMax is true only for the two loaded-with-reps types (REQ-114, DEC-P)', () => {
    expect(MEASUREMENTS.filter(hasOneRepMax)).toEqual(['weight_reps', 'weighted_bodyweight']);
  });
});
