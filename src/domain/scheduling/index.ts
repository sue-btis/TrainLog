import {
  addDays,
  formatLocalDate,
  mondayOfWeek,
  parseLocalDate,
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
  readonly weeks: number;
  readonly anchorDate: LocalDate;
}

export function generatePlacements({
  workouts,
  weeks,
  anchorDate,
}: GeneratePlacementsOptions): Placement[] {
  // Week 1 starts on the containing Monday; dates before the anchor are
  // omitted so importing mid-week never creates past Placements.
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

export function remainingWeeks(weeks: number, anchorDate: LocalDate, today: LocalDate): number {
  // The block is Monday-aligned, not anchored to the creation weekday; round
  // across daylight-saving changes between the two local Monday midnights.
  const week = 7 * 24 * 60 * 60 * 1000;
  const elapsed = Math.round(
    (parseLocalDate(mondayOfWeek(today)).getTime() -
      parseLocalDate(mondayOfWeek(anchorDate)).getTime()) /
      week,
  );

  const total = Math.max(0, weeks);
  return Math.min(total, Math.max(0, total - elapsed));
}

export function claimantsOfDay(
  workouts: readonly Workout[],
  day: Weekday,
): readonly Workout[] {
  // Callers use the first claimant as the rotation preference, so order it
  // here instead of trusting the input order.
  return workouts
    .filter((workout) => workout.suggestedDays.includes(day))
    .sort((a, b) => a.order - b.order);
}

export function nextWorkoutInRotation(
  workouts: readonly Workout[],
  lastPerformedWorkoutId: WorkoutId | null,
): Workout | null {
  // A missing or last-performed id both resolve to the first Workout after
  // sorting; the rotation never depends on array order.
  const rotation = [...workouts].sort((a, b) => a.order - b.order);
  if (rotation.length === 0) return null;

  const lastIndex = rotation.findIndex((workout) => workout.id === lastPerformedWorkoutId);
  return rotation[(lastIndex + 1) % rotation.length] ?? null;
}

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

export type DayState =
  | 'completed'
  | 'partial'
  | 'in_progress'
  | 'planned'
  | 'missed'
  | 'rest';

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

  return planned.some((placement) => isMissed(placement, sessions, today))
    ? 'missed'
    : 'planned';
}

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
