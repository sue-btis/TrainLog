import { describe, expect, it } from 'vitest';
import { toId } from '@/domain/ids';
import type { ExerciseId, ExerciseSessionId, PlannedExerciseId, SessionId } from '@/domain/ids';
import type { PlannedExerciseSession } from '@/domain/types';
import { MEASUREMENTS } from '@/domain/measurement';
import {
  MEASUREMENT_OPTIONS,
  measurementLabel,
  snapshotFigures,
  snapshotLine,
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
