import { db } from '@/db/database';
import { findExerciseByName, getCatalogExercise, normalizeExerciseName } from '@/domain/catalog';
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

/** Only a stored user Exercise can be renamed or deleted; catalog entries ship with the app. */
export class ExerciseNotEditableError extends Error {
  constructor() {
    super('Only an exercise you created can be renamed or deleted.');
    this.name = 'ExerciseNotEditableError';
  }
}

/** Two exercises answering to one name would make by-name import matching ambiguous. */
export class ExerciseNameTakenError extends Error {
  constructor(holder: string) {
    super(`"${holder}" already answers to that name. Pick a different one.`);
    this.name = 'ExerciseNameTakenError';
  }
}

/** Deleting a referenced Exercise would orphan logged history or an accepted Routine. */
export class ExerciseInUseError extends Error {
  constructor() {
    super(
      'This exercise has logged sessions or is part of a routine, so it cannot be deleted. Renaming it is safe.',
    );
    this.name = 'ExerciseInUseError';
  }
}

/** Renames a user Exercise and keeps its former name matchable, so a YAML written before still finds it. */
export async function renameUserExercise(id: ExerciseId, name: string): Promise<Exercise> {
  const next = name.trim();
  if (next === '') throw new ExerciseNameRequiredError();

  return db.transaction('rw', db.exercises, async () => {
    const exercise = await db.exercises.get(id);
    if (exercise === undefined) throw new ExerciseNotEditableError();

    const others = (await db.exercises.toArray()).filter((other) => other.id !== id);
    const holder = findExerciseByName(next, others);
    if (holder !== undefined) throw new ExerciseNameTakenError(holder.name);

    const nextKey = normalizeExerciseName(next);
    const formerNames = new Map<string, string>();
    for (const former of [...(exercise.previousNames ?? []), exercise.name]) {
      const key = normalizeExerciseName(former);
      if (key !== nextKey && !formerNames.has(key)) formerNames.set(key, former);
    }
    const renamed: Exercise = { ...exercise, name: next, previousNames: [...formerNames.values()] };
    await db.exercises.put(renamed);
    return renamed;
  });
}

/** Deletes a user Exercise that no Session and no Planned Exercise references. */
export async function deleteUserExercise(id: ExerciseId): Promise<void> {
  await db.transaction('rw', db.exercises, db.exerciseSessions, db.plannedExercises, async () => {
    if ((await db.exercises.get(id)) === undefined) throw new ExerciseNotEditableError();

    const sessions = await db.exerciseSessions.where('exerciseId').equals(id).count();
    const planned = await db.plannedExercises.filter((row) => row.exerciseId === id).count();
    if (sessions > 0 || planned > 0) throw new ExerciseInUseError();

    await db.exercises.delete(id);
  });
}
