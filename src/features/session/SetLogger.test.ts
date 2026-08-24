/**
 * `targetsOf` — the windows the logger marks a set against (FR-14, §32).
 *
 * Only the branching is tested, on the same principle as `format.test.ts`: the
 * field's own comparison is `value < min || value > max` and needs no help, but
 * *whether there is a window at all* has three answers and each of them draws a
 * different control.
 *
 * The failure this guards against is the quiet one: a `null` RIR range read as
 * a range, which would mark every RIR a lifter enters as "off plan" against a
 * plan that never asked for one.
 */

import { describe, expect, it } from 'vitest';
import { toId } from '@/domain/ids';
import type { ExerciseId, ExerciseSessionId, PlannedExerciseId, SessionId } from '@/domain/ids';
import type { ExerciseSession } from '@/domain/types';
import { NO_TARGETS, targetsOf } from '@/features/session/SetLogger';

const planned: ExerciseSession = {
  id: toId<ExerciseSessionId>('es-1'),
  sessionId: toId<SessionId>('se-1'),
  exerciseId: toId<ExerciseId>('back-squat'),
  order: 0,
  status: 'performed',
  plannedExerciseId: toId<PlannedExerciseId>('pe-1'),
  plannedUnit: 'kg',
  plannedSets: 4,
  plannedMinReps: 4,
  plannedMaxReps: 6,
  plannedMinRir: 1,
  plannedMaxRir: 2,
  plannedRestSeconds: 210,
  plannedProgression: { type: 'double_progression', increment: 2.5 },
};

describe('targetsOf (FR-14)', () => {
  it('takes both windows off the snapshot', () => {
    expect(targetsOf(planned)).toEqual({ reps: [4, 6], rir: [1, 2] });
  });

  it('leaves RIR unbounded when the programme stated none (§32)', () => {
    expect(targetsOf({ ...planned, plannedMinRir: null, plannedMaxRir: null })).toEqual({
      reps: [4, 6],
      rir: null,
    });
  });

  it('leaves RIR unbounded when only one end is stated', () => {
    expect(targetsOf({ ...planned, plannedMaxRir: null }).rir).toBeNull();
  });

  it('gives an unplanned exercise nothing to deviate from', () => {
    const unplanned: ExerciseSession = {
      id: toId<ExerciseSessionId>('es-2'),
      sessionId: toId<SessionId>('se-1'),
      exerciseId: toId<ExerciseId>('curl'),
      order: 1,
      status: 'performed',
      plannedExerciseId: null,
    };
    expect(targetsOf(unplanned)).toEqual(NO_TARGETS);
  });
});
