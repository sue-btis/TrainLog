/**
 * Exercises (REQ-071, DEC-007).
 *
 * The table holds user-created Exercises only. The catalog ships in the build
 * and is never inserted, so every read that turns an `exerciseId` into an
 * Exercise has to consult the catalog first and the table second. That rule
 * lives here so no caller has to know it.
 */

import { db } from '@/db/database';
import { findExerciseByName, getCatalogExercise } from '@/domain/catalog';
import { newId, type ExerciseId } from '@/domain/ids';
import type { Measurement } from '@/domain/measurement';
import type { Exercise } from '@/domain/types';

/**
 * Thrown when a create is refused because the name is empty once trimmed
 * (REQ-106). A nameless movement cannot be found again — `findExerciseByName`
 * normalizes to the empty string and would match the next nameless one — so it
 * is refused rather than stored. Callers surface the message.
 */
export class ExerciseNameRequiredError extends Error {
  constructor() {
    super('An exercise needs a name.');
    this.name = 'ExerciseNameRequiredError';
  }
}

/**
 * What `createUserExercise` hands back: the Exercise that now carries this
 * name, and whether this call is what created it.
 *
 * Declared here rather than reusing `ResolvedExercise` from
 * `@/domain/routine-file` (REQ-909): the shapes are identical, but importing
 * that type would give a repository with nothing to do with routine files a
 * dependency on the routine-file module. One duplicated two-field interface is
 * the cheaper of the two.
 */
export interface CreatedExercise {
  readonly exercise: Exercise;
  readonly created: boolean;
}

/** Every user-created Exercise. The catalog is not included (§17 export scope). */
export function listUserExercises(): Promise<Exercise[]> {
  return db.exercises.toArray();
}

/** Resolves an id: catalog first, then the user table (DEC-007). */
export async function getExercise(id: ExerciseId): Promise<Exercise | undefined> {
  return getCatalogExercise(id) ?? (await db.exercises.get(id));
}

/** The display name for an id, or `undefined` when it resolves to nothing. */
export async function getExerciseName(id: ExerciseId): Promise<string | undefined> {
  return (await getExercise(id))?.name;
}

/**
 * Several ids at once, for a list screen. Catalog hits cost nothing; only the
 * ids the catalog does not know reach the table, by primary key. An id that
 * resolves to nothing is simply absent from the map.
 */
export async function getExercisesById(
  ids: readonly ExerciseId[],
): Promise<Map<ExerciseId, Exercise>> {
  const resolved = new Map<ExerciseId, Exercise>();
  const unresolved: ExerciseId[] = [];

  for (const id of new Set(ids)) {
    const fromCatalog = getCatalogExercise(id);
    if (fromCatalog) resolved.set(id, fromCatalog);
    else unresolved.push(id);
  }

  const rows = await db.exercises.bulkGet(unresolved);
  for (const row of rows) {
    if (row) resolved.set(row.id, row);
  }
  return resolved;
}

/** Display names for several ids at once. */
export async function getExerciseNames(
  ids: readonly ExerciseId[],
): Promise<Map<ExerciseId, string>> {
  const resolved = await getExercisesById(ids);
  return new Map([...resolved].map(([id, exercise]) => [id, exercise.name]));
}

/**
 * How several exercises are measured, for the snapshot `startPlannedExercise`
 * takes (REQ-105). `weight_reps` where an id resolves to nothing, matching the
 * fallback the migration applies for the same reason (REQ-125).
 */
export async function getExerciseMeasurements(
  ids: readonly ExerciseId[],
): Promise<Map<ExerciseId, Measurement>> {
  const resolved = await getExercisesById(ids);
  return new Map([...resolved].map(([id, exercise]) => [id, exercise.measurement]));
}

