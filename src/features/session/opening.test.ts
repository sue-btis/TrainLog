import { describe, expect, it } from 'vitest';
import { toId } from '@/domain/ids';
import type {
  ExerciseId,
  ExerciseSessionId,
  PlannedExerciseId,
  SessionId,
} from '@/domain/ids';
import type { Measurement } from '@/domain/measurement';
import type { LoadSuggestion } from '@/domain/progression';
import type { ExerciseSession } from '@/domain/types';
import { openingValues, targetsWithSuggestion } from '@/features/session/opening';

function planned(
  measurement: Measurement,
  overrides: Partial<ExerciseSession> = {},
): ExerciseSession {
  return {
    id: toId<ExerciseSessionId>('es-1'),
    sessionId: toId<SessionId>('se-1'),
    exerciseId: toId<ExerciseId>('pull-up'),
    order: 0,
    status: 'pending',
    measurement,
    plannedExerciseId: toId<PlannedExerciseId>('pe-1'),
    plannedUnit: 'kg',
    plannedSets: 3,
    plannedMinReps: 6,
    plannedMaxReps: 8,
    plannedMinTarget: null,
    plannedMaxTarget: null,
    plannedMinRir: 1,
    plannedMaxRir: 2,
    plannedRestSeconds: 120,
    plannedProgression: { type: 'double_progression', increment: 1 },
    ...overrides,
  } as ExerciseSession;
}

const repsSuggestion: LoadSuggestion = {
  weight: 0,
  unit: 'kg',
  weightKg: 0,
  axis: 'reps',
  value: 9,
  targetMet: true,
};

const holdPlan = planned('duration', {
  plannedMinReps: null,
  plannedMaxReps: null,
  plannedMinTarget: 30,
  plannedMaxTarget: 45,
} as Partial<ExerciseSession>);

const holdSuggestion: LoadSuggestion = {
  weight: 0,
  unit: 'kg',
  weightKg: 0,
  axis: 'duration',
  value: 50,
  targetMet: true,
};

describe('opening values (AC-12)', () => {
  it('opens a bodyweight_reps set on the suggested reps, above the planned maximum', () => {
    const values = openingValues(planned('bodyweight_reps'), [], repsSuggestion, [], null, 'kg');
    expect(values.reps).toBe(9);
  });

  it('opens a duration set on the suggested seconds', () => {
    const values = openingValues(holdPlan, [], holdSuggestion, [], null, 'kg');
    expect(values.durationSeconds).toBe(50);
  });

  it('opens on the planned maximum when there is no suggestion', () => {
    expect(openingValues(planned('bodyweight_reps'), [], null, [], null, 'kg').reps).toBe(8);
  });

  it('opens a RIR nothing supplies as null', () => {
    const noRir = planned('bodyweight_reps', { plannedMinRir: null, plannedMaxRir: null } as Partial<ExerciseSession>);
    expect(openingValues(noRir, [], null, [], null, 'kg').rir).toBeNull();
    expect(openingValues(noRir, [], null, [], 2, 'kg').rir).toBe(2);
  });
});

describe('the off-plan window with a suggestion (AC-12)', () => {
  it('grows to include a suggestion above the planned maximum', () => {
    expect(targetsWithSuggestion(planned('bodyweight_reps'), repsSuggestion).primary).toEqual([6, 9]);
    expect(targetsWithSuggestion(holdPlan, holdSuggestion).primary).toEqual([30, 50]);
  });

  it('keeps the planned window when the suggestion sits inside it, so a value above the suggestion is off plan', () => {
    const inside = { ...repsSuggestion, value: 7 };
    const [, max] = targetsWithSuggestion(planned('bodyweight_reps'), inside).primary ?? [0, 0];

    expect(max).toBe(8);
    expect(9 > max).toBe(true);
  });

  it('leaves the window alone when the suggestion is on another axis or absent', () => {
    const load: LoadSuggestion = { ...repsSuggestion, axis: 'load', value: 100 };
    expect(targetsWithSuggestion(planned('weight_reps'), load).primary).toEqual([6, 8]);
    expect(targetsWithSuggestion(planned('weight_reps'), null).primary).toEqual([6, 8]);
  });
});
