/**
 * Schema version 2 — backfilling `plannedUnit` (§34).
 *
 * These tests open a **real version-1 database** through raw IndexedDB, write
 * rows in the shape the app stored before `plannedUnit` existed, and then let
 * Dexie upgrade it. Seeding through `db.exerciseSessions` instead would prove
 * nothing: the current build always writes the field, so the rows would already
 * be well formed and the upgrade would have nothing to do.
 *
 * The failure this prevents is not theoretical. A database written before
 * commit `fb64227` exports a backup that its own validator then refuses, so the
 * lifter can save their history and not restore it.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { DATABASE_NAME, SCHEMA_V1, SCHEMA_VERSION, TrainLogDatabase } from '@/db/schema';
import { DEFAULT_UNIT } from '@/db/repositories/settings';
import { exportBackup } from '@/db/repositories/backup';
import { parseBackup } from '@/domain/backup';
import type { PlannedExerciseSession } from '@/domain/types';

/** Deletes the database outright, so each test starts before any version exists. */
function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

/**
 * Creates the database at **version 1** with the v1 stores, using raw
 * IndexedDB, and writes `rows` into the named tables.
 *
 * Deliberately not Dexie: the point is to produce the on-disk state an older
 * build left behind, which today's declarations can no longer express.
 */
function seedVersion1(rows: Record<string, readonly unknown[]>): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);

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

/** Opens the current build against whatever is on disk, running any upgrade. */
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

/** A PlannedExercise loaded in pounds — the value the upgrade has to find. */
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

/** As stored before `fb64227`: every planned field except `plannedUnit`. */
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

/** Unplanned sessions never carried `plannedUnit` and must stay untouched. */
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
  it('declares version 2', () => {
    expect(SCHEMA_VERSION).toBe(2);
  });

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

    // `lb`, not the default: the value comes from the PlannedExercise, so a
    // lifter who trained in pounds is not silently rewritten into kilograms.
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

    expect(untouched).toEqual(unplannedSession);
    expect(untouched).not.toHaveProperty('plannedUnit');
    db.close();
  });

  it('falls back to the default unit when the PlannedExercise is gone', async () => {
    await seedVersion1({
      routines: [routine],
      workouts: [workout],
      plannedExercises: [], // deleted, though §37 makes this near-impossible
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
      // Written after fb64227 in kg, while the template has since been
      // re-imported in lb. The snapshot wins — that is the point of ADR 0002.
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

  // The whole reason this migration exists.
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
