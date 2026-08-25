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
 * Names for several ids at once, for a list screen. Catalog hits cost nothing;
 * only the ids the catalog does not know reach the table, by primary key.
 */
export async function getExerciseNames(
  ids: readonly ExerciseId[],
): Promise<Map<ExerciseId, string>> {
  const names = new Map<ExerciseId, string>();
  const unresolved: ExerciseId[] = [];

  for (const id of new Set(ids)) {
    const fromCatalog = getCatalogExercise(id);
    if (fromCatalog) names.set(id, fromCatalog.name);
    else unresolved.push(id);
  }

  const rows = await db.exercises.bulkGet(unresolved);
  for (const row of rows) {
    if (row) names.set(row.id, row.name);
  }
  return names;
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
    };
    await db.exercises.add(exercise);
    return { exercise, created: true };
  });
}
