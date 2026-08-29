/** Placements are independent intent; missed status is derived elsewhere. */
import { db } from '@/db/database';
import type { LocalDate } from '@/domain/dates';
import type { PlacementId, RoutineId } from '@/domain/ids';
import type { Placement } from '@/domain/types';

export async function listPlacementsByRoutine(routineId: RoutineId): Promise<Placement[]> {
  const placements = await db.placements.where('routineId').equals(routineId).toArray();
  return placements.sort((a, b) => a.date.localeCompare(b.date));
}

export function listPlacementsBetween(from: LocalDate, to: LocalDate): Promise<Placement[]> {
  return db.placements.where('date').between(from, to, true, true).sortBy('date');
}

export async function movePlacement(id: PlacementId, date: LocalDate): Promise<void> {
  await db.placements.update(id, { date });
}

/** Deleting intent does not delete a Session performed on that day. */
export async function deletePlacement(id: PlacementId): Promise<void> {
  await db.placements.delete(id);
}
