import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import {
  WorkoutNotFoundError,
  addPlannedExercise,
  listPlannedExercisesByWorkout,
} from '@/db/repositories/plannedExercises';
import { listWorkoutsByRoutine } from '@/db/repositories/workouts';
import { importRoutine } from '@/db/repositories/import';
import { aFile, anExercise, aWorkout } from '@/domain/routine-file/fixtures';
import { routineFileToDomain } from '@/domain/routine-file';
import { generatePlacements } from '@/domain/scheduling';
import { parseLocalDate, toLocalDate } from '@/domain/dates';
import { toId, type ExerciseId, type WorkoutId } from '@/domain/ids';
import type { CompletedSet, ExerciseSession, PlannedExercise, Session } from '@/domain/types';
import type {
  CompletedSetId,
  ExerciseSessionId,
  PlannedExerciseId,
  RoutineId,
  SessionId,
} from '@/domain/ids';

const ANCHOR = toLocalDate('2026-09-07');

const targets: Omit<PlannedExercise, 'id' | 'workoutId' | 'order'> = {
  exerciseId: toId<ExerciseId>('back-squat'),
  sets: 3,
  minReps: 8,
  maxReps: 12,
  minTarget: null,
  maxTarget: null,
  minRir: 1,
  maxRir: 2,
  restSeconds: 120,
  unit: 'kg',
  focus: null,
  notes: [],
  progression: { type: 'manual' },
};

async function importFixture(): Promise<WorkoutId> {
  const file = aFile([
    aWorkout({
      name: 'Push',
      suggested_days: ['monday'],
      exercises: [anExercise({ name: 'Front Squat', exercise_id: 'front-squat' })],
    }),
  ]);
  const draft = routineFileToDomain(file, {
    defaultUnit: 'kg',
    existingExercises: [],
    createdAt: parseLocalDate(ANCHOR).getTime(),
  });
  await importRoutine(
    draft,
    generatePlacements({ workouts: draft.workouts, weeks: 4, anchorDate: ANCHOR }),
  );
  return draft.workouts[0]!.id;
}

beforeEach(async () => {
  await resetDatabase();
});

describe('addPlannedExercise', () => {
  it('stores at the last order and is returned last', async () => {
    const workoutId = await importFixture();

    const first = await addPlannedExercise(workoutId, targets);
    const second = await addPlannedExercise(workoutId, {
      ...targets,
      exerciseId: toId<ExerciseId>('bench-press'),
    });

    const planned = await listPlannedExercisesByWorkout(workoutId);
    expect(planned.map((p) => p.id).slice(-2)).toEqual([first, second]);
    expect(planned.map((p) => p.order)).toEqual([0, 1, 2]);
  });

  it('stores the targets it was given, creating no Exercise', async () => {
    const workoutId = await importFixture();
    const exercisesBefore = await db.exercises.count();

    const id = await addPlannedExercise(workoutId, targets);

    expect(await db.plannedExercises.get(id)).toMatchObject(targets);
    expect(await db.exercises.count()).toBe(exercisesBefore);
  });

  it('refuses an unknown Workout and writes nothing', async () => {
    await importFixture();
    const before = await db.plannedExercises.count();

    await expect(
      addPlannedExercise(toId<WorkoutId>('nope'), targets),
    ).rejects.toBeInstanceOf(WorkoutNotFoundError);

    expect(await db.plannedExercises.count()).toBe(before);
  });

  it('leaves every recorded Session, ExerciseSession and CompletedSet identical', async () => {
    const workoutId = await importFixture();
    const routineId = (await listWorkoutsByRoutine(
      (await db.routines.toArray())[0]!.id as RoutineId,
    ))[0]!.routineId;
    const plannedExerciseId = (await listPlannedExercisesByWorkout(workoutId))[0]!.id;

    const session: Session = {
      id: toId<SessionId>('session-1'),
      routineId,
      workoutId,
      startedAt: 1_700_000_000_000,
      completedAt: 1_700_003_600_000,
      status: 'completed',
      bodyweightKg: null,
    };
    const exerciseSession: ExerciseSession = {
      id: toId<ExerciseSessionId>('es-1'),
      sessionId: session.id,
      exerciseId: toId<ExerciseId>('front-squat'),
      order: 0,
      status: 'performed',
      measurement: 'weight_reps',
      plannedExerciseId: plannedExerciseId as PlannedExerciseId,
      plannedUnit: 'kg',
      plannedSets: 4,
      plannedMinReps: 4,
      plannedMaxReps: 6,
      plannedMinTarget: null,
      plannedMaxTarget: null,
      plannedMinRir: 1,
      plannedMaxRir: 2,
      plannedRestSeconds: 180,
      plannedProgression: { type: 'manual' },
    };
    const completedSet: CompletedSet = {
      id: toId<CompletedSetId>('set-1'),
      exerciseSessionId: exerciseSession.id,
      setNumber: 1,
      weight: 100,
      unit: 'kg',
      weightKg: 100,
      reps: 5,
      rir: 2,
      durationSeconds: null,
      distance: null,
      distanceUnit: null,
      distanceM: null,
      completedAt: 1_700_001_000_000,
    };
    await db.sessions.add(session);
    await db.exerciseSessions.add(exerciseSession);
    await db.completedSets.add(completedSet);

    const before = {
      sessions: await db.sessions.toArray(),
      exerciseSessions: await db.exerciseSessions.toArray(),
      completedSets: await db.completedSets.toArray(),
    };

    await addPlannedExercise(workoutId, targets);

    expect(await db.sessions.toArray()).toEqual(before.sessions);
    expect(await db.exerciseSessions.toArray()).toEqual(before.exerciseSessions);
    expect(await db.completedSets.toArray()).toEqual(before.completedSets);
    expect(await listPlannedExercisesByWorkout(workoutId)).toHaveLength(2);
  });
});