/**
 * Creates a user Exercise, or hands back the one that already carries the name
 * (REQ-100, REQ-101, REQ-104, REQ-107).
 *
 * The duplicate decision and the write happen inside one transaction, so two
 * creates racing on the same name cannot both mint. That closes, on this path,
 * the gap the import path still has: `ImportWizard` reads `listUserExercises`
 * outside `importRoutine`'s transaction, and moving that read inside would
 * reshape `routineFileToDomain`'s contract, which is not this change's business.
 *
 * `created: false` is not a failure. It is the §26 rule doing its job — the
 * lifter typed a movement the app already knows, and binding to the incumbent
 * is what keeps their history in one piece. The screen says which Exercise it
 * was rather than reporting a success that did not happen (REQ-101).
 *
 * A catalog hit returns the catalog entry with its permanent slug and writes
 * nothing: catalog Exercises never enter this table (DEC-007, REQ-071).
 */
export async function createUserExercise(input: {
  readonly name: string;
  readonly category: string | null;
  readonly equipment: string | null;
  /** How the movement is measured (REQ-104). `weight_reps` where unsaid. */
  readonly measurement?: Measurement;
}): Promise<CreatedExercise> {
  const name = input.name.trim();
  if (name === '') throw new ExerciseNameRequiredError();

  return db.transaction('rw', db.exercises, async () => {
    // Read inside the transaction, not before it: Dexie serializes transactions
    // on the same table, so no second create can land between the lookup and
    // the write.
    const existing = findExerciseByName(name, await db.exercises.toArray());
    if (existing) return { exercise: existing, created: false };

    const exercise: Exercise = {
      id: newId<ExerciseId>(),
      name,
      category: input.category,
      equipment: input.equipment,
      measurement: input.measurement ?? 'weight_reps',
    };
    await db.exercises.add(exercise);
    return { exercise, created: true };
  });
}

/**
 * Thrown when a measurement correction is refused because the Exercise is not
 * one the lifter created (REQ-133, AC-154). A catalog Exercise ships in the
 * build and is never in the table (DEC-007), so there is nothing to correct —
 * and an id nothing knows resolves to the same absence. Callers surface the
 * message.
 */
export class ExerciseNotCorrectableError extends Error {
  constructor() {
    super('Only an exercise you created can have its measurement corrected.');
    this.name = 'ExerciseNotCorrectableError';
  }
}

/**
 * Thrown when a measurement correction is refused because sets are already
 * logged against the Exercise (REQ-133, AC-153, DEC-O). The measurement decides
 * how every stored set is read — which fields mean anything, which way a record
 * moves — so changing it under existing sets would reinterpret history rather
 * than correct a mistake.
 */
export class ExerciseHasLoggedSetsError extends Error {
  constructor() {
    super(
      'Sets are already logged for this exercise, so how it is measured can no longer be changed.',
    );
    this.name = 'ExerciseHasLoggedSetsError';
  }
}

/**
 * Corrects how a user Exercise is measured (REQ-133, DEC-O).
 *
 * A narrow verb, not a general edit: it is the way out of picking the wrong
 * type on the create form, and nothing more.
 *
 * The whole decision — is it ours, does anything reference it, write — happens
 * inside one transaction, so a set logged concurrently cannot land between the
 * check and the write and leave history read under a type it was not logged
 * under.
 *
 * `completedSets` is keyed by `exerciseSessionId` and carries no `exerciseId`,
 * so the reference is found through `exerciseSessions.exerciseId` first: the
 * ExerciseSessions naming this Exercise, then the sets under any of them.
 */
export async function correctExerciseMeasurement(
  id: ExerciseId,
  measurement: Measurement,
): Promise<Exercise> {
  return db.transaction('rw', db.exercises, db.exerciseSessions, db.completedSets, async () => {
    const exercise = await db.exercises.get(id);
    if (exercise === undefined) throw new ExerciseNotCorrectableError();

    const exerciseSessionIds = await db.exerciseSessions.where('exerciseId').equals(id).primaryKeys();
    const logged = await db.completedSets
      .where('exerciseSessionId')
      .anyOf(exerciseSessionIds)
      .count();
    if (logged > 0) throw new ExerciseHasLoggedSetsError();

    await db.exercises.update(id, { measurement });
    return { ...exercise, measurement };
  });
}
