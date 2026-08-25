/**
 * Schema migrations — backfilling `plannedUnit` (v2, §34) and `measurement`
 * (v3, REQ-124, REQ-125).
 *
 * These tests open a **real older database** through raw IndexedDB, write rows
 * in the shape the app stored before the field existed, and then let Dexie
 * upgrade it. Seeding through `db.exerciseSessions` instead would prove
 * nothing: the current build always writes the field, so the rows would already
 * be well formed and the upgrade would have nothing to do. The version-2 cases
 * below start at v1 and therefore run *both* upgrades, all the way to v3.
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
 * Creates the database at `version` with the v1 stores, using raw IndexedDB,
 * and writes `rows` into the named tables.
 *
 * Deliberately not Dexie: the point is to produce the on-disk state an older
 * build left behind, which today's declarations can no longer express. The
 * stores are `SCHEMA_V1` at every version so far — neither v2 nor v3 adds a
 * table or an index — so the version number is the only thing that varies.
 */
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

/** A version-1 database: no `plannedUnit`, no `measurement`, no `bodyweightKg`. */
function seedVersion1(rows: Record<string, readonly unknown[]>): Promise<void> {
  return seedAtVersion(1, rows);
}

/** A version-2 database: `plannedUnit` present, everything measurement-shaped absent. */
function seedVersion2(rows: Record<string, readonly unknown[]>): Promise<void> {
  return seedAtVersion(2, rows);
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

    // v3 gives it the `measurement` every ExerciseSession now carries; the
    // absent `plannedUnit` is what v2 promised to leave alone.
    expect(untouched).toEqual({ ...unplannedSession, measurement: 'weight_reps' });
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

/**
 * Schema version 3 — backfilling `measurement`, and touching nothing else.
 *
 * These start from a **real version-2 database**: `plannedUnit` already
 * written, everything the measurement change introduced still absent. Only the
 * v3 upgrade runs, so what these observe is that upgrade and no other.
 */
describe('schema version 3', () => {
  it('declares version 3', () => {
    expect(SCHEMA_VERSION).toBe(3);
  });

  /** A user-created Exercise as stored before `measurement` existed. */
  const v2UserExercise = {
    id: 'ux1',
    name: 'Zercher Carry',
    category: null,
    equipment: null,
  };

  /** A planned ExerciseSession as v2 wrote it: `plannedUnit`, no `measurement`. */
  const v2PlannedSession = { ...legacyPlannedSession, plannedUnit: 'lb' };

  /** The catalog knows `plank` as `duration` — see `src/domain/catalog/data.ts`. */
  const v2PlankSession = {
    id: 'es-plank',
    sessionId: 's1',
    exerciseId: 'plank',
    order: 1,
    status: 'performed',
    plannedExerciseId: null,
  };

  /** …and `weighted-dip` as `weighted_bodyweight`. */
  const v2DipSession = { ...v2PlankSession, id: 'es-dip', exerciseId: 'weighted-dip', order: 2 };

  /** Names the user Exercise above, which the same upgrade backfills first. */
  const v2UserSession = { ...v2PlankSession, id: 'es-user', exerciseId: 'ux1', order: 3 };

  /** Names an id neither the catalog nor the table knows. */
  const v2GhostSession = { ...v2PlankSession, id: 'es-ghost', exerciseId: 'gone-42', order: 4 };

  /**
   * A CompletedSet in the five-value shape v2 stored: `weight`, `unit`,
   * `weightKg`, `reps`, `rir` — and none of `durationSeconds`, `distance`,
   * `distanceUnit`, `distanceM`.
   */
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

  /** Every key a v2 `completedSets` row had, and the only keys it may still have. */
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

  // TST-113 / AC-136, AC-137, AC-138
  it('TST-113 / AC-136, AC-137: gives every exercises and exerciseSessions row a measurement', async () => {
    await seedVersion2(everything);

    const db = await openCurrent();
    const exercises = await db.exercises.toArray();
    const exerciseSessions = await db.exerciseSessions.toArray();

    expect(exercises).toHaveLength(1);
    // REQ-125: nothing on a v2 user Exercise says how it was measured, and
    // weight x reps is the only type its data proves.
    for (const row of exercises) expect(row.measurement).toBe('weight_reps');
    expect(exerciseSessions).toHaveLength(5);
    for (const row of exerciseSessions) expect(row.measurement).toBeDefined();
    db.close();
  });

  // AC-138 / DEC-L — the lossless guarantee, made executable.
  it('TST-113 / AC-138: leaves every completedSets row byte-identical', async () => {
    await seedVersion2(everything);

    const db = await openCurrent();
    const readBack = await db.completedSets.orderBy('id').toArray();
    db.close();

    // Deep equality both ways: no value changed, and no new key appeared.
    expect(readBack).toEqual([v2CompletedSet, v2OtherCompletedSet]);
    for (const row of readBack) {
      expect(Object.keys(row).sort()).toEqual(V2_SET_KEYS);
    }
  });

  // AC-139 / REQ-125
  it('AC-139: backfills a catalog slug to that slug’s catalog measurement', async () => {
    await seedVersion2(everything);

    const db = await openCurrent();
    const plank = await db.exerciseSessions.get('es-plank' as never);
    const dip = await db.exerciseSessions.get('es-dip' as never);
    db.close();

    // Not `weight_reps`: a stored plank is a duration, and the catalog says so.
    expect(plank?.measurement).toBe('duration');
    expect(dip?.measurement).toBe('weighted_bodyweight');
  });

  it('backfills a user exercise id from the exercises table row', async () => {
    await seedVersion2({
      ...everything,
      // The table row itself is measured by hand, so the session must follow it
      // rather than land on the fallback independently.
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
      // A plank that already carries a type. The stored value outranks a
      // re-derivation, exactly as an existing `plannedUnit` does.
      exerciseSessions: [{ ...v2PlankSession, measurement: 'duration_weight' }],
    });

    const db = await openCurrent();
    const untouched = await db.exerciseSessions.get('es-plank' as never);
    db.close();

    expect(untouched?.measurement).toBe('duration_weight');
  });

  // AC-140 / REQ-126
  it('AC-140: invents no bodyweight for a session written before this change', async () => {
    await seedVersion2(everything);

    const db = await openCurrent();
    const upgraded = await db.sessions.get('s1' as never);
    db.close();

    expect(upgraded?.bodyweightKg ?? null).toBeNull();
  });

  // TST-114 / REQ-127 — the failure this repo has already shipped once.
  it('TST-114: makes a version 2 database exportable *and* restorable', async () => {
    await seedVersion2({
      ...everything,
      // Without the dangling `gone-42` row: the backup validator checks
      // referential integrity, which that row deliberately breaks and which is
      // not what this case is about.
      exerciseSessions: [v2PlannedSession, v2PlankSession, v2DipSession, v2UserSession],
    });

    const db = await openCurrent();
    const document = await exportBackup(1_755_000_000_000);
    db.close();

    const result = parseBackup(JSON.stringify(document));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.ok).toBe(true);
  });

  // TST-124 — v3 adds no table; `schema.test.ts` asserts the same nine names.
  it('TST-124: still reports exactly nine tables', async () => {
    await seedVersion2(everything);

    const db = await openCurrent();
    expect(db.tables).toHaveLength(9);
    expect(db.verno).toBe(3);
    db.close();
  });
});
