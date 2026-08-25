/**
 * History reads (REQ-061, REQ-062, AC-063, §11.8, §11.9, §26).
 *
 * The repository halves of TST-013 and TST-014, plus the Wave 2 proof of
 * PRD §47 flow 2: a Session performed through the real repositories produces a
 * real progression suggestion.
 *
 * Indexes exercised (AC-073): `exerciseSessions.exerciseId`,
 * `exerciseSessions.sessionId`, `completedSets.exerciseSessionId`,
 * `plannedExercises.workoutId`, and `sessions` by primary key.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import { createStartedWorkout, saveFinishedSession } from '@/db/repositories/sessions';
import {
  addExerciseSession,
  listExerciseSessionsBySession,
} from '@/db/repositories/exerciseSessions';
import { saveLoggedSet } from '@/db/repositories/completedSets';
import {
  getPreviousPerformance,
  listExerciseHistory,
  listPerformedExercises,
} from '@/db/repositories/history';
import { listPlannedExercisesByWorkout } from '@/db/repositories/plannedExercises';
import { suggestLoad } from '@/domain/progression';
import {
  finishSession,
  logSet,
  startPlannedExercise,
  startSession,
  startUnplannedExercise,
} from '@/domain/session';
import { toId } from '@/domain/ids';
import type { ExerciseId, PlannedExerciseId, RoutineId, SessionId, WorkoutId } from '@/domain/ids';
import type { PlannedExercise, Routine, Session, SessionStatus, Workout } from '@/domain/types';

/** Every exercise in these fixtures is measured by weight x reps (REQ-105). */
const measurement = 'weight_reps' as const;

const squat = toId<ExerciseId>('back-squat');
const bench = toId<ExerciseId>('barbell-bench-press');

function plannedExercise(
  id: string,
  workoutId: WorkoutId,
  exerciseId: ExerciseId,
): PlannedExercise {
  return {
    id: toId<PlannedExerciseId>(id),
    workoutId,
    exerciseId,
    sets: 4,
    minReps: 4,
    maxReps: 6,
    minTarget: null,
    maxTarget: null,
    minRir: 1,
    maxRir: 2,
    restSeconds: 180,
    unit: 'kg',
    focus: null,
    notes: [],
    order: 0,
    progression: { type: 'double_progression', increment: 2.5 },
  };
}

/** Seeds one Routine with one Workout holding one PlannedExercise for `exerciseId`. */
async function seedRoutine(
  name: string,
  exerciseId: ExerciseId,
): Promise<{ routine: Routine; workout: Workout; planned: PlannedExercise }> {
  const routine: Routine = {
    id: toId<RoutineId>(`routine-${name}`),
    name,
    weeks: 8,
    status: 'active',
    createdAt: 0,
  };
  const workout: Workout = {
    id: toId<WorkoutId>(`workout-${name}`),
    routineId: routine.id,
    name: 'Lower A',
    suggestedDays: ['monday'],
    order: 0,
  };
  const planned = plannedExercise(`pe-${name}`, workout.id, exerciseId);

  await db.routines.add(routine);
  await db.workouts.add(workout);
  await db.plannedExercises.add(planned);
  return { routine, workout, planned };
}

/**
 * Performs one Session end to end through the repositories: start it, snapshot
 * the Workout's planned exercises, log `reps` at `weight` for each, then finish.
 * `status` selects how it ends — `in_progress` leaves it open.
 */
async function performSession(
  workout: Workout,
  startedAt: number,
  reps: readonly number[],
  weight: number,
  status: SessionStatus = 'completed',
): Promise<SessionId> {
  const session = startSession({
    routineId: workout.routineId,
    workoutId: workout.id,
    startedAt,
  });
  await createStartedWorkout({ session, exerciseSessions: [] });

  for (const [order, planned] of (await listPlannedExercisesByWorkout(workout.id)).entries()) {
    let exercise = startPlannedExercise({ measurement, sessionId: session.id, planned, order });
    await addExerciseSession(exercise);

    for (const [index, count] of reps.entries()) {
      const logged = logSet({
        exerciseSession: exercise,
        setNumber: index + 1,
        weight,
        unit: 'kg',
        reps: count,
        rir: 2,
        completedAt: startedAt + index,
      });
      await saveLoggedSet(logged);
      exercise = logged.exerciseSession;
    }
  }

  if (status === 'in_progress') return session.id;

  // DEC-009 — a Session is `partial` when an exercise is still `pending` at
  // finish. An extra untouched exercise is exactly that, so the status is
  // derived by `finishSession` here rather than asserted by the test.
  if (status === 'partial') {
    await addExerciseSession(
      startUnplannedExercise({ measurement, sessionId: session.id, exerciseId: bench, order: 99 }),
    );
  }

  const exercises = await listExerciseSessionsBySession(session.id);
  const finished: Session = finishSession(session, exercises, startedAt + 3_600);
  await saveFinishedSession(finished, exercises);
  return session.id;
}

beforeEach(async () => {
  await resetDatabase();
});

