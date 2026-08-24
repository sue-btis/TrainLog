import { describe, expect, it } from 'vitest';
import {
  toId,
  type CompletedSetId,
  type ExerciseId,
  type ExerciseSessionId,
  type PlannedExerciseId,
  type RoutineId,
  type SessionId,
  type WorkoutId,
} from '@/domain/ids';
import type {
  CompletedSet,
  PlannedExercise,
  ProgressionRule,
  Session,
  SessionStatus,
  Unit,
} from '@/domain/types';
import { toKg } from '@/domain/units';
import { startPlannedExercise, startUnplannedExercise } from '@/domain/session';
import { projectNextLoad, suggestLoad, type SessionHistory } from '@/domain/progression';

const squat = toId<ExerciseId>('front-squat');
const bench = toId<ExerciseId>('bench-press');

function planned(overrides: Partial<PlannedExercise> = {}): PlannedExercise {
  return {
    id: toId<PlannedExerciseId>('planned-1'),
    workoutId: toId<WorkoutId>('workout-1'),
    exerciseId: squat,
    sets: 4,
    minReps: 4,
    maxReps: 6,
    minRir: 1,
    maxRir: 2,
    restSeconds: 210,
    unit: 'kg',
    focus: null,
    notes: [],
    order: 0,
    progression: { type: 'double_progression', increment: 2.5 },
    ...overrides,
  };
}

interface SetSpec {
  readonly weight: number;
  readonly reps: number;
  readonly unit?: Unit;
}

let sequence = 0;

/** One completed session containing one exercise with the given sets. */
function history(options: {
  readonly exerciseId?: ExerciseId;
  readonly status?: SessionStatus;
  readonly routineId?: string;
  readonly startedAt?: number;
  readonly rule?: ProgressionRule;
  readonly sets: readonly SetSpec[];
}): SessionHistory {
  sequence += 1;
  const startedAt = options.startedAt ?? sequence * 1_000;
  const status = options.status ?? 'completed';
  const session: Session = {
    id: toId<SessionId>(`session-${String(sequence)}`),
    routineId: toId<RoutineId>(options.routineId ?? 'routine-1'),
    workoutId: toId<WorkoutId>('workout-1'),
    startedAt,
    completedAt: status === 'in_progress' ? null : startedAt + 3_600_000,
    status,
  };

  const exerciseSession = {
    ...startPlannedExercise({
      sessionId: session.id,
      planned: planned({
        exerciseId: options.exerciseId ?? squat,
        progression: options.rule ?? { type: 'double_progression', increment: 2.5 },
      }),
      order: 0,
    }),
    id: toId<ExerciseSessionId>(`exercise-session-${String(sequence)}`),
    status: 'performed' as const,
  };

  const sets: CompletedSet[] = options.sets.map((spec, index) => {
    const unit = spec.unit ?? 'kg';
    return {
      id: toId<CompletedSetId>(`set-${String(sequence)}-${String(index)}`),
      exerciseSessionId: exerciseSession.id,
      setNumber: index + 1,
      weight: spec.weight,
      unit,
      weightKg: toKg(spec.weight, unit),
      reps: spec.reps,
      rir: 1,
      completedAt: startedAt + index * 60_000,
    };
  });

  return { session, exercises: [{ exerciseSession, sets }] };
}

const at = (weight: number, reps: number, unit?: Unit): SetSpec => ({ weight, reps, unit });

