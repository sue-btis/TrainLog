import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import { importRoutine } from '@/db/repositories/import';
import { listUserExercises } from '@/db/repositories/exercises';
import { anExercise, aFile, aWorkout } from '@/domain/routine-file/fixtures';
import {
  addExercise,
  addWorkout,
  blankRoutineFile,
  routineFileToDomain,
  setRoutineName,
  validateRoutineFile,
  type RoutineDraft,
} from '@/domain/routine-file';
import { generatePlacements } from '@/domain/scheduling';
import { toLocalDate } from '@/domain/dates';
import type { RoutineFile } from '@/domain/routine-file';
import type { Placement } from '@/domain/types';

const ANCHOR = toLocalDate('2026-09-07');
const CREATED_AT = 1_757_200_000_000;

function catalogOnlyFile(): RoutineFile {
  return aFile([
    aWorkout({
      name: 'Push',
      suggested_days: ['monday', 'friday'],
      exercises: [
        anExercise({ name: 'Front Squat', exercise_id: 'front-squat' }),
        anExercise({ name: '  romanian   deadlift ' }),
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
    expect(placements.length).toBe(8);
  });

  it('never writes a catalog Exercise into the exercises table', async () => {
    const draft = draftOf(catalogOnlyFile());
    expect(draft.createdExercises).toEqual([]);

    await importRoutine(draft, placementsOf(draft));

    expect(await db.exercises.count()).toBe(0);
    expect(await listUserExercises()).toEqual([]);
    const planned = await db.plannedExercises.toArray();
    expect(planned.map((p) => p.exerciseId).sort()).toEqual(['front-squat', 'romanian-deadlift']);
  });

  it('writes exactly one row for one unknown exercise name', async () => {
    const file = aFile([
      aWorkout({
        suggested_days: ['monday'],
        exercises: [
          anExercise({ name: 'Front Squat', exercise_id: 'front-squat' }),
          anExercise({ name: 'Sandbag Bear Hug Carry' }),
          anExercise({ name: 'sandbag   bear hug carry' }),
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

/** A successful active import must leave only one active Routine. */
describe('importRoutine — at most one active Routine', () => {
  it('archives the previously active Routine when a new one is accepted', async () => {
    const first = draftOf(catalogOnlyFile());
    await importRoutine(first, placementsOf(first));

    const second = draftOf(catalogOnlyFile());
    await importRoutine(second, placementsOf(second));

    const active = await db.routines.where('status').equals('active').toArray();
    expect(active.map((routine) => routine.id)).toEqual([second.routine.id]);
    expect((await db.routines.get(first.routine.id))?.status).toBe('archived');
  });

  it('leaves the previous Routine active when the import fails', async () => {
    const first = draftOf(catalogOnlyFile());
    await importRoutine(first, placementsOf(first));

    const second = draftOf(catalogOnlyFile());
    const placements = placementsOf(second);
    const head = placements[0];
    if (!head) throw new Error('fixture must generate at least one placement');

    await expect(importRoutine(second, [...placements, { ...head }])).rejects.toMatchObject({
      name: 'BulkError',
    });

    const active = await db.routines.where('status').equals('active').toArray();
    expect(active.map((routine) => routine.id)).toEqual([first.routine.id]);
  });
});

/** A duplicate key must roll back all writes in the import transaction. */
describe('TST-018 import atomicity', () => {
  it('leaves zero residue when a write fails mid-transaction', async () => {
    const file = aFile([
      aWorkout({
        suggested_days: ['monday'],
        exercises: [
          anExercise({ name: 'Front Squat', exercise_id: 'front-squat' }),
          anExercise({ name: 'Sandbag Bear Hug Carry' }),
        ],
      }),
    ]);
    const draft = draftOf(file);
    const placements = placementsOf(draft);
    const first = placements[0];
    if (!first) throw new Error('fixture must generate at least one placement');

    const poisoned: Placement[] = [...placements, { ...first }];

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

describe('accepting a from-scratch routine', () => {
  it('writes it, activates it, and archives the routine that was active', async () => {
    const first = routineFileToDomain(catalogOnlyFile(), {
      defaultUnit: 'kg',
      existingExercises: [],
      createdAt: CREATED_AT,
    });
    await importRoutine(first, []);

    const authored = addExercise(
      addWorkout(setRoutineName(blankRoutineFile(4), 'Winter Block'), 'Push'),
      0,
      anExercise({ name: 'Zercher Good Morning' }),
    );
    expect(validateRoutineFile(authored)).toEqual([]);

    const draft = routineFileToDomain(authored, {
      defaultUnit: 'kg',
      existingExercises: await listUserExercises(),
      createdAt: CREATED_AT + 1,
    });
    const placements = generatePlacements({
      workouts: draft.workouts,
      weeks: draft.routine.weeks,
      anchorDate: ANCHOR,
    });
    expect(placements).toEqual([]);

    await importRoutine(draft, placements);

    const stored = await db.routines.get(draft.routine.id);
    expect(stored?.name).toBe('Winter Block');
    expect(stored?.status).toBe('active');
    expect((await db.routines.get(first.routine.id))?.status).toBe('archived');

    expect(await db.workouts.where('routineId').equals(draft.routine.id).count()).toBe(1);
    expect(await db.plannedExercises.count()).toBe(
      first.plannedExercises.length + 1,
    );
    expect(await db.placements.where('routineId').equals(draft.routine.id).count()).toBe(0);

    const names = (await listUserExercises()).map((e) => e.name);
    expect(names).toContain('Zercher Good Morning');
  });
});
