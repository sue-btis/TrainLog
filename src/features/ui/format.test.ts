import { describe, expect, it } from 'vitest';
import { toId } from '@/domain/ids';
import type {
  ExerciseId,
  ExerciseSessionId,
  PlannedExerciseId,
  SessionId,
  WorkoutId,
} from '@/domain/ids';
import type { CompletedSet, PlannedExercise, PlannedExerciseSession } from '@/domain/types';
import { MEASUREMENTS } from '@/domain/measurement';
import {
  MEASUREMENT_OPTIONS,
  measurementLabel,
  programmingLine,
  setLine,
  setsLine,
  snapshotFigures,
  snapshotLine,
  suggestionLine,
} from '@/features/ui/format';

const snapshot: PlannedExerciseSession = {
  id: toId<ExerciseSessionId>('es-1'),
  sessionId: toId<SessionId>('se-1'),
  exerciseId: toId<ExerciseId>('back-squat'),
  order: 0,
  status: 'performed',
  measurement: 'weight_reps',
  plannedExerciseId: toId<PlannedExerciseId>('pe-1'),
  plannedUnit: 'kg',
  plannedSets: 4,
  plannedMinReps: 4,
  plannedMaxReps: 6,
  plannedMinTarget: null,
  plannedMaxTarget: null,
  plannedMinRir: 1,
  plannedMaxRir: 2,
  plannedRestSeconds: 210,
  plannedProgression: { type: 'double_progression', increment: 2.5 },
};

describe('snapshotLine (AC-6)', () => {
  it('names sets, the rep range, RIR and rest', () => {
    expect(snapshotLine(snapshot)).toBe('4×4–6 · RIR 1–2 · rest 210s');
  });

  it('omits RIR when the snapshot carries none', () => {
    expect(snapshotLine({ ...snapshot, plannedMinRir: null, plannedMaxRir: null })).toBe(
      '4×4–6 · rest 210s',
    );
  });

  it('omits rest when the snapshot carries none', () => {
    expect(snapshotLine({ ...snapshot, plannedRestSeconds: null })).toBe('4×4–6 · RIR 1–2');
  });

  it('collapses a fixed rep count and drops both optional parts', () => {
    expect(
      snapshotLine({
        ...snapshot,
        plannedSets: 3,
        plannedMinReps: 8,
        plannedMaxReps: 8,
        plannedMinRir: null,
        plannedMaxRir: null,
        plannedRestSeconds: null,
      }),
    ).toBe('3×8');
  });
});

describe('snapshotFigures', () => {
  it('holds its three columns whatever the snapshot omits', () => {
    expect(
      snapshotFigures({ ...snapshot, plannedMinRir: null, plannedMaxRir: null }).map((f) => f.value),
    ).toEqual(['4 × 4–6', '—', '210s']);

    expect(
      snapshotFigures({ ...snapshot, plannedRestSeconds: null }).map((f) => f.value),
    ).toEqual(['4 × 4–6', '1–2', '—']);
  });
});

describe('measurementLabel / MEASUREMENT_OPTIONS', () => {
  it.each(MEASUREMENTS)('names %s in the lifter\u2019s words', (measurement) => {
    const label = measurementLabel(measurement);
    expect(label).not.toBe('');
    expect(label).not.toContain('_');
  });
  it('gives no two types the same name', () => {
    const labels = MEASUREMENTS.map(measurementLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('offers every type once, in the union\u2019s order, labelled by the same function', () => {
    expect(MEASUREMENT_OPTIONS).toEqual(
      MEASUREMENTS.map((measurement) => ({
        value: measurement,
        label: measurementLabel(measurement),
      })),
    );
  });
});

const planned: PlannedExercise = {
  id: toId<PlannedExerciseId>('pe-1'),
  workoutId: toId<WorkoutId>('w-1'),
  exerciseId: toId<ExerciseId>('plank'),
  sets: 3,
  minReps: null,
  maxReps: null,
  minTarget: 45,
  maxTarget: 60,
  minRir: null,
  maxRir: null,
  restSeconds: 60,
  unit: 'kg',
  focus: null,
  notes: [],
  order: 0,
  progression: { type: 'manual' },
};

describe('programmingLine', () => {
  it('names no weight unit for a hold and labels the rest', () => {
    expect(programmingLine(planned, 'duration')).toBe('3×45–60s · rest 60s');
  });

  it('keeps the weight unit when the measurement collects weight', () => {
    const squat = { ...planned, minReps: 4, maxReps: 6, minTarget: null, maxTarget: null };
    expect(programmingLine(squat, 'weight_reps')).toBe('3×4–6 · rest 60s · kg');
  });
});

describe('setLine for a hold', () => {
  const hold = { weight: 0, unit: 'kg', reps: null, durationSeconds: 45 } as CompletedSet;

  it('shows the time and never the missing reps', () => {
    expect(setLine(hold, 'duration', true)).toBe('45s');
  });
});

describe('setsLine', () => {
  const set = (weight: number, reps: number, unit = 'kg') =>
    ({ weight, unit, reps, durationSeconds: null }) as CompletedSet;

  it('states a load once for a run of equal loads', () => {
    const sets = [set(77.5, 5), set(77.5, 5), set(77.5, 4)];
    expect(setsLine(sets, 'weight_reps')).toBe('77.5 kg × 5 · 5 · 4');
  });

  it('states the load again where it changes', () => {
    const sets = [set(60, 8), set(70, 5), set(70, 5)];
    expect(setsLine(sets, 'weight_reps')).toBe('60 kg × 8 · 70 kg × 5 · 5');
  });

  it('lists holds whole', () => {
    const holds = [45, 40].map((s) => ({ weight: 0, unit: 'kg', reps: null, durationSeconds: s }) as CompletedSet);
    expect(setsLine(holds, 'duration')).toBe('45s / 40s');
  });
});

describe('suggestionLine', () => {
  const base = { weight: 0, unit: 'kg', weightKg: 0, targetMet: true } as const;

  it('reads a load with its unit and a hold as time', () => {
    expect(suggestionLine({ ...base, axis: 'load', weight: 52.5, value: 52.5 })).toBe('52.5 kg');
    expect(suggestionLine({ ...base, axis: 'duration', value: 50 })).toBe('50s');
  });
});
