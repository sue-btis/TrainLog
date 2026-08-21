/**
 * Export, restore, and the round-trip between them (AC-3, AC-6, AC-7).
 *
 * The round-trip is the load-bearing test in this change. Export and restore
 * are a writer and a reader of one format, and a disagreement between them does
 * not throw — it produces a database that looks plausible and is wrong, on the
 * one copy of a lifter's history that exists. Everything else here checks a
 * property; `exports then restores unchanged` checks that the pair agree.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import {
  exportBackup,
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

/** A catalog slug — never written to `exercises` (DEC-007). */
const CATALOG = toId<ExerciseId>('front-squat');
/** A user-created Exercise — it must travel inside the document. */
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
};

const session: Session = {
  id: toId<SessionId>('s1'),
  routineId: routine.id,
  workoutId: workout.id,
  startedAt: 1_755_100_000_000,
  completedAt: 1_755_103_000_000,
  status: 'completed',
};

const plannedSession: ExerciseSession = {
  id: toId<ExerciseSessionId>('es1'),
  sessionId: session.id,
  exerciseId: CATALOG,
  order: 0,
  status: 'performed',
  plannedExerciseId: plannedExercise.id,
  plannedUnit: 'kg',
  plannedSets: 4,
  plannedMinReps: 5,
  plannedMaxReps: 6,
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
  completedAt: 1_755_100_500_000,
};

/** Fills every table: a routine, a session against it, one logged set. */
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

/** Every restored table's rows, keyed by table, for whole-database comparison. */
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

  // AC-3 — §17: "el catálogo base no se exporta".
  it('carries user-created Exercises and no catalog Exercise', async () => {
    await seed();
    const document = await exportBackup(EXPORTED_AT);

    expect(document.exercises).toEqual([userExercise]);
    expect(document.exercises.map((exercise) => exercise.id)).not.toContain(CATALOG);
  });

  it('stamps the version and the caller‑supplied instant', async () => {
    const document = await exportBackup(EXPORTED_AT);
    expect(document.version).toBe(1);
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

  // The check that keeps the writer honest: whatever export produces must pass
  // the validator restore puts every document through.
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

  // AC-6b — the lifter is told the live session is among the losses.
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
  /** A document describing a different training history than `seed()` wrote. */
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

  // AC-7a — replace, never merge (§18, §37).
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

  // AC-7b — §18 lists what restore replaces, and settings is not on it.
  it('leaves the device its own default unit', async () => {
    await setDefaultUnit('lb');
    await restoreBackup({ ...otherHistory(), settings: { id: 'settings', defaultUnit: 'kg' } });
    expect((await getSettings()).defaultUnit).toBe('lb');
  });

  // AC-7c — a partial restore is a corrupt database.
  it('leaves the database untouched when a write fails part-way', async () => {
    await seed();
    const before = await snapshot();

    // A duplicate id inside one table: the tables written before it have
    // already been cleared and refilled when `bulkAdd` rejects.
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

// ------------------------------------------------------------- Integration Gate A

describe('the round trip', () => {
  /**
   * Export → wipe → parse → restore, and the eight restored tables must come
   * back exactly. This proves the writer and the reader agree about the format,
   * which no test of either one alone can show.
   *
   * `settings` is excluded because R-7 excludes it, not because it was
   * overlooked: §18 lists the tables restore replaces and settings is not among
   * them.
   */
  it('exports, serializes, and restores a database unchanged', async () => {
    await seed();
    const before = await snapshot();

    // Through a real string, exactly as the file would travel.
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
