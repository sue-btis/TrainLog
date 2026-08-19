/**
 * Exercises (REQ-071, DEC-007).
 *
 * The table holds user-created Exercises only. The catalog ships in the build
 * and is never inserted, so every read that turns an `exerciseId` into an
 * Exercise has to consult the catalog first and the table second. That rule
 * lives here so no caller has to know it.
 */

import { db } from '@/db/database';
import { getCatalogExercise } from '@/domain/catalog';
import type { ExerciseId } from '@/domain/ids';
import type { Exercise } from '@/domain/types';

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