describe('TST-014 (repository half) — history by exerciseId across Routines', () => {
  it('returns two Routines of Sessions as one continuous history', async () => {
    const first = await seedRoutine('one', squat);
    const second = await seedRoutine('two', squat);
    expect(first.planned.id).not.toBe(second.planned.id);

    await performSession(first.workout, 1_000, [6, 6, 6, 6], 100);
    await performSession(second.workout, 2_000, [6, 6, 6, 5], 102.5);

    const history = await listExerciseHistory(squat);

    expect(history).toHaveLength(2);
    expect(history.map((entry) => entry.session.startedAt)).toEqual([2_000, 1_000]);
    // Two different Routines, one history — the §26 continuity guarantee.
    expect(new Set(history.map((entry) => entry.session.routineId)).size).toBe(2);
    // Two different PlannedExercises behind it; the query used neither.
    expect(
      new Set(
        history.flatMap((entry) =>
          entry.exercises.map((exercise) => exercise.exerciseSession.plannedExerciseId),
        ),
      ).size,
    ).toBe(2);
    expect(history.flatMap((entry) => entry.exercises.flatMap((e) => e.sets))).toHaveLength(8);
  });

  it('returns only the requested exerciseId', async () => {
    const { workout } = await seedRoutine('one', squat);
    await performSession(workout, 1_000, [6, 6, 6, 6], 100);

    expect(await listExerciseHistory(bench)).toEqual([]);
  });
});

describe('TST-013 (repository half) — partial and in_progress stay in history', () => {
  it('returns them; the engine filters them, not the repository', async () => {
    const { workout, planned } = await seedRoutine('one', squat);

    await performSession(workout, 1_000, [6, 6, 6, 6], 100, 'partial');
    await performSession(workout, 2_000, [6, 6, 6, 6], 110, 'in_progress');

    const history = await listExerciseHistory(squat);

    expect(history.map((entry) => entry.session.status)).toEqual(['in_progress', 'partial']);
    expect(history[1]?.session.completedAt).toBe(4_600);
    expect(history.flatMap((entry) => entry.exercises.flatMap((e) => e.sets))).toHaveLength(8);
    // REQ-062 — no completed Session, therefore no suggestion, despite max reps.
    expect(suggestLoad(planned, history)).toBeNull();
  });
});

describe('previous performance (§11.8)', () => {
  it('returns the sets of the most recent Session for the exercise', async () => {
    const { workout } = await seedRoutine('one', squat);
    await performSession(workout, 1_000, [6, 6, 6, 6], 100);
    await performSession(workout, 2_000, [6, 6, 5, 5], 102.5);

    const previous = await getPreviousPerformance(squat);

    expect(previous?.session.startedAt).toBe(2_000);
    expect(previous?.exercises[0]?.sets.map((set) => [set.weight, set.reps])).toEqual([
      [102.5, 6],
      [102.5, 6],
      [102.5, 5],
      [102.5, 5],
    ]);
  });

  it('excludes the Session currently being performed', async () => {
    const { workout } = await seedRoutine('one', squat);
    await performSession(workout, 1_000, [6, 6, 6, 6], 100);
    const current = await performSession(workout, 2_000, [5], 110, 'in_progress');

    expect((await getPreviousPerformance(squat, current))?.session.startedAt).toBe(1_000);
  });

  it('is undefined with no history', async () => {
    expect(await getPreviousPerformance(squat)).toBeUndefined();
  });
});

describe('PRD §47 flow 2 — perform, persist, read back, progress', () => {
  it('feeds real repository history to suggestLoad and advances the load', async () => {
    const { workout, planned } = await seedRoutine('one', squat);

    // 4 × 4-6 with double progression, all four sets at the top of the range.
    await performSession(workout, 1_000, [6, 6, 6, 6], 100);

    const history = await listExerciseHistory(squat);
    expect(history[0]?.session.status).toBe('completed');

    expect(suggestLoad(planned, history)).toEqual({
      weight: 102.5,
      unit: 'kg',
      weightKg: 102.5,
      // The advance is read on the type's progress axis (REQ-119); weight x
      // reps progresses on load, so `value` is the same number as `weight`.
      axis: 'load',
      value: 102.5,
      targetMet: true,
    });
  });

  it('repeats the load when the rep target was missed', async () => {
    const { workout, planned } = await seedRoutine('one', squat);
    await performSession(workout, 1_000, [6, 6, 6, 4], 100);

    expect(suggestLoad(planned, await listExerciseHistory(squat))).toEqual({
      weight: 100,
      unit: 'kg',
      weightKg: 100,
      axis: 'load',
      value: 100,
      targetMet: false,
    });
  });
});

describe('performed exercises (§11.11, R-4)', () => {
  it('has nothing to offer before anything has been trained (AC-4b)', async () => {
    expect(await listPerformedExercises()).toEqual([]);
  });

  it('returns each trained exercise once, across Sessions and Routines (AC-4a)', async () => {
    const { workout } = await seedRoutine('one', squat);
    const second = await seedRoutine('two', bench);

    // Squat twice, in two Sessions of the same Routine; bench once, in another.
    await performSession(workout, 1_000, [5, 5], 100);
    await performSession(workout, 2_000, [5, 5], 102.5);
    await performSession(second.workout, 3_000, [8], 60);

    expect([...(await listPerformedExercises())].sort()).toEqual([bench, squat].sort());
  });
});
