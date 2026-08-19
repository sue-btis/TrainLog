/**
 * TST-018 (REQ-074, AC-075) — accepting an import is atomic.
 * TST-022 (REQ-021, REQ-071, AC-022, AC-072) — no catalog Exercise is ever
 * written to the `exercises` table.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import { importRoutine } from '@/db/repositories/import';
import { listUserExercises } from '@/db/repositories/exercises';
import { anExercise, aFile, aWorkout } from '@/domain/routine-file/fixtures';
import { routineFileToDomain, type RoutineDraft } from '@/domain/routine-file';
import { generatePlacements } from '@/domain/scheduling';
import { toLocalDate } from '@/domain/dates';
import type { RoutineFile } from '@/domain/routine-file';
import type { Placement } from '@/domain/types';

const ANCHOR = toLocalDate('2026-09-07'); // a Monday
const CREATED_AT = 1_757_200_000_000;

/** A file whose exercises all resolve to the catalog (by id and by name). */
function catalogOnlyFile(): RoutineFile {
  return aFile([
    aWorkout({
      name: 'Push',
      suggested_days: ['monday', 'friday'],
      exercises: [
        anExercise({ name: 'Front Squat', exercise_id: 'front-squat' }),
        anExercise({ name: '  romanian   deadlift ' }), // resolves by normalized name
      ],
    }),
  ]);
}

function draftOf(file: RoutineFile): RoutineDraft {
  return routineFileToDomain(file, {
    defaultUnit: 'kg',
    existingExercises: [],
    createdAt: CREATED_AT,
  });
}

function placementsOf(draft: RoutineDraft): Placement[] {
  return generatePlacements({
    workouts: draft.workouts,
    weeks: draft.routine.weeks,
    anchorDate: ANCHOR,
  });
}

beforeEach(resetDatabase);

describe('importRoutine', () => {
  it('writes the routine, workouts, planned exercises and placements', async () => {
    const draft = draftOf(catalogOnlyFile());
    const placements = placementsOf(draft);

    const id = await importRoutine(draft, placements);

    expect(id).toBe(draft.routine.id);
    expect(await db.routines.get(id)).toEqual(draft.routine);
    expect(await db.workouts.count()).toBe(1);
    expect(await db.plannedExercises.count()).toBe(2);
    expect(await db.placements.count()).toBe(placements.length);
    expect(placements.length).toBe(8); // 4 weeks x monday + friday
  });

  // TST-022 / AC-022
  it('never writes a catalog Exercise into the exercises table', async () => {
    const draft = draftOf(catalogOnlyFile());
    expect(draft.createdExercises).toEqual([]);

    await importRoutine(draft, placementsOf(draft));

    expect(await db.exercises.count()).toBe(0);
    expect(await listUserExercises()).toEqual([]);
    // The planned exercises still reference the catalog slugs.
    const planned = await db.plannedExercises.toArray();
    expect(planned.map((p) => p.exerciseId).sort()).toEqual(['front-squat', 'romanian-deadlift']);
  });

  // AC-072
  it('writes exactly one row for one unknown exercise name', async () => {
    const file = aFile([
      aWorkout({
        suggested_days: ['monday'],
        exercises: [
          anExercise({ name: 'Front Squat', exercise_id: 'front-squat' }),
          anExercise({ name: 'Sandbag Bear Hug Carry' }),
          anExercise({ name: 'sandbag   bear hug carry' }), // the same movement
        ],
      }),
    ]);
    const draft = draftOf(file);

    await importRoutine(draft, placementsOf(draft));

    const stored = await db.exercises.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.name).toBe('Sandbag Bear Hug Carry');
  });
});

/**
 * TST-018 — failure injection (AC-075).
 *
 * The failure is induced inside Dexie, not mocked: the placement list carries
 * the same primary key twice, so the final `bulkAdd` raises a real
 * `ConstraintError` from IndexedDB after the Routine, its Workouts, its
 * PlannedExercises and the created Exercise are already written in the
 * transaction. That is the worst case — the last write of the five — so a clean
 * table set afterwards proves every earlier write rolled back with it.
 */
describe('TST-018 import atomicity', () => {
  it('leaves zero residue when a write fails mid-transaction', async () => {
    const file = aFile([
      aWorkout({
        suggested_days: ['monday'],
        exercises: [
          anExercise({ name: 'Front Squat', exercise_id: 'front-squat' }),
          anExercise({ name: 'Sandbag Bear Hug Carry' }), // forces a user Exercise
        ],
      }),
    ]);
    const draft = draftOf(file);
    const placements = placementsOf(draft);
    const first = placements[0];
    if (!first) throw new Error('fixture must generate at least one placement');

    // Every earlier write is valid; only the last one collides.
    const poisoned: Placement[] = [...placements, { ...first }];

    // A real IndexedDB ConstraintError, surfaced by Dexie as a BulkError.
    await expect(importRoutine(draft, poisoned)).rejects.toMatchObject({
      name: 'BulkError',
    });

    expect(await db.routines.count()).toBe(0);
    expect(await db.workouts.count()).toBe(0);
    expect(await db.plannedExercises.count()).toBe(0);
    expect(await db.placements.count()).toBe(0);
    expect(await db.exercises.count()).toBe(0);
  });

  it('leaves zero residue when an early write fails', async () => {
    const draft = draftOf(catalogOnlyFile());
    // Two Workouts sharing one id: the failure lands on the second write,
    // after the Routine row was added.
    const firstWorkout = draft.workouts[0];
    if (!firstWorkout) throw new Error('fixture must generate a workout');
    const poisoned: RoutineDraft = {
      ...draft,
      workouts: [firstWorkout, { ...firstWorkout }],
    };

    await expect(importRoutine(poisoned, placementsOf(draft))).rejects.toMatchObject({
      name: 'BulkError',
    });

    expect(await db.routines.count()).toBe(0);
    expect(await db.workouts.count()).toBe(0);
    expect(await db.plannedExercises.count()).toBe(0);
    expect(await db.placements.count()).toBe(0);
  });
});
