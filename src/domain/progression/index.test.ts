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
import type { Axis, Measurement } from '@/domain/measurement';
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

const measurement = 'weight_reps' as const;

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
    minTarget: null,
    maxTarget: null,
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
  readonly reps?: number | null;
  readonly unit?: Unit;
  readonly durationSeconds?: number | null;
  readonly distance?: number | null;
  readonly distanceM?: number | null;
}

let sequence = 0;

/** One completed session containing one exercise with the given sets. */
function history(options: {
  readonly exerciseId?: ExerciseId;
  readonly status?: SessionStatus;
  readonly routineId?: string;
  readonly startedAt?: number;
  readonly rule?: ProgressionRule;
  readonly measurement?: Measurement;
  /** Anything else about the plan behind the session — set count, either target pair. */
  readonly plan?: Partial<PlannedExercise>;
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
    bodyweightKg: null,
  };

  const exerciseSession = {
    ...startPlannedExercise({
      measurement: options.measurement ?? measurement,
      sessionId: session.id,
      planned: planned({
        exerciseId: options.exerciseId ?? squat,
        progression: options.rule ?? { type: 'double_progression', increment: 2.5 },
        ...options.plan,
      }),
      order: 0,
    }),
    id: toId<ExerciseSessionId>(`exercise-session-${String(sequence)}`),
    status: 'performed' as const,
  };

  const sets: CompletedSet[] = options.sets.map((spec, index) => {
    const unit = spec.unit ?? 'kg';
    // Metres are canonical, as `distanceM` is everywhere else; a spec that
    // states either field states both.
    const distanceM = spec.distanceM ?? spec.distance ?? null;
    return {
      id: toId<CompletedSetId>(`set-${String(sequence)}-${String(index)}`),
      exerciseSessionId: exerciseSession.id,
      setNumber: index + 1,
      weight: spec.weight,
      unit,
      weightKg: toKg(spec.weight, unit),
      reps: spec.reps ?? null,
      rir: 1,
      durationSeconds: spec.durationSeconds ?? null,
      distance: spec.distance ?? distanceM,
      distanceUnit: distanceM === null ? null : 'm',
      distanceM,
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

    expect(suggestion).toEqual({
      weight: 77.5,
      unit: 'kg',
      weightKg: 77.5,
      axis: 'load',
      value: 77.5,
      targetMet: true,
    });
  });

  it('(b) one of the N sets at 5 reps suggests no increase (AC-067)', () => {
    const suggestion = suggestLoad(planned(), [
      history({ sets: [at(75, 6), at(75, 6), at(75, 5), at(75, 6)] }),
    ]);

    expect(suggestion).toEqual({
      weight: 75,
      unit: 'kg',
      weightKg: 75,
      axis: 'load',
      value: 75,
      targetMet: false,
    });
  });

  it('(c) a fifth set at max reps does not change (b) (AC-068)', () => {
    const suggestion = suggestLoad(planned(), [
      history({ sets: [at(75, 6), at(75, 6), at(75, 5), at(75, 6), at(75, 6)] }),
    ]);

    expect(suggestion).toEqual({
      weight: 75,
      unit: 'kg',
      weightKg: 75,
      axis: 'load',
      value: 75,
      targetMet: false,
    });
  });

  it('(c2) an extra set below max reps does not spoil an otherwise met target (§29)', () => {
    const suggestion = suggestLoad(planned(), [
      history({ sets: [at(75, 6), at(75, 6), at(75, 6), at(75, 6), at(75, 4)] }),
    ]);

    expect(suggestion).toEqual({
      weight: 77.5,
      unit: 'kg',
      weightKg: 77.5,
      axis: 'load',
      value: 77.5,
      targetMet: true,
    });
  });

  it('(d) fewer than N sets means the target is not met (§29)', () => {
    const suggestion = suggestLoad(planned(), [
      history({ sets: [at(75, 6), at(75, 6), at(75, 6)] }),
    ]);

    expect(suggestion).toEqual({
      weight: 75,
      unit: 'kg',
      weightKg: 75,
      axis: 'load',
      value: 75,
      targetMet: false,
    });
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
      axis: 'load',
      value: 140,
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

    expect(suggestion).toEqual({
      weight: 77.5,
      unit: 'kg',
      weightKg: 77.5,
      axis: 'load',
      value: 77.5,
      targetMet: true,
    });
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

    expect(suggestion).toEqual({
      weight: 77.5,
      unit: 'kg',
      weightKg: 77.5,
      axis: 'load',
      value: 77.5,
      targetMet: true,
    });
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

    expect(suggestion).toEqual({
      weight: 75,
      unit: 'kg',
      weightKg: 75,
      axis: 'load',
      value: 75,
      targetMet: false,
    });
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
      measurement,
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
      measurement,
      sessionId: toId<SessionId>('session-now'),
      planned: planned(),
      order: 0,
    });

    const suggestion = suggestLoad(snapshot, [
      history({ sets: [at(75, 6), at(75, 6), at(75, 6), at(75, 6)] }),
    ]);

    expect(suggestion).toEqual({
      weight: 77.5,
      unit: 'kg',
      weightKg: 77.5,
      axis: 'load',
      value: 77.5,
      targetMet: true,
    });
  });
});

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

    expect(suggestion).toEqual({
      weight: 102.5,
      unit: 'kg',
      weightKg: 102.5,
      axis: 'load',
      value: 102.5,
      targetMet: true,
    });
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

    expect(suggestion).toEqual({
      weight: 102.5,
      unit: 'kg',
      weightKg: 102.5,
      axis: 'load',
      value: 102.5,
      targetMet: true,
    });
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
      axis: 'load',
      value: 102.5,
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
      measurement,
      sessionId: toId<SessionId>('session-x'),
      exerciseId: squat,
      order: 0,
    });

    expect(projectNextLoad(unplanned, [])).toBeNull();
  });
});

