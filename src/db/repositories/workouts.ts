/**
 * Workouts (§14.3).
 *
 * A Routine accepted takes **additions** only (DEC-B): a Workout may be added
 * to the active Routine, and nothing already stored is rewritten, reordered or
 * removed. That is the amended invariant — not a revocation of it. What makes
 * the addition safe is ADR 0002: a Session snapshots its planned targets when
 * an exercise starts, so no read path reconstructs a past Session by joining
 * back into these rows, and adding to a template cannot rewrite history.
 */

import { db } from '@/db/database';
import type { LocalDate } from '@/domain/dates';
import { formatLocalDate } from '@/domain/dates';
import { newId, type RoutineId, type WorkoutId } from '@/domain/ids';
import { generatePlacements, remainingWeeks } from '@/domain/scheduling';
import type { Weekday, Workout } from '@/domain/types';

/** Thrown when the Routine an add names does not exist. */
export class RoutineNotFoundError extends Error {
  constructor(routineId: RoutineId) {
    super(`Routine ${routineId} does not exist.`);
    this.name = 'RoutineNotFoundError';
  }
}

/**
 * Thrown when an add targets a Routine that is not `active` (REQ-414).
 *
 * Checked against the row read *inside* the transaction rather than trusted
 * from the caller: a screen may have been open while the Routine was archived
 * in another tab. It matters because the calendar reads Placements across every
 * Routine — one generated into an archived Routine would appear on a lifter's
 * calendar as work they never chose to schedule.
 */
export class RoutineNotActiveError extends Error {
  constructor(routineId: RoutineId) {
    super(`Routine ${routineId} is archived. Activate it before adding to it.`);
    this.name = 'RoutineNotActiveError';
  }
}

/** Thrown when a Workout name is blank once trimmed (REQ-411). */
export class WorkoutNameRequiredError extends Error {
  constructor() {
    super('A Workout needs a name.');
    this.name = 'WorkoutNameRequiredError';
  }
}

export function getWorkout(id: WorkoutId): Promise<Workout | undefined> {
  return db.workouts.get(id);
}

/** A Routine's Workouts in rotation order (`order`, §11.4). Index: routineId. */
export async function listWorkoutsByRoutine(routineId: RoutineId): Promise<Workout[]> {
  const workouts = await db.workouts.where('routineId').equals(routineId).toArray();
  return workouts.sort((a, b) => a.order - b.order);
}

/** What an added Workout produced: itself, and how many days it claimed. */
export interface AddedWorkout {
  readonly workoutId: WorkoutId;
  readonly placementCount: number;
}

/**
 * Adds a Workout to the active Routine and places it (REQ-400…403, REQ-411,
 * REQ-412).
 *
 * One transaction over exactly the three tables it touches, and every input it
 * cannot be handed is read inside it: the Routine's `status`, `weeks`,
 * `createdAt` and the highest `order` already used. Reading any of them before
 * the transaction would let a concurrent import or archive make them stale
 * between the read and the write.
 *
 * `order` is one past the highest, so `listWorkoutsByRoutine` returns the new
 * Workout last and `nextWorkoutInRotation` reaches it after the others
 * (REQ-401). Computed from the rows, not from a count: a Routine whose
 * Workouts were written with gaps in `order` would otherwise get a duplicate.
 *
 * Placements run **from today forward** for what is left of the block
 * (REQ-402). `generatePlacements` is handed `today` as its anchor, so it omits
 * dates before today and begins its week 1 on the Monday of this week — the
 * same Monday alignment `remainingWeeks` counts elapsed weeks by.
 *
 * Zero Placements is a success, not a refusal (REQ-403): a Workout added with
 * no suggested day, or into a block that has run out of weeks, is still a
 * Workout, still in the rotation, and still trainable from Today. The count
 * comes back so the screen can report what was actually written rather than
 * what a preview predicted (REQ-404).
 */
export async function addWorkoutToRoutine(
  routineId: RoutineId,
  input: {
    readonly name: string;
    readonly suggestedDays: readonly Weekday[];
    /** The local day the add happens on. A parameter: the clock is read above. */
    readonly today: LocalDate;
  },
): Promise<AddedWorkout> {
  const name = input.name.trim();
  if (name === '') throw new WorkoutNameRequiredError();

  return db.transaction('rw', [db.routines, db.workouts, db.placements], async () => {
    const routine = await db.routines.get(routineId);
    if (routine === undefined) throw new RoutineNotFoundError(routineId);
    if (routine.status !== 'active') throw new RoutineNotActiveError(routineId);

    const siblings = await db.workouts.where('routineId').equals(routineId).toArray();
    const order = siblings.reduce((highest, workout) => Math.max(highest, workout.order + 1), 0);

    const workout: Workout = {
      id: newId<WorkoutId>(),
      routineId,
      name,
      suggestedDays: input.suggestedDays,
      order,
    };
    await db.workouts.add(workout);

    const placements = generatePlacements({
      workouts: [workout],
      weeks: remainingWeeks(
        routine.weeks,
        formatLocalDate(new Date(routine.createdAt)),
        input.today,
      ),
      anchorDate: input.today,
    });
    await db.placements.bulkAdd(placements);

    return { workoutId: workout.id, placementCount: placements.length };
  });
}
