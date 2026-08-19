/**
 * Placement reads (§14.9). Both queries are served by a declared index
 * (AC-073): `routineId` and `date`.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import { listPlacementsBetween, listPlacementsByRoutine } from '@/db/repositories/placements';
import { toLocalDate } from '@/domain/dates';
import { toId } from '@/domain/ids';
import type { PlacementId, RoutineId, WorkoutId } from '@/domain/ids';
import type { Placement } from '@/domain/types';

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
