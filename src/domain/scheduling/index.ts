/**
 * Scheduling (REQ-040…044, §11.3, §11.4, §14.9, ADR 0001).
 *
 * A Workout carries no date; the calendar is a set of user-owned Placements
 * generated once, at import, from the advisory `suggestedDays`. Nothing here
 * reads the clock: `anchorDate` and `today` are always parameters (DEC-008),
 * and nothing here writes — `missed` is derived at query time (§11.3).
 */

import {
  addDays,
  formatLocalDate,
  mondayOfWeek,
  type LocalDate,
} from '@/domain/dates';
import { newId, type PlacementId, type WorkoutId } from '@/domain/ids';
import type { Placement, Session, Weekday, Workout } from '@/domain/types';

/** Days after the Monday that opens the week (DEC-008: week 1 begins on a Monday). */
const DAYS_AFTER_MONDAY: Record<Weekday, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

export interface GeneratePlacementsOptions {
  readonly workouts: readonly Workout[];
  /** How many weeks of Placements to generate — the Routine's `weeks` (§12). */
  readonly weeks: number;
  /** The day the schedule is anchored to. Required, never defaulted (DEC-008). */
  readonly anchorDate: LocalDate;
}

/**
 * One Placement per suggested day per week, for `weeks` weeks (REQ-040).
 *
 * Week 1 is the seven days beginning on the Monday of the week containing
 * `anchorDate`; dates strictly before the anchor are omitted, so importing
 * mid-week creates nothing in the past (REQ-041). Two Workouts sharing a day
 * both emit — the wizard's one-per-day rule is semantic validation, not this
 * (REQ-042, §14.9). Returned in date order, then in `workouts` order.
 */
export function generatePlacements({
  workouts,
  weeks,
  anchorDate,
}: GeneratePlacementsOptions): Placement[] {
  const firstMonday = mondayOfWeek(anchorDate);
  const placements: Placement[] = [];

  for (let week = 0; week < weeks; week += 1) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const date = addDays(firstMonday, week * 7 + dayOffset);
      if (date < anchorDate) continue; // LocalDate is YYYY-MM-DD: lexical order is chronological.
      for (const workout of workouts) {
        if (!workout.suggestedDays.some((day) => DAYS_AFTER_MONDAY[day] === dayOffset)) continue;
        placements.push({
          id: newId<PlacementId>(),
          routineId: workout.routineId,
          workoutId: workout.id,
          date,
        });
      }
    }
  }

  return placements;
}

/**
 * The next Workout in the file's rotation (REQ-043, §11.4) — what Today falls
 * back to when the day has no Placement. Wraps at the end, and returns the
 * first Workout when nothing has been performed or the last one is gone.
 */
export function nextWorkoutInRotation(
  workouts: readonly Workout[],
  lastPerformedWorkoutId: WorkoutId | null,
): Workout | null {
  const rotation = [...workouts].sort((a, b) => a.order - b.order);
  if (rotation.length === 0) return null;

  const lastIndex = rotation.findIndex((workout) => workout.id === lastPerformedWorkoutId);
  return rotation[(lastIndex + 1) % rotation.length] ?? null;
}

/**
 * Whether a Placement reads as *missed*: its date is before `today` and no
 * Session for that Workout was recorded on that day (REQ-044, §11.3).
 *
 * Derived, never stored — this writes nothing (ADR 0001).
 *
 * A Session carries `startedAt` as an instant, a Placement carries a calendar
 * day, so the comparison converts the instant to the local day it fell on with
 * `formatLocalDate` (never its UTC day — REQ-013). This is the one spot where a
 * timezone bug could hide: a session started at 23:30 belongs to that local day.
 */
export function isMissed(
  placement: Placement,
  sessions: readonly Session[],
  today: LocalDate,
): boolean {
  if (placement.date >= today) return false;
  return !sessions.some(
    (session) =>
      session.workoutId === placement.workoutId &&
      formatLocalDate(new Date(session.startedAt)) === placement.date,
  );
}
