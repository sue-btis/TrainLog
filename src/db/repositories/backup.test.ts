import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import {
  exportBackup,
  listSetsForCsv,
  restoreBackup,
  restoreSummary,
} from '@/db/repositories/backup';
import { getSettings, setDefaultUnit } from '@/db/repositories/settings';
import { listUserExercises } from '@/db/repositories/exercises';
import { parseBackup, RESTORED_TABLES, type BackupDocument } from '@/domain/backup';
import { toLocalDate } from '@/domain/dates';
import { toId } from '@/domain/ids';
import type {
  CompletedSet,
  Exercise,
  ExerciseSession,
  Placement,
  PlannedExercise,
  Routine,
  Session,
  Workout,
} from '@/domain/types';
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

const EXPORTED_AT = 1_755_000_000_000;

const CATALOG = toId<ExerciseId>('front-squat');
const USER_EXERCISE = toId<ExerciseId>('user-1');

const routine: Routine = {
  id: toId<RoutineId>('r1'),
  name: 'Base',
  weeks: 4,
  status: 'active',
  createdAt: 1_754_000_000_000,
};

const workout: Workout = {
  id: toId<WorkoutId>('w1'),
  routineId: routine.id,
  name: 'Lower',
  suggestedDays: ['monday'],
  order: 0,
};

const plannedExercise: PlannedExercise = {
  id: toId<PlannedExerciseId>('pe1'),
  workoutId: workout.id,
  exerciseId: CATALOG,
  sets: 4,
  minReps: 5,
  maxReps: 6,
  minTarget: null,
  maxTarget: null,
  minRir: 1,
  maxRir: 2,
  restSeconds: 180,
  unit: 'kg',
  focus: null,
  notes: ['brace'],
  order: 0,
  progression: { type: 'double_progression', increment: 2.5 },
};

const placement: Placement = {
  id: toId<PlacementId>('p1'),
  routineId: routine.id,
  workoutId: workout.id,
  date: toLocalDate('2026-08-17'),
};

const userExercise: Exercise = {
  id: USER_EXERCISE,
  name: 'Reverse Hyper',
  category: null,
  equipment: null,
  measurement: 'weight_reps',
};

const STARTED_AT = new Date(2026, 7, 18, 18, 0).getTime();
const SESSION_DAY = toLocalDate('2026-08-18');

const session: Session = {
  id: toId<SessionId>('s1'),
  routineId: routine.id,
  workoutId: workout.id,
  startedAt: STARTED_AT,
  completedAt: STARTED_AT + 3_600_000,
  status: 'completed',
  bodyweightKg: null,
};

const plannedSession: ExerciseSession = {
  id: toId<ExerciseSessionId>('es1'),
  sessionId: session.id,
  exerciseId: CATALOG,
  order: 0,
  status: 'performed',
  measurement: 'weight_reps',
  plannedExerciseId: plannedExercise.id,
  plannedUnit: 'kg',
  plannedSets: 4,
  plannedMinReps: 5,
  plannedMaxReps: 6,
  plannedMinTarget: null,
  plannedMaxTarget: null,
  plannedMinRir: 1,
  plannedMaxRir: 2,
  plannedRestSeconds: 180,
  plannedProgression: { type: 'double_progression', increment: 2.5 },
};

const unplannedSession: ExerciseSession = {
  id: toId<ExerciseSessionId>('es2'),
  sessionId: session.id,
  exerciseId: USER_EXERCISE,
  order: 1,
  status: 'performed',
  measurement: 'weight_reps',
  plannedExerciseId: null,
};

const completedSet: CompletedSet = {
  id: toId<CompletedSetId>('cs1'),
  exerciseSessionId: plannedSession.id,
  setNumber: 1,
  weight: 75,
  unit: 'kg',
  weightKg: 75,
  reps: 6,
  rir: 2,
  durationSeconds: null,
  distance: null,
  distanceUnit: null,
  distanceM: null,
  completedAt: 1_755_100_500_000,
};

async function seed(): Promise<void> {
  await db.routines.add(routine);
  await db.workouts.add(workout);
  await db.plannedExercises.add(plannedExercise);
  await db.placements.add(placement);
  await db.exercises.add(userExercise);
  await db.sessions.add(session);
  await db.exerciseSessions.bulkAdd([plannedSession, unplannedSession]);
  await db.completedSets.add(completedSet);
}

async function snapshot(): Promise<Record<string, unknown[]>> {
  const entries = await Promise.all(
    RESTORED_TABLES.map(async (table) => [table, await db.table(table).toArray()] as const),
  );
  return Object.fromEntries(entries);
}

beforeEach(async () => {
  await resetDatabase();
});