describe('TST-012 double_progression, first N sets (REQ-064, §29)', () => {
  it('(a) four planned sets all at max reps suggest previous + increment (AC-066)', () => {
    const suggestion = suggestLoad(planned(), [
      history({ sets: [at(75, 6), at(75, 6), at(75, 6), at(75, 6)] }),
    ]);

    expect(suggestion).toEqual({ weight: 77.5, unit: 'kg', weightKg: 77.5, targetMet: true });
  });

  it('(b) one of the N sets at 5 reps suggests no increase (AC-067)', () => {
    const suggestion = suggestLoad(planned(), [
      history({ sets: [at(75, 6), at(75, 6), at(75, 5), at(75, 6)] }),
    ]);

    expect(suggestion).toEqual({ weight: 75, unit: 'kg', weightKg: 75, targetMet: false });
  });

  it('(c) a fifth set at max reps does not change (b) (AC-068)', () => {
    const suggestion = suggestLoad(planned(), [
      history({ sets: [at(75, 6), at(75, 6), at(75, 5), at(75, 6), at(75, 6)] }),
    ]);

    expect(suggestion).toEqual({ weight: 75, unit: 'kg', weightKg: 75, targetMet: false });
  });

  it('(c2) an extra set below max reps does not spoil an otherwise met target (§29)', () => {
    const suggestion = suggestLoad(planned(), [
      history({ sets: [at(75, 6), at(75, 6), at(75, 6), at(75, 6), at(75, 4)] }),
    ]);

    expect(suggestion).toEqual({ weight: 77.5, unit: 'kg', weightKg: 77.5, targetMet: true });
  });

  it('(d) fewer than N sets means the target is not met (§29)', () => {
    const suggestion = suggestLoad(planned(), [
      history({ sets: [at(75, 6), at(75, 6), at(75, 6)] }),
    ]);

    expect(suggestion).toEqual({ weight: 75, unit: 'kg', weightKg: 75, targetMet: false });
  });

  it('returns the suggestion in the exercise unit with its kilogram value (AC-070, REQ-066)', () => {
    const suggestion = suggestLoad(
      planned({ unit: 'lb', progression: { type: 'double_progression', increment: 5 } }),
      [
        history({
          rule: { type: 'double_progression', increment: 5 },
          sets: [at(135, 6, 'lb'), at(135, 6, 'lb'), at(135, 6, 'lb'), at(135, 6, 'lb')],
        }),
      ],
    );

    // Exact in lb: 135 + 5. Adding 5 lb inside kilograms and converting back
    // would land on 139.9998 lb.
    expect(suggestion).toEqual({
      weight: 140,
      unit: 'lb',
      weightKg: toKg(140, 'lb'),
      targetMet: true,
    });
    expect(suggestion?.weightKg).toBe(63.503);
  });
});

describe('TST-013 only completed sessions feed the engine (REQ-062, AC-064)', () => {
  it('ignores a partial session that hit max reps', () => {
    const suggestion = suggestLoad(planned(), [
      history({ status: 'partial', sets: [at(80, 6), at(80, 6), at(80, 6), at(80, 6)] }),
    ]);

    expect(suggestion).toBeNull();
  });

  it('ignores an in_progress session that hit max reps', () => {
    const suggestion = suggestLoad(planned(), [
      history({ status: 'in_progress', sets: [at(80, 6), at(80, 6), at(80, 6), at(80, 6)] }),
    ]);

    expect(suggestion).toBeNull();
  });

  it('reads through a later partial session back to the most recent completed one', () => {
    const suggestion = suggestLoad(planned(), [
      history({ startedAt: 1_000, sets: [at(75, 6), at(75, 6), at(75, 6), at(75, 6)] }),
      history({ startedAt: 2_000, status: 'partial', sets: [at(90, 6), at(90, 6)] }),
    ]);

    expect(suggestion).toEqual({ weight: 77.5, unit: 'kg', weightKg: 77.5, targetMet: true });
  });
});

describe('TST-014 history is scoped by exerciseId (REQ-061, AC-063, §26)', () => {
  it('continues across two different Routines', () => {
    const suggestion = suggestLoad(
      planned({
        id: toId<PlannedExerciseId>('planned-from-reimport'),
        workoutId: toId<WorkoutId>('workout-2'),
      }),
      [
        history({
          routineId: 'routine-1',
          startedAt: 1_000,
          sets: [at(70, 6), at(70, 6), at(70, 6), at(70, 6)],
        }),
        history({
          routineId: 'routine-2',
          startedAt: 2_000,
          sets: [at(75, 6), at(75, 6), at(75, 6), at(75, 6)],
        }),
      ],
    );

    expect(suggestion).toEqual({ weight: 77.5, unit: 'kg', weightKg: 77.5, targetMet: true });
  });

  it('ignores history belonging to a different exercise', () => {
    const suggestion = suggestLoad(planned(), [
      history({ exerciseId: bench, sets: [at(100, 6), at(100, 6), at(100, 6), at(100, 6)] }),
    ]);

    expect(suggestion).toBeNull();
  });
});

