import { describe, expect, it } from 'vitest';
import { parseLocalDate, toLocalDate, type LocalDate } from '@/domain/dates';
import { toId, type RoutineId, type WorkoutId } from '@/domain/ids';
import type {
  Placement,
  PlannedExercise,
  Session,
  Weekday,
  Workout,
} from '@/domain/types';
import {
  DEFAULT_REST_SECONDS,
  ROUNDING_MINUTES,
  WORK_SECONDS_PER_SET,
  claimantsOfDay,
  dayState,
  estimateDuration,
  generatePlacements,
  isMissed,
  nextWorkoutInRotation,
  placementState,
  remainingWeeks,
  tallyMonth,
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
    bodyweightKg: null,
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

describe('dayState (R-40, §11.3)', () => {
  const day = toLocalDate('2026-09-09');
  const today = toLocalDate('2026-09-16');

  const placementOn = (date: string): Placement => ({
    id: toId('placement-' + date),
    routineId,
    workoutId: toId<WorkoutId>('push'),
    date: toLocalDate(date),
  });

  const sessionOn = (date: string, status: Session['status']): Session => ({
    ...session('push', noonOn(date)),
    status,
  });

  it('reads a day nothing claimed as rest (AC-40)', () => {
    expect(dayState([], [], day, today)).toBe('rest');
  });

  it('reads a future placement with no session as planned (AC-40)', () => {
    const future = toLocalDate('2026-09-23');
    expect(dayState([placementOn('2026-09-23')], [], future, today)).toBe('planned');
  });

  it('reads a past placement with no session as missed (AC-40)', () => {
    expect(dayState([placementOn('2026-09-09')], [], day, today)).toBe('missed');
  });

  it('never reads today itself as missed (AC-41)', () => {
    expect(dayState([placementOn('2026-09-16')], [], today, today)).toBe('planned');
  });

  it('reads a completed session as completed, planned or not (AC-40)', () => {
    expect(dayState([placementOn('2026-09-09')], [sessionOn('2026-09-09', 'completed')], day, today)).toBe(
      'completed',
    );
    expect(dayState([], [sessionOn('2026-09-09', 'completed')], day, today)).toBe('completed');
  });

  it('reads a partial session as partial (AC-40)', () => {
    expect(dayState([placementOn('2026-09-09')], [sessionOn('2026-09-09', 'partial')], day, today)).toBe(
      'partial',
    );
  });

  it('lets an open session outrank everything else on the day (AC-40)', () => {
    const sessions = [sessionOn('2026-09-09', 'completed'), sessionOn('2026-09-09', 'in_progress')];
    expect(dayState([placementOn('2026-09-09')], sessions, day, today)).toBe('in_progress');
  });

  it('lets a partial session outrank a completed one on the same day', () => {
    const sessions = [sessionOn('2026-09-09', 'completed'), sessionOn('2026-09-09', 'partial')];
    expect(dayState([], sessions, day, today)).toBe('partial');
  });

  it('ignores placements and sessions belonging to other days', () => {
    const elsewhere = [placementOn('2026-09-10')];
    const sessions = [sessionOn('2026-09-10', 'completed')];
    expect(dayState(elsewhere, sessions, day, today)).toBe('rest');
  });

  it('writes nothing (AC-42)', () => {
    const placements = [placementOn('2026-09-09')];
    const sessions = [sessionOn('2026-09-09', 'completed')];
    const before = JSON.stringify({ placements, sessions });
    dayState(placements, sessions, day, today);
    expect(JSON.stringify({ placements, sessions })).toBe(before);
  });
});

describe('estimateDuration (R-41, §11.4, D2)', () => {
  const planned = (sets: number, restSeconds: number | null): PlannedExercise => ({
    id: toId('planned-' + String(sets) + '-' + String(restSeconds)),
    workoutId: toId<WorkoutId>('push'),
    exerciseId: toId('front-squat'),
    sets,
    minReps: 4,
    maxReps: 6,
    minTarget: null,
    maxTarget: null,
    minRir: null,
    maxRir: null,
    restSeconds,
    unit: 'kg',
    focus: null,
    notes: [],
    order: 0,
    progression: { type: 'manual' },
  });

  it('estimates nothing for a Workout with no exercises', () => {
    expect(estimateDuration([])).toBe(0);
  });

  it('sums sets x (rest + work), rounded to five minutes (AC-43)', () => {
    expect(estimateDuration([planned(4, 210), planned(3, 150)])).toBe(25);
  });

  it('assumes the default rest when an exercise declares none (AC-44)', () => {
    expect(estimateDuration([planned(4, null)])).toBe(10);
    expect(DEFAULT_REST_SECONDS).toBe(90);
    expect(WORK_SECONDS_PER_SET).toBe(45);
    expect(ROUNDING_MINUTES).toBe(5);
  });

  it('rounds a short Workout to the nearest five minutes, not down to zero', () => {
    expect(estimateDuration([planned(2, 60)])).toBe(5);
  });
});

describe('tallyMonth (§11.3)', () => {
  const today = toLocalDate('2026-09-15');
  const placement = (date: string, workoutId = 'push'): Placement => ({
    id: toId('placement-' + workoutId + '-' + date),
    routineId,
    workoutId: toId<WorkoutId>(workoutId),
    date: toLocalDate(date),
  });

  it('names a placement planned ahead of today, kept once answered, missed otherwise', () => {
    const answered = placement('2026-09-07');
    const untrained = placement('2026-09-10');
    const ahead = placement('2026-09-15'); // today, and today is not over
    const sessions = [session('push', noonOn('2026-09-07'))];

    expect(placementState(answered, sessions, today)).toBe('kept');
    expect(placementState(untrained, sessions, today)).toBe('missed');
    expect(placementState(ahead, sessions, today)).toBe('planned');
  });

  it('counts nothing for a month with nothing in it', () => {
    expect(tallyMonth([], [], today)).toEqual({
      planned: 0, kept: 0, missed: 0, upcoming: 0, unplanned: 0,
    });
  });

  it('splits placements into kept, missed and still ahead', () => {
    const placements = [
      placement('2026-09-07'),                 // answered
      placement('2026-09-10'),                 // untrained, in the past
      placement('2026-09-15'),                 // today: not over, so ahead
      placement('2026-09-21'),                 // ahead
    ];
    const sessions = [session('push', noonOn('2026-09-07'))];

    expect(tallyMonth(placements, sessions, today)).toEqual({
      planned: 4, kept: 1, missed: 1, upcoming: 2, unplanned: 0,
    });
  });

  it('counts a session no placement asked for as unplanned', () => {
    const placements = [placement('2026-09-07')];
    const sessions = [
      session('push', noonOn('2026-09-07')),   // the placement's own
      session('pull', noonOn('2026-09-09')),   // nobody planned this
      session('push', noonOn('2026-09-08')),   // right workout, wrong day
    ];

    expect(tallyMonth(placements, sessions, today)).toMatchObject({
      kept: 1, missed: 0, unplanned: 2,
    });
  });
});

describe('remainingWeeks', () => {
  const monday = toLocalDate('2026-09-07');

  it('counts whole Monday-aligned weeks elapsed', () => {
    expect(remainingWeeks(8, monday, toLocalDate('2026-09-30'))).toBe(5);
  });

  it('is zero once the block has run out, never negative', () => {
    expect(remainingWeeks(4, monday, toLocalDate('2026-10-20'))).toBe(0);
    expect(remainingWeeks(4, monday, toLocalDate('2027-01-01'))).toBe(0);
  });

  it('aligns weeks to Monday, not to the anchor day', () => {
    const wednesday = toLocalDate('2026-08-05');

    // One Monday boundary has been crossed, so one week is gone — even though
    // only five days separate the two dates.
    expect(remainingWeeks(4, wednesday, toLocalDate('2026-08-10'))).toBe(3);
    // Still inside the anchor's own week: nothing elapsed.
    expect(remainingWeeks(4, wednesday, toLocalDate('2026-08-08'))).toBe(4);
    // Before the anchor cannot yield more than the block declares.
    expect(remainingWeeks(4, wednesday, toLocalDate('2026-07-20'))).toBe(4);
  });

  it('is zero for a zero or negative block', () => {
    expect(remainingWeeks(0, monday, toLocalDate('2026-09-07'))).toBe(0);
    expect(remainingWeeks(-4, monday, toLocalDate('2026-09-07'))).toBe(0);
  });

  it('composes with generatePlacements to an exact span, none before today', () => {
    const today = toLocalDate('2026-09-30');
    const placements = generatePlacements({
      workouts: [workout('push', 0, ['monday', 'thursday'])],
      weeks: remainingWeeks(8, monday, today),
      anchorDate: today,
    });

    expect(placements).toHaveLength(9);
    expect(placements[0]!.date).toBe('2026-10-01');
    expect(placements[placements.length - 1]!.date).toBe('2026-10-29');
    expect(placements.every((placement) => placement.date >= today)).toBe(true);
  });

  it('places nothing for a spent block or a Workout claiming no day', () => {
    const anchor = toLocalDate('2026-09-07');
    expect(
      generatePlacements({ workouts: [workout('push', 0, ['monday'])], weeks: 0, anchorDate: anchor }),
    ).toHaveLength(0);
    expect(
      generatePlacements({ workouts: [workout('push', 0, [])], weeks: 8, anchorDate: anchor }),
    ).toHaveLength(0);
  });
});

describe('a Workout added to a Routine already running', () => {
  const push = workout('push', 0, ['monday']);
  const pull = workout('pull', 1, ['monday']);

  it('is reached by the rotation once it holds the highest order', () => {
    expect(nextWorkoutInRotation([push, pull], toId<WorkoutId>('push'))!.id).toBe('pull');
    expect(nextWorkoutInRotation([push, pull], toId<WorkoutId>('pull'))!.id).toBe('push');
  });

  it('names the Workouts already claiming a day, in order', () => {
    expect(claimantsOfDay([push, pull], 'monday').map((w) => w.id)).toEqual(['push', 'pull']);
    expect(claimantsOfDay([push, pull], 'friday')).toEqual([]);
    // Given out of order, because the caller's sorting is not the guarantee
    // being made — the warning reads `[0]` as the one Today will prefer.
    expect(claimantsOfDay([pull, push], 'monday').map((w) => w.id)).toEqual(['push', 'pull']);
  });

  it('places both Workouts on the shared day, one each', () => {
    const placements = generatePlacements({
      workouts: [push, pull],
      weeks: 1,
      anchorDate: toLocalDate('2026-09-07'),
    });

    expect(dates(placements)).toEqual(['2026-09-07', '2026-09-07']);
    expect(placements.map((p) => p.workoutId)).toEqual(['push', 'pull']);
  });

  it('derives the untrained one as missed on every colliding date', () => {
    const placements = generatePlacements({
      workouts: [push, pull],
      weeks: 1,
      anchorDate: toLocalDate('2026-09-07'),
    });
    const sessions = [session('push', noonOn('2026-09-07'))];
    const today = toLocalDate('2026-09-08');

    const missed = placements.filter((placement) => isMissed(placement, sessions, today));

    expect(missed).toHaveLength(1);
    expect(missed[0]!.workoutId).toBe('pull');
  });
});