interface AdvanceCase {
  readonly measurement: Measurement;
  readonly plan: Partial<PlannedExercise>;
  readonly sets: readonly SetSpec[];
  readonly expected: {
    readonly axis: Axis;
    readonly value: number;
    /** The load after the advance — unchanged for a type with no load axis. */
    readonly weight: number;
  };
}

const repPlan = (maxReps: number, increment: number): Partial<PlannedExercise> => ({
  sets: 2,
  minReps: maxReps - 2,
  maxReps,
  minTarget: null,
  maxTarget: null,
  progression: { type: 'double_progression', increment },
});

const targetPlan = (maxTarget: number, increment: number): Partial<PlannedExercise> => ({
  sets: 2,
  minReps: null,
  maxReps: null,
  minTarget: maxTarget,
  maxTarget,
  progression: { type: 'double_progression', increment },
});

const advances: readonly AdvanceCase[] = [
  {
    measurement: 'weight_reps',
    plan: repPlan(6, 2.5),
    sets: [at(100, 6), at(100, 6)],
    expected: { axis: 'load', value: 102.5, weight: 102.5 },
  },
  {
    measurement: 'bodyweight_reps',
    plan: repPlan(10, 2),
    sets: [at(0, 10), at(0, 10)],
    expected: { axis: 'reps', value: 12, weight: 0 },
  },
  {
    measurement: 'weighted_bodyweight',
    plan: repPlan(8, 2.5),
    sets: [at(20, 8), at(20, 8)],
    expected: { axis: 'load', value: 22.5, weight: 22.5 },
  },
  {
    measurement: 'assisted_bodyweight',
    plan: repPlan(8, 5),
    sets: [at(30, 8), at(30, 8)],
    expected: { axis: 'load', value: 25, weight: 25 },
  },
  {
    measurement: 'duration',
    plan: targetPlan(60, 15),
    sets: [
      { weight: 0, durationSeconds: 60 },
      { weight: 0, durationSeconds: 60 },
    ],
    expected: { axis: 'duration', value: 75, weight: 0 },
  },
  {
    measurement: 'duration_weight',
    plan: targetPlan(45, 2.5),
    sets: [
      { weight: 10, durationSeconds: 45 },
      { weight: 10, durationSeconds: 45 },
    ],
    expected: { axis: 'load', value: 12.5, weight: 12.5 },
  },
  {
    // Equal distances with a nonzero duration make pace the progress axis.
    measurement: 'distance_duration',
    plan: targetPlan(100, 1),
    sets: [
      { weight: 0, distanceM: 100, durationSeconds: 300 },
      { weight: 0, distanceM: 100, durationSeconds: 300 },
    ],
    expected: { axis: 'pace', value: 2, weight: 0 },
  },
  {
    measurement: 'weight_distance',
    plan: targetPlan(40, 5),
    sets: [
      { weight: 60, distanceM: 40 },
      { weight: 60, distanceM: 40 },
    ],
    expected: { axis: 'load', value: 65, weight: 65 },
  },
  {
    measurement: 'distance',
    plan: targetPlan(200, 10),
    sets: [
      { weight: 0, distanceM: 200 },
      { weight: 0, distanceM: 200 },
    ],
    expected: { axis: 'distance', value: 210, weight: 0 },
  },
];