describe('exportBackup', () => {
  it('carries every row of every table', async () => {
    await seed();
    const document = await exportBackup(EXPORTED_AT);

    expect(document.routines).toEqual([routine]);
    expect(document.workouts).toEqual([workout]);
    expect(document.plannedExercises).toEqual([plannedExercise]);
    expect(document.placements).toEqual([placement]);
    expect(document.sessions).toEqual([session]);
    expect(document.exerciseSessions).toEqual([plannedSession, unplannedSession]);
    expect(document.completedSets).toEqual([completedSet]);
  });

  it('carries user-created Exercises and no catalog Exercise', async () => {
    await seed();
    const document = await exportBackup(EXPORTED_AT);

    expect(document.exercises).toEqual([userExercise]);
    expect(document.exercises.map((exercise) => exercise.id)).not.toContain(CATALOG);
  });

  it('stamps the version and the caller‑supplied instant', async () => {
    const document = await exportBackup(EXPORTED_AT);
    expect(document.version).toBe(2);
    expect(document.exportedAt).toBe(EXPORTED_AT);
  });

  it('exports settings even though restore will not apply them', async () => {
    await setDefaultUnit('lb');
    const document = await exportBackup(EXPORTED_AT);
    expect(document.settings.defaultUnit).toBe('lb');
  });

  it('exports an empty database as an empty document', async () => {
    const document = await exportBackup(EXPORTED_AT);
    for (const table of RESTORED_TABLES) {
      expect(document[table]).toEqual([]);
    }
  });

  it('produces a document its own validator accepts', async () => {
    await seed();
    const document = await exportBackup(EXPORTED_AT);
    const result = parseBackup(JSON.stringify(document));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.ok).toBe(true);
  });
});

describe('restoreSummary', () => {
  it('counts what is here against what is coming', async () => {
    await seed();
    const document = await exportBackup(EXPORTED_AT);
    const empty: BackupDocument = { ...document, sessions: [], exerciseSessions: [], completedSets: [] };

    const summary = await restoreSummary(empty);
    expect(summary.current.sessions).toBe(1);
    expect(summary.current.completedSets).toBe(1);
    expect(summary.incoming.sessions).toBe(0);
    expect(summary.incoming.completedSets).toBe(0);
    expect(summary.current.routines).toBe(1);
  });

  it('reports an in-progress Session that is about to be destroyed', async () => {
    await seed();
    await db.sessions.put({ ...session, id: toId<SessionId>('s2'), status: 'in_progress' });
    const document = await exportBackup(EXPORTED_AT);

    expect((await restoreSummary(document)).losesSessionInProgress).toBe(true);
  });

  it('reports no in-progress Session when none is open', async () => {
    await seed();
    const document = await exportBackup(EXPORTED_AT);
    expect((await restoreSummary(document)).losesSessionInProgress).toBe(false);
  });

  it('writes nothing', async () => {
    await seed();
    const before = await snapshot();
    await restoreSummary(await exportBackup(EXPORTED_AT));
    expect(await snapshot()).toEqual(before);
  });
});

