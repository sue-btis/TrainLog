/**
 * TST-017 — a round-trip through every table of REQ-070 under `fake-indexeddb`,
 * plus AC-071: the opened database reports exactly those nine tables.
 *
 * Round-tripping each table is what proves the stored shape survives structured
 * cloning: readonly arrays (`suggestedDays`, `notes`), the embedded
 * `ProgressionRule` union (DEC-006), and the two `ExerciseSession` variants
 * (planned and unplanned) all read back field for field.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import { SCHEMA_VERSION, TABLE_NAMES } from '@/db/schema';
import { toId } from '@/domain/ids';
import type {
  CompletedSetId,
  ExerciseId,
  ExerciseSessionId,
  PlacementId,
  PlannedExerciseId,
  RoutineId,
  SessionId,
  WorkoutId,
} from '@/domain/ids';
import { toLocalDate } from '@/domain/dates';
import type {
  CompletedSet,
  Exercise,
  Placement,
  PlannedExercise,
  PlannedExerciseSession,
  Routine,
  Session,
  Settings,
  UnplannedExerciseSession,
  Workout,
} from '@/domain/types';

const routineId = toId<RoutineId>('routine-1');
const workoutId = toId<WorkoutId>('workout-1');
const plannedExerciseId = toId<PlannedExerciseId>('planned-1');
const exerciseId = toId<ExerciseId>('exercise-1');
const sessionId = toId<SessionId>('session-1');
const exerciseSessionId = toId<ExerciseSessionId>('exercise-session-1');
const frontSquatId = toId<ExerciseId>('front-squat');

const routine: Routine = {
  id: routineId,
  name: 'Hybrid Strength - September',
  weeks: 4,
  status: 'active',
  createdAt: 1_755_000_000_000,
};

const workout: Workout = {
  id: workoutId,
  routineId,
  name: 'Push - Quad + Shoulder Strength',
  suggestedDays: ['monday', 'friday'],
  order: 0,
};

const plannedExercise: PlannedExercise = {
  id: plannedExerciseId,
  workoutId,
  exerciseId: frontSquatId,
  sets: 4,
  minReps: 4,
  maxReps: 6,
  minTarget: null,
  maxTarget: null,
  minRir: 1,
  maxRir: 2,
  restSeconds: 210,
  unit: 'kg',
  focus: 'Quadriceps Strength',
  notes: ['Maintain upright torso', 'Avoid technical failure'],
  order: 0,
  progression: { type: 'double_progression', increment: 2.5 },
};

const placement: Placement = {
  id: toId<PlacementId>('placement-1'),
  routineId,
  workoutId,
  date: toLocalDate('2026-09-07'),
};

const exercise: Exercise = {
  id: exerciseId,
  name: 'Zercher Carry',
  category: null,
  equipment: null,
  measurement: 'weight_reps',
};

const session: Session = {
  id: sessionId,
  routineId,
  workoutId,
  startedAt: 1_755_100_000_000,
  completedAt: null,
  status: 'in_progress',
  bodyweightKg: null,
};

const plannedExerciseSession: PlannedExerciseSession = {
  id: exerciseSessionId,
  sessionId,
  exerciseId: frontSquatId,
  order: 0,
  status: 'performed',
  measurement: 'weight_reps',
  plannedExerciseId,
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

const unplannedExerciseSession: UnplannedExerciseSession = {
  id: toId<ExerciseSessionId>('exercise-session-2'),
  sessionId,
  exerciseId,
  order: 1,
  status: 'performed',
  measurement: 'weight_reps',
  plannedExerciseId: null,
};

const completedSet: CompletedSet = {
  id: toId<CompletedSetId>('set-1'),
  exerciseSessionId,
  setNumber: 1,
  weight: 100,
  unit: 'lb',
  weightKg: 45.359,
  reps: 6,
  rir: 1,
  durationSeconds: null,
  distance: null,
  distanceUnit: null,
  distanceM: null,
  completedAt: 1_755_100_600_000,
};

const settings: Settings = { id: 'settings', defaultUnit: 'kg' };

beforeEach(resetDatabase);

describe('Dexie schema version 1', () => {
  // AC-071
  it('declares exactly the nine tables of REQ-070', async () => {
    if (!db.isOpen()) await db.open();
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      'completedSets',
      'exerciseSessions',
      'exercises',
      'placements',
      'plannedExercises',
      'routines',
      'sessions',
      'settings',
      'workouts',
    ]);
    expect(TABLE_NAMES).toHaveLength(9);
    expect(db.verno).toBe(SCHEMA_VERSION);
  });
});

// TST-017 — one round-trip per table, each exercising that table's indexes.
describe('TST-017 round-trip per table', () => {
  it('routines', async () => {
    await db.routines.add(routine);
    expect(await db.routines.get(routineId)).toEqual(routine);
    expect(await db.routines.where('status').equals('active').toArray()).toEqual([routine]);
  });

  it('workouts', async () => {
    await db.workouts.add(workout);
    expect(await db.workouts.get(workoutId)).toEqual(workout);
    expect(await db.workouts.where('routineId').equals(routineId).toArray()).toEqual([workout]);
  });

  it('plannedExercises', async () => {
    await db.plannedExercises.add(plannedExercise);
    const stored = await db.plannedExercises.get(plannedExerciseId);
    expect(stored).toEqual(plannedExercise);
    // DEC-006: the embedded rule survives the round-trip.
    expect(stored?.progression).toEqual({ type: 'double_progression', increment: 2.5 });
    expect(await db.plannedExercises.where('workoutId').equals(workoutId).toArray()).toEqual([
      plannedExercise,
    ]);
  });

  it('placements', async () => {
    await db.placements.add(placement);
    const stored = await db.placements.get(placement.id);
    expect(stored).toEqual(placement);
    // AC-014: the day reads back as the same YYYY-MM-DD, never as an instant.
    expect(stored?.date).toBe('2026-09-07');
    expect(
      await db.placements
        .where('date')
        .between(toLocalDate('2026-09-01'), toLocalDate('2026-09-30'), true, true)
        .toArray(),
    ).toEqual([placement]);
    expect(await db.placements.where('routineId').equals(routineId).toArray()).toEqual([placement]);
  });

  it('exercises', async () => {
    await db.exercises.add(exercise);
    expect(await db.exercises.get(exerciseId)).toEqual(exercise);
  });

  it('sessions', async () => {
    await db.sessions.add(session);
    expect(await db.sessions.get(sessionId)).toEqual(session);
    expect(await db.sessions.where('status').equals('in_progress').toArray()).toEqual([session]);
    expect(await db.sessions.orderBy('startedAt').toArray()).toEqual([session]);
  });

  it('exerciseSessions, planned and unplanned', async () => {
    await db.exerciseSessions.bulkAdd([plannedExerciseSession, unplannedExerciseSession]);
    expect(await db.exerciseSessions.get(exerciseSessionId)).toEqual(plannedExerciseSession);
    expect(await db.exerciseSessions.get(unplannedExerciseSession.id)).toEqual(
      unplannedExerciseSession,
    );
    expect(await db.exerciseSessions.where('sessionId').equals(sessionId).count()).toBe(2);
    // REQ-061: history is reachable by exerciseId.
    expect(await db.exerciseSessions.where('exerciseId').equals(frontSquatId).toArray()).toEqual([
      plannedExerciseSession,
    ]);
  });

  it('completedSets', async () => {
    await db.completedSets.add(completedSet);
    expect(await db.completedSets.get(completedSet.id)).toEqual(completedSet);
    expect(
      await db.completedSets.where('exerciseSessionId').equals(exerciseSessionId).toArray(),
    ).toEqual([completedSet]);
  });

  it('settings', async () => {
    await db.settings.put(settings);
    expect(await db.settings.get('settings')).toEqual(settings);
  });
});