describe('TST-109 the advance lands on the type own progress axis (REQ-119, AC-129, AC-130)', () => {
  it('TST-109: the table covers all nine measurement types', () => {
    expect(new Set(advances.map((advance) => advance.measurement)).size).toBe(9);
  });

  it.each(advances)(
    'TST-109: $measurement advances on $expected.axis',
    ({ measurement: type, plan, sets, expected }) => {
      const suggestion = suggestLoad(planned(plan), [history({ measurement: type, plan, sets })]);

      expect(suggestion).toEqual({
        weight: expected.weight,
        unit: 'kg',
        weightKg: expected.weight,
        axis: expected.axis,
        value: expected.value,
        targetMet: true,
      });
    },
  );

  it('AC-129: a met target on weight_reps advances the load, exactly as today', () => {
    const plan = repPlan(6, 2.5);
    const suggestion = suggestLoad(planned(plan), [
      history({ measurement: 'weight_reps', plan, sets: [at(100, 6), at(100, 6)] }),
    ]);

    expect(suggestion).toEqual({
      weight: 102.5,
      unit: 'kg',
      weightKg: 102.5,
      axis: 'load',
      value: 102.5,
      targetMet: true,
    });
  });

  it('AC-130: a met target on bodyweight_reps advances the rep target instead', () => {
    const plan = repPlan(10, 2);
    const suggestion = suggestLoad(planned(plan), [
      history({ measurement: 'bodyweight_reps', plan, sets: [at(0, 10), at(0, 10)] }),
    ]);

    // There is no load to move, so the whole advance is the two extra reps and
    // `weight` stays where it was.
    expect(suggestion).toEqual({
      weight: 0,
      unit: 'kg',
      weightKg: 0,
      axis: 'reps',
      value: 12,
      targetMet: true,
    });
  });
});

describe('TST-110 assistance falls and floors at zero (REQ-120, AC-131)', () => {
  function assisted(assistance: number, increment: number) {
    const plan = repPlan(8, increment);
    return suggestLoad(planned(plan), [
      history({
        measurement: 'assisted_bodyweight',
        plan,
        sets: [at(assistance, 8), at(assistance, 8)],
      }),
    ]);
  }

  it('AC-131: a met target takes the increment off the assistance', () => {
    expect(assisted(20, 5)).toEqual({
      weight: 15,
      unit: 'kg',
      weightKg: 15,
      axis: 'load',
      value: 15,
      targetMet: true,
    });
  });

  it('AC-131: 5 kg of assistance less an increment of 10 floors at zero, never negative', () => {
    expect(assisted(5, 10)).toEqual({
      weight: 0,
      unit: 'kg',
      weightKg: 0,
      axis: 'load',
      value: 0,
      targetMet: true,
    });
  });
});

describe('TST-111 both entry points agree on the advance (REQ-121, AC-132)', () => {
  it.each(advances)(
    'TST-111: $measurement — suggestLoad and projectNextLoad return the same suggestion',
    ({ measurement: type, plan, sets }) => {
      // One completed session read two ways: `suggestLoad` finds it in history,
      // `projectNextLoad` is handed the very same sets.
      const entry = history({ measurement: type, plan, sets });
      const [performed] = entry.exercises;
      if (performed === undefined) throw new Error('fixture built no exercise');

      const suggested = suggestLoad(performed.exerciseSession, [entry]);
      const projected = projectNextLoad(performed.exerciseSession, performed.sets);

      expect(projected).not.toBeNull();
      expect(projected).toEqual(suggested);
    },
  );
});

describe('nothing to advance on (REQ-063, REQ-119, §28)', () => {
  it('a manual rule still repeats on a non-rep type', () => {
    const plan: Partial<PlannedExercise> = {
      ...targetPlan(60, 15),
      progression: { type: 'manual' },
    };
    const suggestion = suggestLoad(planned(plan), [
      history({
        measurement: 'duration',
        plan,
        sets: [
          { weight: 0, durationSeconds: 60 },
          { weight: 0, durationSeconds: 60 },
        ],
      }),
    ]);

    expect(suggestion).toEqual({
      weight: 0,
      unit: 'kg',
      weightKg: 0,
      axis: 'duration',
      value: 60,
      targetMet: false,
    });
  });

  it('a programme that stated no range repeats rather than advances', () => {
    // No `maxTarget`: there is nothing to have met, so the metres stand.
    const plan: Partial<PlannedExercise> = {
      ...targetPlan(200, 10),
      minTarget: null,
      maxTarget: null,
    };
    const suggestion = suggestLoad(planned(plan), [
      history({
        measurement: 'distance',
        plan,
        sets: [
          { weight: 0, distanceM: 200 },
          { weight: 0, distanceM: 200 },
        ],
      }),
    ]);

    expect(suggestion).toEqual({
      weight: 0,
      unit: 'kg',
      weightKg: 0,
      axis: 'distance',
      value: 200,
      targetMet: false,
    });
  });
});
