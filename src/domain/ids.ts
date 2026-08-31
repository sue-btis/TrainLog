export type Id<Entity extends string> = string & { readonly __brand: Entity };

export type ExerciseId = Id<'Exercise'>;
export type RoutineId = Id<'Routine'>;
export type WorkoutId = Id<'Workout'>;
export type PlannedExerciseId = Id<'PlannedExercise'>;
export type PlacementId = Id<'Placement'>;
export type SessionId = Id<'Session'>;
export type ExerciseSessionId = Id<'ExerciseSession'>;
export type CompletedSetId = Id<'CompletedSet'>;

export function newId<T extends Id<string>>(): T {
  return crypto.randomUUID() as T;
}

// Branding is compile-time only; callers must validate external strings before tagging them.
export function toId<T extends Id<string>>(value: string): T {
  return value as T;
}
