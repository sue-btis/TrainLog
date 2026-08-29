import { db } from '@/db/database';
import { findExerciseByName, getCatalogExercise } from '@/domain/catalog';
import { newId, type ExerciseId } from '@/domain/ids';
import type { Measurement } from '@/domain/measurement';
import type { Exercise } from '@/domain/types';

/** An empty normalized name cannot be resolved reliably, so it is not stored. */
export class ExerciseNameRequiredError extends Error {
  constructor() {
    super('An exercise needs a name.');
    this.name = 'ExerciseNameRequiredError';
  }
}

export interface CreatedExercise {
  readonly exercise: Exercise;
  readonly created: boolean;
}

export function listUserExercises(): Promise<Exercise[]> {
  return db.exercises.toArray();
}

export async function getExercise(id: ExerciseId): Promise<Exercise | undefined> {
  return getCatalogExercise(id) ?? (await db.exercises.get(id));
}

export async function getExerciseName(id: ExerciseId): Promise<string | undefined> {
  return (await getExercise(id))?.name;
}

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

export async function getExerciseNames(
  ids: readonly ExerciseId[],
): Promise<Map<ExerciseId, string>> {
  const resolved = await getExercisesById(ids);
  return new Map([...resolved].map(([id, exercise]) => [id, exercise.name]));
}

export async function getExerciseMeasurements(
  ids: readonly ExerciseId[],
): Promise<Map<ExerciseId, Measurement>> {
  const resolved = await getExercisesById(ids);
  return new Map([...resolved].map(([id, exercise]) => [id, exercise.measurement]));
}

export async function createUserExercise(input: {
  readonly name: string;
  readonly category: string | null;
  readonly equipment: string | null;
  readonly measurement?: Measurement;
}): Promise<CreatedExercise> {
  const name = input.name.trim();
  if (name === '') throw new ExerciseNameRequiredError();

  return db.transaction('rw', db.exercises, async () => {
    // Keep the duplicate check and insert in one transaction.
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

/** A catalog or unknown Exercise cannot be corrected because it is not stored here. */
export class ExerciseNotCorrectableError extends Error {
  constructor() {
    super('Only an exercise you created can have its measurement corrected.');
    this.name = 'ExerciseNotCorrectableError';
  }
}

/** Logged sets make a measurement change unsafe because it would reinterpret history. */
export class ExerciseHasLoggedSetsError extends Error {
  constructor() {
    super(
      'Sets are already logged for this exercise, so how it is measured can no longer be changed.',
    );
    this.name = 'ExerciseHasLoggedSetsError';
  }
}

/** Corrects a stored user Exercise only while it has no logged sets. */
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
