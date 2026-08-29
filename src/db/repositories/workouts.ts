import { db } from '@/db/database';
import type { LocalDate } from '@/domain/dates';
import { formatLocalDate } from '@/domain/dates';
import { newId, type RoutineId, type WorkoutId } from '@/domain/ids';
import { generatePlacements, remainingWeeks } from '@/domain/scheduling';
import type { Weekday, Workout } from '@/domain/types';

export class RoutineNotFoundError extends Error {
  constructor(routineId: RoutineId) {
    super(`Routine ${routineId} does not exist.`);
    this.name = 'RoutineNotFoundError';
  }
}

/** Adding to an archived Routine is refused after rechecking its stored status. */
export class RoutineNotActiveError extends Error {
  constructor(routineId: RoutineId) {
    super(`Routine ${routineId} is archived. Activate it before adding to it.`);
    this.name = 'RoutineNotActiveError';
  }
}

export class WorkoutNameRequiredError extends Error {
  constructor() {
    super('A Workout needs a name.');
    this.name = 'WorkoutNameRequiredError';
  }
}

export function getWorkout(id: WorkoutId): Promise<Workout | undefined> {
  return db.workouts.get(id);
}

export async function listWorkoutsByRoutine(routineId: RoutineId): Promise<Workout[]> {
  const workouts = await db.workouts.where('routineId').equals(routineId).toArray();
  return workouts.sort((a, b) => a.order - b.order);
}

export interface AddedWorkout {
  readonly workoutId: WorkoutId;
  readonly placementCount: number;
}

/** Adds a Workout and its future Placements atomically, including the next order. */
export async function addWorkoutToRoutine(
  routineId: RoutineId,
  input: {
    readonly name: string;
    readonly suggestedDays: readonly Weekday[];
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