describe('TST-015 manual never advances load (REQ-063, AC-065)', () => {
  const manual = planned({ progression: { type: 'manual' } });

  it('returns the previous weight even when every set hit max reps', () => {
    const suggestion = suggestLoad(manual, [
      history({
        rule: { type: 'manual' },
        sets: [at(75, 6), at(75, 6), at(75, 6), at(75, 6)],
      }),
    ]);

    expect(suggestion).toEqual({ weight: 75, unit: 'kg', weightKg: 75, targetMet: false });
  });

  it('does not advance across repeated sessions at the same load', () => {
    const suggestion = suggestLoad(manual, [
      history({ rule: { type: 'manual' }, startedAt: 1_000, sets: [at(75, 6), at(75, 6)] }),
      history({ rule: { type: 'manual' }, startedAt: 2_000, sets: [at(75, 6), at(75, 6)] }),
    ]);

    expect(suggestion?.weight).toBe(75);
  });
});

describe('TST-016 no suggestion without planned history (REQ-065, AC-069)', () => {
  it('returns null for an exercise with no completed history', () => {
    expect(suggestLoad(planned(), [])).toBeNull();
  });

  it('returns null for an unplanned exercise, even with history for it', () => {
    const unplanned = startUnplannedExercise({
      sessionId: toId<SessionId>('session-now'),
      exerciseId: squat,
      order: 1,
    });

    const suggestion = suggestLoad(unplanned, [
      history({ sets: [at(75, 6), at(75, 6), at(75, 6), at(75, 6)] }),
    ]);

    expect(suggestion).toBeNull();
  });

  it('accepts an ExerciseSession snapshot as the target (ADR 0002)', () => {
    const snapshot = startPlannedExercise({
      sessionId: toId<SessionId>('session-now'),
      planned: planned(),
      order: 0,
    });

    const suggestion = suggestLoad(snapshot, [
      history({ sets: [at(75, 6), at(75, 6), at(75, 6), at(75, 6)] }),
    ]);

    expect(suggestion).toEqual({ weight: 77.5, unit: 'kg', weightKg: 77.5, targetMet: true });
  });
});

/**
 * Regression tests added by verification (2026-08-19).
 *
 * Mutation testing showed that two behaviours `lastCompletedSets` depends on
 * were unasserted: the ordering of the sets it evaluates, and its walk back
 * past completed Sessions that did not contain the exercise. Both sit under
 * §29's "first N sets" rule, so a silent break would move a lifter's load.
 */
describe('lastCompletedSets — ordering and the walk backwards (REQ-061, REQ-064, §29)', () => {
  it('evaluates the first N sets by setNumber, not by the order they arrive in', () => {
    // Two working sets at 100 kg, then a lighter back-off set. With N = 2 the
    // rule looks at the two working sets only, so the target is met and the
    // load advances from 100 kg. Supplied deliberately out of order: if the
    // sort were removed, `sets[0]` would be the 80 kg back-off set and the
    // first N would include it, giving 80 kg and targetMet: false.
    const entry = history({ sets: [at(100, 6), at(100, 6), at(80, 3)] });
    const [performed] = entry.exercises;
    if (performed === undefined) throw new Error('fixture built no exercise');
    const [first, second, backOff] = performed.sets;
    if (first === undefined || second === undefined || backOff === undefined) {
      throw new Error('fixture built fewer than three sets');
    }

    const shuffled: SessionHistory = {
      ...entry,
      exercises: [{ ...performed, sets: [backOff, second, first] }],
    };

    const suggestion = suggestLoad(planned({ sets: 2 }), [shuffled]);

    expect(suggestion).toEqual({ weight: 102.5, unit: 'kg', weightKg: 102.5, targetMet: true });
  });

  it('walks back past a completed Session that did not include the exercise', () => {
    // A squat session, then a later completed session with no squat in it.
    // The engine must keep searching backwards rather than reading the empty
    // result as "no history" and returning null.
    const squatSession = history({
      startedAt: 1_000,
      sets: [at(100, 6), at(100, 6), at(100, 6), at(100, 6)],
    });
    const benchOnly = history({ startedAt: 2_000, exerciseId: bench, sets: [at(60, 8)] });

    const suggestion = suggestLoad(planned(), [squatSession, benchOnly]);

    expect(suggestion).toEqual({ weight: 102.5, unit: 'kg', weightKg: 102.5, targetMet: true });
  });
});