describe('restoreBackup', () => {
  function otherHistory(): BackupDocument {
    const otherRoutine: Routine = { ...routine, id: toId<RoutineId>('r2'), name: 'Block 2' };
    return {
      version: 1,
      exportedAt: EXPORTED_AT,
      routines: [otherRoutine],
      workouts: [{ ...workout, id: toId<WorkoutId>('w2'), routineId: otherRoutine.id }],
      plannedExercises: [],
      placements: [],
      exercises: [],
      sessions: [],
      exerciseSessions: [],
      completedSets: [],
      settings: { id: 'settings', defaultUnit: 'kg' },
    };
  }

  it('replaces every restored table, leaving nothing of the old database', async () => {
    await seed();
    await restoreBackup(otherHistory());

    expect(await db.routines.toArray()).toEqual([
      { ...routine, id: toId<RoutineId>('r2'), name: 'Block 2' },
    ]);
    expect(await db.sessions.toArray()).toEqual([]);
    expect(await db.completedSets.toArray()).toEqual([]);
    expect(await db.exerciseSessions.toArray()).toEqual([]);
    expect(await db.placements.toArray()).toEqual([]);
    expect(await db.plannedExercises.toArray()).toEqual([]);
    expect(await listUserExercises()).toEqual([]);
  });

  it('leaves the device its own default unit', async () => {
    await setDefaultUnit('lb');
    await restoreBackup({ ...otherHistory(), settings: { id: 'settings', defaultUnit: 'kg' } });
    expect((await getSettings()).defaultUnit).toBe('lb');
  });

  it('leaves the database untouched when a write fails part-way', async () => {
    await seed();
    const before = await snapshot();

    // The transaction must roll back tables written before the duplicate fails.
    const duplicated: BackupDocument = {
      ...otherHistory(),
      completedSets: [completedSet, completedSet],
    };

    await expect(restoreBackup(duplicated)).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it('restores an empty document as an empty database', async () => {
    await seed();
    await restoreBackup({
      version: 1,
      exportedAt: EXPORTED_AT,
      routines: [],
      workouts: [],
      plannedExercises: [],
      placements: [],
      exercises: [],
      sessions: [],
      exerciseSessions: [],
      completedSets: [],
      settings: { id: 'settings', defaultUnit: 'kg' },
    });

    for (const table of RESTORED_TABLES) {
      expect(await db.table(table).toArray()).toEqual([]);
    }
  });
});

describe('the round trip', () => {
  it('exports, serializes, and restores a database unchanged', async () => {
    await seed();
    const before = await snapshot();

    const text = JSON.stringify(await exportBackup(EXPORTED_AT));
    await resetDatabase();

    const result = parseBackup(text);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    await restoreBackup(result.document);

    expect(await snapshot()).toEqual(before);
  });

  it('survives a second round trip', async () => {
    await seed();
    const before = await snapshot();

    for (let pass = 0; pass < 2; pass += 1) {
      const text = JSON.stringify(await exportBackup(EXPORTED_AT));
      await resetDatabase();
      const result = parseBackup(text);
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      await restoreBackup(result.document);
    }

    expect(await snapshot()).toEqual(before);
  });
});

describe('listSetsForCsv', () => {
  it('is empty for a database with no sessions', async () => {
    expect(await listSetsForCsv()).toEqual([]);
  });

  it('flattens one row per logged set', async () => {
    await seed();
    expect(await listSetsForCsv()).toEqual([
      {
        date: SESSION_DAY,
        exercise: 'Front Squat',
        set: 1,
        weight: 75,
        unit: 'kg',
        reps: 6,
        rir: 2,
        measurement: 'weight_reps',
        durationSeconds: null,
        distance: null,
        distanceUnit: null,
      },
    ]);
  });

  it('names catalog and user-created Exercises alike', async () => {
    await seed();
    await db.completedSets.add({
      ...completedSet,
      id: toId<CompletedSetId>('cs2'),
      exerciseSessionId: unplannedSession.id,
    });

    const names = (await listSetsForCsv()).map((row) => row.exercise);
    expect(names).toEqual(['Front Squat', 'Reverse Hyper']);
  });

  it('carries the weight as entered with its unit', async () => {
    await seed();
    await db.completedSets.clear();
    await db.completedSets.add({
      ...completedSet,
      weight: 165,
      unit: 'lb',
      weightKg: 74.843,
    });

    expect(await listSetsForCsv()).toEqual([
      expect.objectContaining({ weight: 165, unit: 'lb' }),
    ]);
  });

  it('dates a set by the local day of its Session', async () => {
    // A UTC-derived date would drift for an evening Session in a western zone.
    const startedAt = new Date(2026, 7, 18, 22, 30).getTime();
    await seed();
    await db.sessions.update(session.id, { startedAt });

    const rows = await listSetsForCsv();
    expect(rows.map((row) => row.date)).toEqual([toLocalDate('2026-08-18')]);
  });

  it('orders sessions oldest first, and exercises by their order within one', async () => {
    await seed();
    const earlier: Session = {
      ...session,
      id: toId<SessionId>('s0'),
      startedAt: session.startedAt - 86_400_000,
    };
    await db.sessions.add(earlier);
    await db.exerciseSessions.add({
      ...unplannedSession,
      id: toId<ExerciseSessionId>('es0'),
      sessionId: earlier.id,
      order: 0,
    });
    await db.completedSets.add({
      ...completedSet,
      id: toId<CompletedSetId>('cs0'),
      exerciseSessionId: toId<ExerciseSessionId>('es0'),
    });

    const rows = await listSetsForCsv();
    expect(rows.map((row) => row.exercise)).toEqual(['Reverse Hyper', 'Front Squat']);
  });

  it('skips an exercise that was started but never logged', async () => {
    await seed();
    expect(await listSetsForCsv()).toHaveLength(1);
  });

  it('skips a Session that has no exercises at all', async () => {
    await seed();
    await db.sessions.add({
      ...session,
      id: toId<SessionId>('empty'),
      startedAt: session.startedAt + 86_400_000,
      status: 'partial',
    });

    expect(await listSetsForCsv()).toHaveLength(1);
  });

  it('falls back to the id when an Exercise resolves to no name', async () => {
    await seed();
    await db.exerciseSessions.add({
      ...unplannedSession,
      id: toId<ExerciseSessionId>('es3'),
      exerciseId: toId<ExerciseId>('vanished-exercise'),
      order: 2,
    });
    await db.completedSets.add({
      ...completedSet,
      id: toId<CompletedSetId>('cs3'),
      exerciseSessionId: toId<ExerciseSessionId>('es3'),
    });

    const names = (await listSetsForCsv()).map((row) => row.exercise);
    expect(names).toContain('vanished-exercise');
  });
});
