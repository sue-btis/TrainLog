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
import type {
  Placement,
  PlannedExercise,
  Session,
  Weekday,
  Workout,
} from '@/domain/types';

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

/**
 * What became of one Placement (§11.3).
 *
 * `isMissed` answers half the question — it says "past and untrained" — and
 * every caller that needed the other half was labelling an answered Placement
 * `planned`, which put the word "planned" beside the record of the session that
 * answered it. Three states, one match rule, stated once.
 *
 * Derived, never stored. `kept` is not a link between the two entities: it is
 * the same workout-and-day comparison `isMissed` makes, read the other way
 * round (ADR 0001).
 */
export type PlacementState = 'planned' | 'kept' | 'missed';

export function placementState(
  placement: Placement,
  sessions: readonly Session[],
  today: LocalDate,
): PlacementState {
  // Today is not over, so today's Placement is still ahead of you.
  if (placement.date >= today) return 'planned';
  return isMissed(placement, sessions, today) ? 'missed' : 'kept';
}

/**
 * The six states a calendar day can read as (§11.3).
 *
 * `rest` is simply a day the programme never claimed — not a failure, and not
 * a stored fact.
 */
export type DayState =
  | 'completed'
  | 'partial'
  | 'in_progress'
  | 'planned'
  | 'missed'
  | 'rest';

/**
 * What one calendar day reads as, derived from Placements and Sessions alone
 * (§11.3, ADR 0001). Pure: it reads no clock — `today` is a parameter — and it
 * writes nothing, so `missed` never becomes a stored fact.
 *
 * What happened outranks what was planned, because the calendar's job is to
 * show the record. Among Sessions, an open one outranks a finished one: a
 * lifter training right now needs to see that before anything else.
 */
export function dayState(
  placements: readonly Placement[],
  sessions: readonly Session[],
  date: LocalDate,
  today: LocalDate,
): DayState {
  const onDay = sessions.filter(
    (session) => formatLocalDate(new Date(session.startedAt)) === date,
  );
  if (onDay.some((session) => session.status === 'in_progress')) return 'in_progress';
  // Among finished Sessions, a partial one is the more informative fact.
  if (onDay.some((session) => session.status === 'partial')) return 'partial';
  if (onDay.length > 0) return 'completed';

  const planned = placements.filter((placement) => placement.date === date);
  if (planned.length === 0) return 'rest';

  // Reuse the one definition of missed rather than restating it (REQ-044).
  return planned.some((placement) => isMissed(placement, sessions, today))
    ? 'missed'
    : 'planned';
}

/**
 * Session length estimate for Today (§11.4), which shows `~75 min` but defines
 * no formula. This one is the change owner's, frozen as three constants so a
 * later adjustment is deliberate rather than drift:
 *
 *   Σ sets × (rest + work), 90s assumed when the exercise declares no rest
 *
 * Rounded to five minutes, because a minute-precise estimate of a gym session
 * claims an accuracy nobody has.
 */
export const WORK_SECONDS_PER_SET = 45;
export const DEFAULT_REST_SECONDS = 90;
export const ROUNDING_MINUTES = 5;

/** Estimated minutes for a Workout, rounded to `ROUNDING_MINUTES`. */
export function estimateDuration(plannedExercises: readonly PlannedExercise[]): number {
  const seconds = plannedExercises.reduce(
    (total, exercise) =>
      total +
      exercise.sets * ((exercise.restSeconds ?? DEFAULT_REST_SECONDS) + WORK_SECONDS_PER_SET),
    0,
  );
  return Math.round(seconds / 60 / ROUNDING_MINUTES) * ROUNDING_MINUTES;
}

/**
 * What a month came to, in five counts (§11.3).
 *
 * The calendar draws six colours over 42 cells; this is the same record stated
 * in words, so "how am I doing" is answered by reading rather than by decoding.
 *
 * Derived like everything else here — nothing below is stored, and the match
 * between a Placement and a Session is the one `isMissed` already makes
 * (workout and local day, ADR 0001). `unplanned` is that rule read backwards:
 * a Session no Placement asked for. Without it the counts would quietly claim a
 * month was emptier than it was.
 */
export interface MonthTally {
  /** Placements in range — what the programme asked of this month. */
  readonly planned: number;
  /** Past Placements a Session answered. */
  readonly kept: number;
  readonly missed: number;
  /** Placements still ahead: today's included, since today is not over. */
  readonly upcoming: number;
  /** Sessions in range that no Placement in range asked for. */
  readonly unplanned: number;
}

export function tallyMonth(
  placements: readonly Placement[],
  sessions: readonly Session[],
  today: LocalDate,
): MonthTally {
  const missed = placements.filter((placement) => isMissed(placement, sessions, today));
  const upcoming = placements.filter((placement) => placement.date >= today);
  const unplanned = sessions.filter(
    (session) =>
      !placements.some(
        (placement) =>
          placement.workoutId === session.workoutId &&
          placement.date === formatLocalDate(new Date(session.startedAt)),
      ),
  );

  return {
    planned: placements.length,
    kept: placements.length - missed.length - upcoming.length,
    missed: missed.length,
    upcoming: upcoming.length,
    unplanned: unplanned.length,
  };
}
