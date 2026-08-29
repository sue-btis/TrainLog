import type { Exercise } from '@/domain/types';
import { toId, type ExerciseId } from '@/domain/ids';
import { CATALOG_ROWS } from '@/domain/catalog/data';

export type CatalogExercise = Exercise;

export const CATALOG: readonly CatalogExercise[] = CATALOG_ROWS.map(
  ([slug, name, category, equipment, measurement]) => ({
    id: toId<ExerciseId>(slug),
    name,
    category,
    equipment,
    measurement,
  }),
);

export function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

const byId = new Map(CATALOG.map((entry) => [entry.id as string, entry]));
const byNormalizedName = new Map(
  CATALOG.map((entry) => [normalizeExerciseName(entry.name), entry]),
);

export function getCatalogExercise(id: ExerciseId): CatalogExercise | undefined {
  return byId.get(id);
}

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

export const UNCATEGORIZED = 'uncategorized';

export const CATALOG_CATEGORIES: readonly string[] = [
  ...new Set(CATALOG.map((entry) => entry.category).filter((c): c is string => c !== null)),
].sort();

export const CATALOG_EQUIPMENT: readonly string[] = [
  ...new Set(CATALOG.map((entry) => entry.equipment).filter((e): e is string => e !== null)),
].sort();

export interface ExerciseGroup {
  readonly category: string;
  readonly exercises: readonly Exercise[];
}

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
