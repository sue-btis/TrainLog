/**
 * Exercise Sessions (§14.7, ADR 0002).
 *
 * The snapshot of §16 is taken by `startPlannedExercise` in the domain; this
 * only stores what it produced. Nothing here reads a target back through
 * `plannedExerciseId` — it is provenance only.
 */

import { db } from '@/db/database';
import type { ExerciseSessionId, SessionId } from '@/domain/ids';
import type { ExerciseSession } from '@/domain/types';

export function getExerciseSession(
  id: ExerciseSessionId,
): Promise<ExerciseSession | undefined> {
  return db.exerciseSessions.get(id);
}

/** Stores a newly started exercise (`startPlannedExercise` / `startUnplannedExercise`). */
export async function addExerciseSession(exerciseSession: ExerciseSession): Promise<void> {
  await db.exerciseSessions.add(exerciseSession);
}

/**
 * Overwrites an existing ExerciseSession — the `skipExercise` transition
 * (REQ-056). The `performed` transition is not written here: it belongs to the
 * set that caused it, and `saveLoggedSet` writes the pair atomically (DEC-009).
 */
export async function saveExerciseSession(exerciseSession: ExerciseSession): Promise<void> {
  await db.exerciseSessions.put(exerciseSession);
}

/**
 * R-10 — overwrites several ExerciseSessions at once, which is what a reorder
 * is: `reorderExerciseSessions` renumbers `order` across the whole list, and a
 * list written row by row would be briefly readable with two exercises claiming
 * the same position.
 *
 * Only ExerciseSessions are written. The PlannedExercises behind them are not
 * touched — deviation belongs to the Session. A Routine can gain rows after it
 * is accepted (§3.1), but no stored row is ever rewritten, and least of all by
 * a Session: what was performed never edits what was planned (§11.5,
 * AGENTS.MD).
 */
export async function saveExerciseSessions(
  exerciseSessions: readonly ExerciseSession[],
): Promise<void> {
  if (exerciseSessions.length === 0) return;
  await db.exerciseSessions.bulkPut([...exerciseSessions]);
}

/** One Session's exercises in `order` (§11.5). Index: sessionId. */
export async function listExerciseSessionsBySession(
  sessionId: SessionId,
): Promise<ExerciseSession[]> {
  const exercises = await db.exerciseSessions.where('sessionId').equals(sessionId).toArray();
  return exercises.sort((a, b) => a.order - b.order);
}

/** Every ExerciseSession for one Exercise, across Routines (§26). Index: exerciseId. */
export function listExerciseSessionsByExercise(
  exerciseId: ExerciseSession['exerciseId'],
): Promise<ExerciseSession[]> {
  return db.exerciseSessions.where('exerciseId').equals(exerciseId).toArray();
}
