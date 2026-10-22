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
  /** Exclusive end that cuts the window short, for a block already under way. */
  readonly endDate?: LocalDate;
}

/** The first date after a block of `weeks` that starts on `startDate`. */
export function blockEnd(weeks: number, startDate: LocalDate): LocalDate {
  return addDays(startDate, Math.max(0, weeks) * 7);
}

export function generatePlacements({
  workouts,
  weeks,
  anchorDate,
  endDate,
}: GeneratePlacementsOptions): Placement[] {
  // The window is exactly `weeks * 7` days from the anchor, so every weekday
  // occurs `weeks` times whatever day the block starts on.
  const naturalEnd = blockEnd(weeks, anchorDate);
  const end = endDate !== undefined && endDate < naturalEnd ? endDate : naturalEnd;
  const placements: Placement[] = [];

  // LocalDate is YYYY-MM-DD: lexical order is chronological.
  for (let date = anchorDate; date < end; date = addDays(date, 1)) {
    const dayOffset = daysSinceMonday(date);
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

  return placements;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSinceMonday(date: LocalDate): number {
  return (parseLocalDate(date).getDay() + 6) % 7;
}

/**
 * Weeks of a block that started on `startDate` still left on `today`, counting a
 * started week. Pair with `blockEnd` so the last week is not overshot.
 */
export function remainingWeeks(weeks: number, startDate: LocalDate, today: LocalDate): number {
  const total = Math.max(0, weeks);
  // Round across daylight-saving changes between the two local midnights.
  const daysLeft = Math.round(
    (parseLocalDate(blockEnd(total, startDate)).getTime() - parseLocalDate(today).getTime()) /
      DAY_MS,
  );
  return Math.min(total, Math.max(0, Math.ceil(daysLeft / 7)));
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

const dateOf = (session: Session): LocalDate => formatLocalDate(new Date(session.startedAt));

interface Coverage {
  readonly keptIds: ReadonlySet<Placement['id']>;
  readonly consumedSessionIds: ReadonlySet<Session['id']>;
}

/**
 * Which Placements a Session answers. A Session on the Placement's own date
 * answers it first; then any Session of that Workout earlier in the same
 * Monday-week answers the remaining Placements in order — training a Workout
 * early keeps its Placement. A Session answers at most one Placement.
 */
function coverageOf(placements: readonly Placement[], sessions: readonly Session[]): Coverage {
  const keptIds = new Set<Placement['id']>();
  const consumedSessionIds = new Set<Session['id']>();

  const weeks = new Map<string, Placement[]>();
  for (const placement of placements) {
    const key = `${placement.workoutId}|${mondayOfWeek(placement.date)}`;
    weeks.set(key, [...(weeks.get(key) ?? []), placement]);
  }

  for (const [key, group] of weeks) {
    const [workoutId, monday] = key.split('|');
    const pool = sessions
      .filter(
        (session) =>
          session.workoutId === workoutId && mondayOfWeek(dateOf(session)) === monday,
      )
      .sort((a, b) => a.startedAt - b.startedAt);
    const ordered = [...group].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    for (const placement of ordered) {
      const exact = pool.find(
        (session) => !consumedSessionIds.has(session.id) && dateOf(session) === placement.date,
      );
      if (exact === undefined) continue;
      consumedSessionIds.add(exact.id);
      keptIds.add(placement.id);
    }
    for (const placement of ordered) {
      if (keptIds.has(placement.id)) continue;
      const early = pool.find(
        (session) => !consumedSessionIds.has(session.id) && dateOf(session) < placement.date,
      );
      if (early === undefined) continue;
      consumedSessionIds.add(early.id);
      keptIds.add(placement.id);
    }
  }

  return { keptIds, consumedSessionIds };
}

/** `placements` is every Placement in view, `placement` included: coverage is shared among siblings. */
export function isMissed(
  placement: Placement,
  sessions: readonly Session[],
  today: LocalDate,
  placements: readonly Placement[],
): boolean {
  if (placement.date >= today) return false;
  return !coverageOf(placements, sessions).keptIds.has(placement.id);
}

export type PlacementState = 'planned' | 'kept' | 'missed';

export function placementState(
  placement: Placement,
  sessions: readonly Session[],
  today: LocalDate,
  placements: readonly Placement[],
): PlacementState {
  // Today is not over, so today's Placement is still ahead of you.
  if (placement.date >= today) return 'planned';
  return isMissed(placement, sessions, today, placements) ? 'missed' : 'kept';
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

  return planned.some((placement) => isMissed(placement, sessions, today, placements))
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
  const { keptIds, consumedSessionIds } = coverageOf(placements, sessions);
  const past = placements.filter((placement) => placement.date < today);
  const missed = past.filter((placement) => !keptIds.has(placement.id));
  const upcoming = placements.filter((placement) => placement.date >= today);
  // A second Session of the Workout on a Placement's own date is still the
  // day's training, not an unplanned one.
  const unplanned = sessions.filter(
    (session) =>
      !consumedSessionIds.has(session.id) &&
      !placements.some(
        (placement) =>
          placement.workoutId === session.workoutId && placement.date === dateOf(session),
      ),
  );

  return {
    planned: placements.length,
    kept: past.length - missed.length,
    missed: missed.length,
    upcoming: upcoming.length,
    unplanned: unplanned.length,
  };
}
