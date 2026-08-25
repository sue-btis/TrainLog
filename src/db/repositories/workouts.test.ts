/**
 * TST-410…414, TST-418, TST-419 (REQ-400…403, REQ-411, REQ-414, REQ-416,
 * REQ-417) — adding a Workout to a Routine already running.
 *
 * The invariant under test is DEC-B's: the add is purely additive. Nothing
 * stored is rewritten, the Routine rows are untouched, and what the writer
 * reports is what it actually wrote.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import { archiveRoutine } from '@/db/repositories/routines';
import {
  RoutineNotActiveError,
  RoutineNotFoundError,
  WorkoutNameRequiredError,
  addWorkoutToRoutine,
  listWorkoutsByRoutine,
} from '@/db/repositories/workouts';
import { listPlacementsByRoutine } from '@/db/repositories/placements';
import { importRoutine } from '@/db/repositories/import';
import { createStartedWorkout } from '@/db/repositories/sessions';
import { exportBackup, restoreBackup } from '@/db/repositories/backup';
import { aFile, anExercise, aWorkout } from '@/domain/routine-file/fixtures';
import { routineFileToDomain } from '@/domain/routine-file';
import { generatePlacements } from '@/domain/scheduling';
import { parseLocalDate, toLocalDate } from '@/domain/dates';
import { newId, toId, type RoutineId, type SessionId } from '@/domain/ids';
import type { Session } from '@/domain/types';

/** A Monday, matching the anchor the other repository tests use. */
const ANCHOR = toLocalDate('2026-09-07');
const anchorAt = parseLocalDate(ANCHOR).getTime();

async function importFixture(weeks = 8, createdAt = anchorAt): Promise<RoutineId> {
  const file = aFile([
    aWorkout({
      name: 'Push',
      suggested_days: ['monday'],
      exercises: [anExercise({ name: 'Front Squat', exercise_id: 'front-squat' })],
    }),
  ]);
  const draft = routineFileToDomain(
    { ...file, routine: { ...file.routine, weeks } },
    { defaultUnit: 'kg', existingExercises: [], createdAt },
  );
  await importRoutine(
    draft,
    generatePlacements({ workouts: draft.workouts, weeks, anchorDate: ANCHOR }),
  );
  return draft.routine.id;
}

beforeEach(async () => {
  await resetDatabase();
});

