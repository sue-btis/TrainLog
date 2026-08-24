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

/**
 * "Does this movement already exist?" — the §26 lookup, in one place (REQ-102).
 *
 * The catalog first, then the lifter's own Exercises, both by normalized name.
 * This is the first two thirds of `resolveFileExercise`; that function is now
 * "this lookup, else mint", and the create screen asks the same question before
 * writing a row. One implementation rather than two, because two would drift —
 * and a drifted name match splits a lifter's history in two, silently (§26,
 * PRD §39 item 7).
 *
 * The order is not incidental. The catalog wins, so a lifter cannot shadow a
 * shipped movement with one of their own; a row that did shadow one (only
 * `restoreBackup` can produce it) stays unreachable by name, which is a stated
 * ceiling this does not close.
 *
 * `userExercises` is passed in rather than read: the catalog module knows
 * nothing about persistence, and callers already hold the list — the import
 * pipeline grows its own as it walks a file.
 */
export function findExerciseByName(
  name: string,
  userExercises: readonly Exercise[],
): Exercise | undefined {
  const normalized = normalizeExerciseName(name);
  const fromCatalog = byNormalizedName.get(normalized);
  if (fromCatalog) return fromCatalog;

  return userExercises.find(
    (candidate) => normalizeExerciseName(candidate.name) === normalized,
  );
}

/** The group an Exercise falls into when it names no `category` (§11.12). */
export const UNCATEGORIZED = 'uncategorized';

/**
 * The category and equipment vocabularies the shipped catalog itself uses
 * (REQ-105), sorted, for a form that offers a closed choice instead of free
 * text.
 *
 * Derived from `CATALOG` alone, never from stored Exercises. A routine file may
 * write anything it likes into `category` — the schema does not constrain it —
 * and folding those values back into the offer would let one dirty import teach
 * the form a word the catalog never used. PRD §39 item 8 depends on this
 * vocabulary staying clean: muscle volume grouped over dirty categories reports
 * false figures.
 */
export const CATALOG_CATEGORIES: readonly string[] = [
  ...new Set(CATALOG.map((entry) => entry.category).filter((c): c is string => c !== null)),
].sort();

export const CATALOG_EQUIPMENT: readonly string[] = [
  ...new Set(CATALOG.map((entry) => entry.equipment).filter((e): e is string => e !== null)),
].sort();

/** One category's exercises, as the catalog screen draws them. */
export interface ExerciseGroup {
  readonly category: string;
  readonly exercises: readonly Exercise[];
}

/**
 * What the catalog screen shows: exercises narrowed by a name search and by an
 * equipment value, then gathered under the body part they train (§11.12).
 *
 * Pure, so the two rules that are easy to get wrong are testable without a
 * screen. The first is that a search matches the way §26 matches — normalized,
 * so "  front   SQUAT " finds Front Squat — rather than by raw substring. The
 * second is that an exercise naming no category — `null` or empty — is
 * *grouped*, never dropped:
 * the catalog always names one, but an Exercise a routine file created need
 * not, and a lifter's own movement disappearing off this screen would look
 * exactly like a bug in the import.
 *
 * `equipment` is `null` for "every equipment", which is not the same as
 * matching `equipment: null`: asking for barbells excludes a movement that
 * names no equipment, because it is not a barbell movement.
 */
export function groupExercises(
  exercises: readonly Exercise[],
  query: string,
  equipment: string | null,
): readonly ExerciseGroup[] {
  const needle = normalizeExerciseName(query);

  const matching = exercises.filter(
    (exercise) =>
      (equipment === null || exercise.equipment === equipment) &&
      (needle === '' || normalizeExerciseName(exercise.name).includes(needle)),
  );

  const byCategory = new Map<string, Exercise[]>();
  for (const exercise of matching) {
    // `||`, not `??`: a routine file may carry `category: ""` — the schema is
    // `z.string().optional()` with no minimum and nothing validates it — and an
    // empty string would otherwise open a group with no heading.
    const category = exercise.category || UNCATEGORIZED;
    const group = byCategory.get(category);
    if (group) group.push(exercise);
    else byCategory.set(category, [exercise]);
  }

  // Alphabetical, with the unnamed group last — it is the leftovers, and
  // sorting it under "u" would bury it between two real body parts.
  return [...byCategory.entries()]
    .sort(([a], [b]) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    })
    .map(([category, group]) => ({
      category,
      exercises: group.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}
