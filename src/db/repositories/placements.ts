/**
 * Placements (§14.9, §11.3, ADR 0001).
 *
 * A Placement is intent. It never references a Session, and `missed` is derived
 * at query time by `isMissed` in the scheduling domain — nothing here writes it.
 * Moving and deleting a Placement belong to the calendar (§11.3), which is out
 * of scope for this change, so no mutation is exposed yet.
 */

import { db } from '@/db/database';
import type { LocalDate } from '@/domain/dates';
import type { RoutineId } from '@/domain/ids';
import type { Placement } from '@/domain/types';

/** Every Placement a Routine generated, in date order. Index: routineId. */
export async function listPlacementsByRoutine(routineId: RoutineId): Promise<Placement[]> {
  const placements = await db.placements.where('routineId').equals(routineId).toArray();
  return placements.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The calendar's range read, `from` and `to` inclusive. Index: date.
 * `LocalDate` is `YYYY-MM-DD`, so lexical order is chronological (REQ-013).
 */
export function listPlacementsBetween(from: LocalDate, to: LocalDate): Promise<Placement[]> {
  return db.placements.where('date').between(from, to, true, true).sortBy('date');
}
