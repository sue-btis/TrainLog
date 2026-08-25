/**
 * Placements (§14.9, §11.3, ADR 0001).
 *
 * A Placement is intent. It never references a Session, and `missed` is derived
 * at query time by `isMissed` in the scheduling domain — nothing here writes it.
 *
 * Moving and deleting are the calendar's two verbs (§11.3): "las Placements se
 * generan en el asistente y luego pueden moverse o eliminarse libremente".
 * Neither reads or writes a Session — the two are independent by design
 * (ADR 0001), so moving a Placement onto a day that was already trained leaves
 * both facts standing, which is exactly what the calendar should show.
 *
 * There is no `addPlacement`: §11.3 grants the calendar move and delete only.
 * Placements are generated, never hand-placed — by an import, or by adding a
 * Workout to a Routine already running, and in both cases inside that write's
 * own transaction.
 */

import { db } from '@/db/database';
import type { LocalDate } from '@/domain/dates';
import type { PlacementId, RoutineId } from '@/domain/ids';
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

/** Moves a Placement to another day. Sessions are untouched (R-42, §11.3). */
export async function movePlacement(id: PlacementId, date: LocalDate): Promise<void> {
  await db.placements.update(id, { date });
}

/**
 * Deletes one Placement (R-42, §11.3).
 *
 * Intent can be discarded; the record cannot. A Session performed on that day
 * survives untouched and keeps rendering, because it never referenced the
 * Placement in the first place (ADR 0001).
 */
export async function deletePlacement(id: PlacementId): Promise<void> {
  await db.placements.delete(id);
}
