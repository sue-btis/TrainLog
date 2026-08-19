import { describe, expect, it } from 'vitest';
import { parseLocalDate, toLocalDate, type LocalDate } from '@/domain/dates';
import { toId, type RoutineId, type WorkoutId } from '@/domain/ids';
import type { Placement, Session, Weekday, Workout } from '@/domain/types';
import {
  generatePlacements,
  isMissed,
  nextWorkoutInRotation,
} from '@/domain/scheduling';

const routineId = toId<RoutineId>('routine-1');

function workout(id: string, order: number, suggestedDays: readonly Weekday[]): Workout {
  return { id: toId<WorkoutId>(id), routineId, name: id, suggestedDays, order };
}

function session(workoutId: string, startedAt: number): Session {
  return {
    id: toId('session-' + workoutId + '-' + String(startedAt)),
    routineId,
    workoutId: toId<WorkoutId>(workoutId),
    startedAt,
    completedAt: null,
    status: 'completed',
  };
}

/** Local noon on a calendar day — an instant unambiguously inside that day. */
function noonOn(date: string): number {
  const midnight = parseLocalDate(toLocalDate(date));
  midnight.setHours(12);
  return midnight.getTime();
}

const dates = (placements: readonly Placement[]): string[] => placements.map((p) => p.date);

describe('generatePlacements (TST-006, REQ-040, REQ-041)', () => {
  const push = workout('push', 0, ['monday', 'thursday']);

  it('yields one placement per suggested day per week from a Monday anchor (AC-040)', () => {
    const placements = generatePlacements({
      workouts: [push],
      weeks: 4,
      anchorDate: toLocalDate('2026-09-07'), // a Monday
    });

    expect(placements).toHaveLength(8);
    expect(dates(placements)).toEqual([
      '2026-09-07', '2026-09-10',
      '2026-09-14', '2026-09-17',
      '2026-09-21', '2026-09-24',
      '2026-09-28', '2026-10-01',
    ]);
    expect(placements.every((p) => p.routineId === routineId && p.workoutId === push.id)).toBe(true);
  });

  it('is deterministic in its dates across calls (AC-041)', () => {
    const args = { workouts: [push], weeks: 4, anchorDate: toLocalDate('2026-09-07') };
    // Ids come from newId() and differ by design; determinism is asserted on the dates.
    expect(dates(generatePlacements(args))).toEqual(dates(generatePlacements(args)));
  });
});

describe('generatePlacements anchoring and collisions (TST-007, REQ-041, REQ-042)', () => {
  it('omits week-1 dates before a mid-week anchor and keeps later weeks intact (AC-042)', () => {
    const placements = generatePlacements({
      workouts: [workout('push', 0, ['monday', 'thursday'])],
      weeks: 4,
      anchorDate: toLocalDate('2026-09-09'), // a Wednesday
    });

    expect(dates(placements)).toEqual([
      '2026-09-10',
      '2026-09-14', '2026-09-17',
      '2026-09-21', '2026-09-24',
      '2026-09-28', '2026-10-01',
    ]);
  });

  it('emits both workouts when two share a suggested day (AC-043)', () => {
    const placements = generatePlacements({
      workouts: [workout('push', 0, ['monday']), workout('pull', 1, ['monday'])],
      weeks: 1,
      anchorDate: toLocalDate('2026-09-07'),
    });

    expect(dates(placements)).toEqual(['2026-09-07', '2026-09-07']);
    expect(placements.map((p) => p.workoutId)).toEqual([toId('push'), toId('pull')]);
  });
});

describe('nextWorkoutInRotation (TST-008, REQ-043)', () => {
  const workouts = [workout('c', 2, []), workout('a', 0, []), workout('b', 1, [])];

  it('returns the first workout by order when nothing has been performed (AC-044)', () => {
    expect(nextWorkoutInRotation(workouts, null)?.id).toBe(toId('a'));
  });

  it('wraps to the first workout after the last (AC-044)', () => {
    expect(nextWorkoutInRotation(workouts, toId<WorkoutId>('a'))?.id).toBe(toId('b'));
    expect(nextWorkoutInRotation(workouts, toId<WorkoutId>('c'))?.id).toBe(toId('a'));
  });

  it('falls back to the first workout when the last performed one is gone', () => {
    expect(nextWorkoutInRotation(workouts, toId<WorkoutId>('gone'))?.id).toBe(toId('a'));
    expect(nextWorkoutInRotation([], null)).toBeNull();
  });
});

describe('isMissed (TST-009, REQ-044)', () => {
  const today = toLocalDate('2026-09-10');
  const placement = (date: string, workoutId = 'push'): Placement => ({
    id: toId('placement-' + date),
    routineId,
    workoutId: toId<WorkoutId>(workoutId),
    date: toLocalDate(date) as LocalDate,
  });

  it('reads a past placement with no session as missed (AC-045)', () => {
    expect(isMissed(placement('2026-09-07'), [], today)).toBe(true);
  });

  it('is not missed when a session for that workout was recorded on that date', () => {
    expect(isMissed(placement('2026-09-07'), [session('push', noonOn('2026-09-07'))], today)).toBe(false);
  });

  it('is not missed for today or a future placement, nor for another workout or day', () => {
    expect(isMissed(placement('2026-09-10'), [], today)).toBe(false);
    expect(isMissed(placement('2026-09-14'), [], today)).toBe(false);
    expect(isMissed(placement('2026-09-07'), [session('pull', noonOn('2026-09-07'))], today)).toBe(true);
    expect(isMissed(placement('2026-09-07'), [session('push', noonOn('2026-09-08'))], today)).toBe(true);
  });

  it('writes nothing and mutates no input (AC-045)', () => {
    const target = Object.freeze(placement('2026-09-07'));
    const sessions = Object.freeze([Object.freeze(session('push', noonOn('2026-09-08')))]);
    const before = JSON.stringify({ target, sessions });

    expect(isMissed(target, sessions, today)).toBe(true);
    expect(JSON.stringify({ target, sessions })).toBe(before);
  });
});