describe('projectNextLoad — what the sets in hand will earn (§29)', () => {
  /** The Session in progress, as the screen holds it: a snapshot and its sets. */
  function inProgress(options: {
    readonly rule?: ProgressionRule;
    readonly sets: readonly SetSpec[];
  }) {
    const entry = history({ status: 'in_progress', rule: options.rule, sets: options.sets });
    return {
      exerciseSession: entry.exercises[0]!.exerciseSession,
      sets: entry.exercises[0]!.sets,
    };
  }

  it('projects previous + increment once every planned set has reached max reps', () => {
    const { exerciseSession, sets } = inProgress({
      sets: [at(100, 6), at(100, 6), at(100, 6), at(100, 6)],
    });

    expect(projectNextLoad(exerciseSession, sets)).toEqual({
      weight: 102.5,
      unit: 'kg',
      weightKg: 102.5,
      targetMet: true,
    });
  });

  it('promises nothing while a set is still short of the rep target', () => {
    const { exerciseSession, sets } = inProgress({
      sets: [at(100, 6), at(100, 6), at(100, 6), at(100, 5)],
    });

    expect(projectNextLoad(exerciseSession, sets)).toBeNull();
  });

  it('promises nothing until every planned set is in — four planned, three logged', () => {
    const { exerciseSession, sets } = inProgress({ sets: [at(100, 6), at(100, 6), at(100, 6)] });

    expect(projectNextLoad(exerciseSession, sets)).toBeNull();
  });

  it('ignores sets beyond the planned count, as the rule does', () => {
    const { exerciseSession, sets } = inProgress({
      sets: [at(100, 6), at(100, 6), at(100, 6), at(100, 6), at(100, 2)],
    });

    expect(projectNextLoad(exerciseSession, sets)?.weight).toBe(102.5);
  });

  it('promises nothing under a manual rule — the load never advances by itself', () => {
    const { exerciseSession, sets } = inProgress({
      rule: { type: 'manual' },
      sets: [at(100, 6), at(100, 6), at(100, 6), at(100, 6)],
    });

    expect(projectNextLoad(exerciseSession, sets)).toBeNull();
  });

  it('promises nothing before a single set is logged', () => {
    const { exerciseSession } = inProgress({ sets: [at(100, 6)] });

    expect(projectNextLoad(exerciseSession, [])).toBeNull();
  });

  it('projects in the exercise own unit, deriving weightKg from it', () => {
    const { exerciseSession, sets } = inProgress({
      sets: [at(200, 6, 'lb'), at(200, 6, 'lb'), at(200, 6, 'lb'), at(200, 6, 'lb')],
    });
    const projected = projectNextLoad(exerciseSession, sets);

    expect(projected?.weight).toBe(202.5);
    expect(projected?.unit).toBe('lb');
    expect(projected?.weightKg).toBeCloseTo(toKg(202.5, 'lb'), 5);
  });

  it('gives an unplanned exercise no projection at all (REQ-065)', () => {
    const unplanned = startUnplannedExercise({
      sessionId: toId<SessionId>('session-x'),
      exerciseId: squat,
      order: 0,
    });

    expect(projectNextLoad(unplanned, [])).toBeNull();
  });
});
