/**
 * Placement reads (§14.9). Both queries are served by a declared index
 * (AC-073): `routineId` and `date`.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import {
  deletePlacement,
  listPlacementsBetween,
  listPlacementsByRoutine,
  movePlacement,
} from '@/db/repositories/placements';
import { toLocalDate } from '@/domain/dates';
import { toId } from '@/domain/ids';
import type { PlacementId, RoutineId, WorkoutId } from '@/domain/ids';
import type { Placement, Session } from '@/domain/types';
import type { SessionId } from '@/domain/ids';

const routineA = toId<RoutineId>('routine-a');
const routineB = toId<RoutineId>('routine-b');
const workout = toId<WorkoutId>('workout-1');

function placement(id: string, routineId: RoutineId, date: string): Placement {
  return {
    id: toId<PlacementId>(id),
    routineId,
    workoutId: workout,
    date: toLocalDate(date),
  };
}

beforeEach(async () => {
  await resetDatabase();
  await db.placements.bulkAdd([
    placement('p-3', routineA, '2026-09-14'),
    placement('p-1', routineA, '2026-09-07'),
    placement('p-2', routineB, '2026-09-11'),
  ]);
});

describe('placement reads', () => {
  it('lists one routine placements in date order', async () => {
    expect((await listPlacementsByRoutine(routineA)).map((p) => p.date)).toEqual([
      '2026-09-07',
      '2026-09-14',
    ]);
  });

  it('lists a date range inclusively, across routines', async () => {
    const range = await listPlacementsBetween(toLocalDate('2026-09-07'), toLocalDate('2026-09-11'));
    expect(range.map((p) => p.id)).toEqual(['p-1', 'p-2']);
  });
});

/**
 * R-42 — the calendar's two verbs. Both assert that Sessions are untouched:
 * Placements and Sessions are independent (ADR 0001), and the moment moving
 * intent could disturb the record, the model would be broken.
 */
describe('placement mutations (R-42, §11.3)', () => {
  const aSession: Session = {
    id: toId<SessionId>('session-1'),
    routineId: routineA,
    workoutId: workout,
    startedAt: Date.parse('2026-09-07T18:00:00Z'),
    completedAt: Date.parse('2026-09-07T19:00:00Z'),
    status: 'completed',
  };

  beforeEach(async () => {
    await db.sessions.add(aSession);
  });

  it('moves one placement to another day (AC-45)', async () => {
    await movePlacement(toId<PlacementId>('p-1'), toLocalDate('2026-09-09'));

    expect((await db.placements.get(toId<PlacementId>('p-1')))?.date).toBe('2026-09-09');
    expect((await listPlacementsByRoutine(routineA)).map((p) => p.date)).toEqual([
      '2026-09-09',
      '2026-09-14',
    ]);
  });

  it('leaves every other placement and every session alone when moving (AC-45)', async () => {
    await movePlacement(toId<PlacementId>('p-1'), toLocalDate('2026-09-09'));

    expect((await db.placements.get(toId<PlacementId>('p-2')))?.date).toBe('2026-09-11');
    expect(await db.sessions.toArray()).toEqual([aSession]);
  });

  it('deletes one placement and nothing else (AC-45)', async () => {
    await deletePlacement(toId<PlacementId>('p-1'));

    expect(await db.placements.get(toId<PlacementId>('p-1'))).toBeUndefined();
    expect(await db.placements.count()).toBe(2);
    expect(await db.sessions.toArray()).toEqual([aSession]);
  });

  it('leaves the day trained even when the placement for it is deleted', async () => {
    await deletePlacement(toId<PlacementId>('p-1'));
    expect((await db.sessions.toArray())[0]?.startedAt).toBe(aSession.startedAt);
  });
});