describe('addWorkoutToRoutine', () => {
  // TST-410
  it('writes the Workout and places it from today forward', async () => {
    const routineId = await importFixture(8);
    const today = toLocalDate('2026-09-30');

    const added = await addWorkoutToRoutine(routineId, {
      name: 'Pull',
      suggestedDays: ['tuesday'],
      today,
    });

    const placements = await listPlacementsByRoutine(routineId);
    const mine = placements.filter((p) => p.workoutId === added.workoutId);

    // Five weeks are left, but this week's Tuesday (09-29) is already behind
    // today, so it is not placed: "from today forward" is per date, not per
    // week. Four Tuesdays remain.
    expect(added.placementCount).toBe(mine.length);
    expect(mine).toHaveLength(4);
    expect(mine.map((p) => p.date)).toEqual([
      '2026-10-06',
      '2026-10-13',
      '2026-10-20',
      '2026-10-27',
    ]);
    expect(mine.every((p) => p.date >= today)).toBe(true);
  });

  // TST-411
  it('still adds the Workout when the block has run out, with no Placements', async () => {
    const routineId = await importFixture(4);

    const added = await addWorkoutToRoutine(routineId, {
      name: 'Pull',
      suggestedDays: ['monday'],
      today: toLocalDate('2026-12-07'),
    });

    expect(added.placementCount).toBe(0);
    const workouts = await listWorkoutsByRoutine(routineId);
    expect(workouts.map((w) => w.name)).toEqual(['Push', 'Pull']);
  });

  // TST-411 — the other way to place nothing: no day was chosen.
  it('still adds the Workout when no suggested day was chosen', async () => {
    const routineId = await importFixture(8);

    const added = await addWorkoutToRoutine(routineId, {
      name: 'Pull',
      suggestedDays: [],
      today: toLocalDate('2026-09-30'),
    });

    expect(added.placementCount).toBe(0);
    expect(await listWorkoutsByRoutine(routineId)).toHaveLength(2);
  });

  // TST-412
  it('leaves every Routine row and status untouched', async () => {
    // The second import archives the first, so the *second* is the active one
    // and the first is the archived neighbour the add must not touch either.
    await importFixture(8);
    const active = await importFixture(8);
    const before = await db.routines.toArray();
    expect(before.filter((r) => r.status === 'active')).toHaveLength(1);

    await addWorkoutToRoutine(active, {
      name: 'Pull',
      suggestedDays: ['tuesday'],
      today: toLocalDate('2026-09-30'),
    });

    expect(await db.routines.toArray()).toEqual(before);
  });

  // TST-414
  it('takes the last rotation position, one past the highest order', async () => {
    const routineId = await importFixture(8);
    const today = toLocalDate('2026-09-30');

    await addWorkoutToRoutine(routineId, { name: 'Pull', suggestedDays: [], today });
    await addWorkoutToRoutine(routineId, { name: 'Legs', suggestedDays: [], today });

    const workouts = await listWorkoutsByRoutine(routineId);
    expect(workouts.map((w) => w.name)).toEqual(['Push', 'Pull', 'Legs']);
    expect(workouts.map((w) => w.order)).toEqual([0, 1, 2]);
  });

  // TST-413
  it('refuses a blank name, an unknown Routine and an archived one, writing nothing', async () => {
    const routineId = await importFixture(8);
    const today = toLocalDate('2026-09-30');
    const before = await db.workouts.count();

    await expect(
      addWorkoutToRoutine(routineId, { name: '   ', suggestedDays: [], today }),
    ).rejects.toBeInstanceOf(WorkoutNameRequiredError);

    await expect(
      addWorkoutToRoutine(toId<RoutineId>('nope'), { name: 'Pull', suggestedDays: [], today }),
    ).rejects.toBeInstanceOf(RoutineNotFoundError);

    await archiveRoutine(routineId);
    await expect(
      addWorkoutToRoutine(routineId, { name: 'Pull', suggestedDays: [], today }),
    ).rejects.toBeInstanceOf(RoutineNotActiveError);

    expect(await db.workouts.count()).toBe(before);
    // `placements` carries no `workoutId` index (SCHEMA_V1), so this reads the
    // table rather than querying it — a full scan is fine over a fixture.
    const names = (await db.workouts.toArray()).map((w) => w.name);
    expect(names).toEqual(['Push']);
  });

  // TST-418 — REQ-416: an added Workout is trainable before it has exercises.
  it('produces a Workout that starts a Session with no exercises', async () => {
    const routineId = await importFixture(8);
    const added = await addWorkoutToRoutine(routineId, {
      name: 'Pull',
      suggestedDays: [],
      today: toLocalDate('2026-09-30'),
    });

    const session: Session = {
      id: newId<SessionId>(),
      routineId,
      workoutId: added.workoutId,
      startedAt: 1_700_000_000_000,
      completedAt: null,
      status: 'in_progress',
      bodyweightKg: null,
    };
    await createStartedWorkout({ session, exerciseSessions: [] });

    expect(await db.sessions.count()).toBe(1);
    expect(await db.exerciseSessions.count()).toBe(0);
  });

  // TST-419 — demonstrates ASM-1: no schema or backup version had to move.
  it('round-trips through export and restore', async () => {
    const routineId = await importFixture(8);
    const added = await addWorkoutToRoutine(routineId, {
      name: 'Pull',
      suggestedDays: ['tuesday'],
      today: toLocalDate('2026-09-30'),
    });

    const document = await exportBackup(1_700_000_000_000);
    await resetDatabase();
    expect(await db.workouts.count()).toBe(0);

    await restoreBackup(document);

    const workouts = await listWorkoutsByRoutine(routineId);
    expect(workouts.map((w) => w.name)).toEqual(['Push', 'Pull']);
    expect(
      (await listPlacementsByRoutine(routineId)).filter((p) => p.workoutId === added.workoutId),
    ).toHaveLength(added.placementCount);
  });
});
