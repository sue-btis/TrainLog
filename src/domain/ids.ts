/**
 * Identity (REQ-011, §24, DEC-2).
 *
 * Every entity id is a generated UUID from `newId()`. No entity is keyed by a
 * name. Ids are branded per entity so a `WorkoutId` cannot be passed where a
 * `SessionId` is expected.
 *
 * Catalog Exercises are the one exception to "id is a UUID": their ids are
 * permanent kebab-case slugs authored in the build (DEC-007). They enter the
 * type system through `toId`, never through `newId`.
 */

/** A string id tagged with the entity it identifies. */
export type Id<Entity extends string> = string & { readonly __brand: Entity };

export type ExerciseId = Id<'Exercise'>;
export type RoutineId = Id<'Routine'>;
export type WorkoutId = Id<'Workout'>;
export type PlannedExerciseId = Id<'PlannedExercise'>;
export type PlacementId = Id<'Placement'>;
export type SessionId = Id<'Session'>;
export type ExerciseSessionId = Id<'ExerciseSession'>;
export type CompletedSetId = Id<'CompletedSet'>;

/** Generates a new entity id. The only source of ids in the app (REQ-011). */
export function newId<T extends Id<string>>(): T {
  return crypto.randomUUID() as T;
}

/**
 * Tags an existing string as an id of a known entity: values read back out of
 * storage, out of a routine file, or authored as catalog slugs. It does not
 * generate anything and does not validate — the caller asserts provenance.
 */
export function toId<T extends Id<string>>(value: string): T {
  return value as T;
}
