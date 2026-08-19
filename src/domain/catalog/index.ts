/**
 * Exercise catalog (REQ-020, REQ-021, REQ-023).
 *
 * The catalog is the set of base Exercises shipped inside the build (§11.12).
 * It is imported statically, never fetched, and never written into the
 * `exercises` table: lookup consults this module first, then that table
 * (DEC-007). Catalog ids are permanent kebab-case slugs — removing or renaming
 * one is prohibited, because stored history references it (REQ-023).
 *
 * The data lives in `./data`; its category and equipment vocabularies are
 * internal to this module and are not part of the domain contract.
 */

import type { Exercise } from '@/domain/types';
import { toId, type ExerciseId } from '@/domain/ids';
import { CATALOG_ROWS } from '@/domain/catalog/data';

/** A catalog entry. Same shape as any other Exercise; its id is a slug. */
export type CatalogExercise = Exercise;

/** Every catalog entry, in authored order. */
export const CATALOG: readonly CatalogExercise[] = CATALOG_ROWS.map(
  ([slug, name, category, equipment]) => ({
    id: toId<ExerciseId>(slug),
    name,
    category,
    equipment,
  }),
);

/**
 * The normalized form used to match an exercise by name (§26, REQ-022):
 * trimmed, lowercased, inner whitespace collapsed to a single space.
 */
export function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

const byId = new Map(CATALOG.map((entry) => [entry.id as string, entry]));
const byNormalizedName = new Map(
  CATALOG.map((entry) => [normalizeExerciseName(entry.name), entry]),
);

/** Looks a catalog entry up by its slug id. `undefined` when it is not one. */
export function getCatalogExercise(id: ExerciseId): CatalogExercise | undefined {
  return byId.get(id);
}

/**
 * Looks a catalog entry up by name, comparing normalized names
 * (`normalizeExerciseName`). `undefined` when nothing matches.
 */
export function findCatalogExerciseByNormalizedName(name: string): CatalogExercise | undefined {
  return byNormalizedName.get(normalizeExerciseName(name));
}
