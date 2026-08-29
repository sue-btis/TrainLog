import { beforeEach, describe, expect, it } from 'vitest';
import { DATABASE_NAME, SCHEMA_V1, SCHEMA_VERSION, TrainLogDatabase } from '@/db/schema';
import { DEFAULT_UNIT } from '@/db/repositories/settings';
import { exportBackup } from '@/db/repositories/backup';
import { parseBackup } from '@/domain/backup';
import type { PlannedExerciseSession } from '@/domain/types';

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

function seedAtVersion(version: number, rows: Record<string, readonly unknown[]>): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, version);

    request.onupgradeneeded = () => {
      const idb = request.result;
      for (const [table, spec] of Object.entries(SCHEMA_V1)) {
        const [primaryKey, ...indexes] = spec.split(',').map((part) => part.trim());
        const store = idb.createObjectStore(table, { keyPath: primaryKey });
        for (const index of indexes) store.createIndex(index, index);
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const idb = request.result;
      const names = Object.keys(rows);
      if (names.length === 0) {
        idb.close();
        resolve();
        return;
      }
      const tx = idb.transaction(names, 'readwrite');
      for (const [table, items] of Object.entries(rows)) {
        for (const item of items) tx.objectStore(table).put(item);
      }
      tx.oncomplete = () => {
        idb.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

function seedVersion1(rows: Record<string, readonly unknown[]>): Promise<void> {
  return seedAtVersion(1, rows);
}

function seedVersion2(rows: Record<string, readonly unknown[]>): Promise<void> {
  return seedAtVersion(2, rows);
}

async function openCurrent(): Promise<TrainLogDatabase> {
  const db = new TrainLogDatabase();
  await db.open();
  return db;
}

const routine = {
  id: 'r1',
  name: 'Base',
  weeks: 4,
  status: 'active',
  createdAt: 1_754_000_000_000,
};

const workout = { id: 'w1', routineId: 'r1', name: 'Lower', suggestedDays: ['monday'], order: 0 };

const plannedInPounds = {
  id: 'pe1',
  workoutId: 'w1',
  exerciseId: 'front-squat',
  sets: 4,
  minReps: 5,
  maxReps: 6,
  minRir: 1,
  maxRir: 2,
  restSeconds: 180,
  unit: 'lb',
  focus: null,
  notes: [],
  order: 0,
  progression: { type: 'manual' },
};

const session = {
  id: 's1',
  routineId: 'r1',
  workoutId: 'w1',
  startedAt: 1_755_100_000_000,
  completedAt: 1_755_103_000_000,
  status: 'completed',
};

const legacyPlannedSession = {
  id: 'es1',
  sessionId: 's1',
  exerciseId: 'front-squat',
  order: 0,
  status: 'performed',
  plannedExerciseId: 'pe1',
  plannedSets: 4,
  plannedMinReps: 5,
  plannedMaxReps: 6,
  plannedMinRir: 1,
  plannedMaxRir: 2,
  plannedRestSeconds: 180,
  plannedProgression: { type: 'manual' },
};

const unplannedSession = {
  id: 'es2',
  sessionId: 's1',
  exerciseId: 'front-squat',
  order: 1,
  status: 'performed',
  plannedExerciseId: null,
};

beforeEach(async () => {
  await deleteDatabase();
});

describe('schema version 2', () => {
  it('backfills plannedUnit from the PlannedExercise it was snapshotted from', async () => {
    await seedVersion1({
      routines: [routine],
      workouts: [workout],
      plannedExercises: [plannedInPounds],
      sessions: [session],
      exerciseSessions: [legacyPlannedSession],
    });

    const db = await openCurrent();
    const upgraded = (await db.exerciseSessions.get('es1' as never)) as PlannedExerciseSession;

    // The snapshot determines the unit; the current default must not rewrite it.
    expect(upgraded.plannedUnit).toBe('lb');
    db.close();
  });

  it('leaves an unplanned ExerciseSession alone', async () => {
    await seedVersion1({
      routines: [routine],
      workouts: [workout],
      plannedExercises: [plannedInPounds],
      sessions: [session],
      exerciseSessions: [legacyPlannedSession, unplannedSession],
    });

    const db = await openCurrent();
    const untouched = await db.exerciseSessions.get('es2' as never);

    // Backfill measurement without adding planned data to an unplanned row.
    expect(untouched).toEqual({ ...unplannedSession, measurement: 'weight_reps' });
    expect(untouched).not.toHaveProperty('plannedUnit');
    db.close();
  });

  it('falls back to the default unit when the PlannedExercise is gone', async () => {
    await seedVersion1({
      routines: [routine],
      workouts: [workout],
      plannedExercises: [],
      sessions: [session],
      exerciseSessions: [legacyPlannedSession],
    });

    const db = await openCurrent();
    const upgraded = (await db.exerciseSessions.get('es1' as never)) as PlannedExerciseSession;

    expect(upgraded.plannedUnit).toBe(DEFAULT_UNIT);
    db.close();
  });

  it('does not overwrite a plannedUnit that is already there', async () => {
    await seedVersion1({
      routines: [routine],
      workouts: [workout],
      plannedExercises: [plannedInPounds],
      sessions: [session],
      // An existing snapshot value outranks the current template.
      exerciseSessions: [{ ...legacyPlannedSession, plannedUnit: 'kg' }],
    });

    const db = await openCurrent();
    const upgraded = (await db.exerciseSessions.get('es1' as never)) as PlannedExerciseSession;

    expect(upgraded.plannedUnit).toBe('kg');
    db.close();
  });

  it('keeps every other table intact', async () => {
    await seedVersion1({
      routines: [routine],
      workouts: [workout],
      plannedExercises: [plannedInPounds],
      sessions: [session],
      exerciseSessions: [legacyPlannedSession],
    });

    const db = await openCurrent();

    expect(await db.routines.toArray()).toEqual([routine]);
    expect(await db.workouts.toArray()).toEqual([workout]);
    expect(await db.plannedExercises.toArray()).toEqual([plannedInPounds]);
    expect(await db.sessions.toArray()).toEqual([session]);
    db.close();
  });

  it('upgrades an empty version 1 database without complaint', async () => {
    await seedVersion1({});
    const db = await openCurrent();
    expect(await db.exerciseSessions.toArray()).toEqual([]);
    db.close();
  });

  it('makes a legacy database exportable *and* restorable', async () => {
    await seedVersion1({
      routines: [routine],
      workouts: [workout],
      plannedExercises: [plannedInPounds],
      sessions: [session],
      exerciseSessions: [legacyPlannedSession, unplannedSession],
    });

    const db = await openCurrent();
    const document = await exportBackup(1_755_000_000_000);
    db.close();

    const result = parseBackup(JSON.stringify(document));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.ok).toBe(true);
  });
});

describe('schema version 3', () => {
  it('declares version 3', () => {
    expect(SCHEMA_VERSION).toBe(3);
  });

  const v2UserExercise = {
    id: 'ux1',
    name: 'Zercher Carry',
    category: null,
    equipment: null,
  };

  const v2PlannedSession = { ...legacyPlannedSession, plannedUnit: 'lb' };

  const v2PlankSession = {
    id: 'es-plank',
    sessionId: 's1',
    exerciseId: 'plank',
    order: 1,
    status: 'performed',
    plannedExerciseId: null,
  };

  const v2DipSession = { ...v2PlankSession, id: 'es-dip', exerciseId: 'weighted-dip', order: 2 };

  const v2UserSession = { ...v2PlankSession, id: 'es-user', exerciseId: 'ux1', order: 3 };

  const v2GhostSession = { ...v2PlankSession, id: 'es-ghost', exerciseId: 'gone-42', order: 4 };

  const v2CompletedSet = {
    id: 'cs1',
    exerciseSessionId: 'es1',
    setNumber: 1,
    weight: 100,
    unit: 'lb',
    weightKg: 45.359,
    reps: 6,
    rir: 1,
    completedAt: 1_755_100_600_000,
  };

  const v2OtherCompletedSet = {
    ...v2CompletedSet,
    id: 'cs2',
    exerciseSessionId: 'es-plank',
    setNumber: 1,
    weight: 0,
    unit: 'kg',
    weightKg: 0,
    reps: 0,
    rir: 0,
  };

  const V2_SET_KEYS = [
    'completedAt',
    'exerciseSessionId',
    'id',
    'reps',
    'rir',
    'setNumber',
    'unit',
    'weight',
    'weightKg',
  ];

  const everything = {
    routines: [routine],
    workouts: [workout],
    plannedExercises: [plannedInPounds],
    exercises: [v2UserExercise],
    sessions: [session],
    exerciseSessions: [
      v2PlannedSession,
      v2PlankSession,
      v2DipSession,
      v2UserSession,
      v2GhostSession,
    ],
    completedSets: [v2CompletedSet, v2OtherCompletedSet],
  };

  it('TST-113 / AC-136, AC-137: gives every exercises and exerciseSessions row a measurement', async () => {
    await seedVersion2(everything);

    const db = await openCurrent();
    const exercises = await db.exercises.toArray();
    const exerciseSessions = await db.exerciseSessions.toArray();

    expect(exercises).toHaveLength(1);
    for (const row of exercises) expect(row.measurement).toBe('weight_reps');
    expect(exerciseSessions).toHaveLength(5);
    for (const row of exerciseSessions) expect(row.measurement).toBeDefined();
    db.close();
  });

  it('TST-113 / AC-138: leaves every completedSets row byte-identical', async () => {
    await seedVersion2(everything);

    const db = await openCurrent();
    const readBack = await db.completedSets.orderBy('id').toArray();
    db.close();

    expect(readBack).toEqual([v2CompletedSet, v2OtherCompletedSet]);
    for (const row of readBack) {
      expect(Object.keys(row).sort()).toEqual(V2_SET_KEYS);
    }
  });

  it('AC-139: backfills a catalog slug to that slug’s catalog measurement', async () => {
    await seedVersion2(everything);

    const db = await openCurrent();
    const plank = await db.exerciseSessions.get('es-plank' as never);
    const dip = await db.exerciseSessions.get('es-dip' as never);
    db.close();

    expect(plank?.measurement).toBe('duration');
    expect(dip?.measurement).toBe('weighted_bodyweight');
  });

  it('backfills a user exercise id from the exercises table row', async () => {
    await seedVersion2({
      ...everything,
      // A user row's measurement takes precedence over the fallback.
      exercises: [{ ...v2UserExercise, measurement: 'distance' }],
    });

    const db = await openCurrent();
    const fromTable = await db.exerciseSessions.get('es-user' as never);
    db.close();

    expect(fromTable?.measurement).toBe('distance');
  });

  it('falls back to weight_reps when the exerciseId resolves to nothing', async () => {
    await seedVersion2(everything);

    const db = await openCurrent();
    const ghost = await db.exerciseSessions.get('es-ghost' as never);
    db.close();

    expect(ghost?.measurement).toBe('weight_reps');
  });

  it('does not overwrite a measurement that is already there', async () => {
    await seedVersion2({
      ...everything,
      // Existing stored values outrank re-derivation.
      exerciseSessions: [{ ...v2PlankSession, measurement: 'duration_weight' }],
    });

    const db = await openCurrent();
    const untouched = await db.exerciseSessions.get('es-plank' as never);
    db.close();

    expect(untouched?.measurement).toBe('duration_weight');
  });

  it('AC-140: invents no bodyweight for a session written before this change', async () => {
    await seedVersion2(everything);

    const db = await openCurrent();
    const upgraded = await db.sessions.get('s1' as never);
    db.close();

    expect(upgraded?.bodyweightKg ?? null).toBeNull();
  });

  it('TST-114: makes a version 2 database exportable *and* restorable', async () => {
    await seedVersion2({
      ...everything,
      // Exclude the deliberately dangling row; this case tests migration output.
      exerciseSessions: [v2PlannedSession, v2PlankSession, v2DipSession, v2UserSession],
    });

    const db = await openCurrent();
    const document = await exportBackup(1_755_000_000_000);
    db.close();

    const result = parseBackup(JSON.stringify(document));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.ok).toBe(true);
  });

  it('TST-124: still reports exactly nine tables', async () => {
    await seedVersion2(everything);

    const db = await openCurrent();
    expect(db.tables).toHaveLength(9);
    expect(db.verno).toBe(3);
    db.close();
  });
});
