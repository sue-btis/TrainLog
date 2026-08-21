/**
 * Feature reads (AGENTS.MD: React reads the database through `useLiveQuery`
 * inside feature hooks, which call repositories — components never touch Dexie).
 *
 * Every hook is a thin wrapper over a repository call. Nothing here decides
 * anything: derivation lives in `@/domain`, and the screens read these.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import {
  getActiveRoutine,
  getExerciseNames,
  getInProgressSession,
  getLastPerformedWorkout,
  getPreviousPerformance,
  getRoutine,
  getSessionDetail,
  getSettings,
  getWorkout,
  listExerciseHistory,
  listPerformedExercises,
  listPlacementsBetween,
  listPlacementsByRoutine,
  listPlannedExercisesByWorkout,
  listRoutines,
  listSessionsBetween,
  listSessionsByRoutine,
  listUserExercises,
  listWorkoutsByRoutine,
} from '@/db';
import type { LocalDate } from '@/domain/dates';
import type { ExerciseId, RoutineId, SessionId, WorkoutId } from '@/domain/ids';
import type { Workout } from '@/domain/types';

export function useRoutines() {
  return useLiveQuery(() => listRoutines(), []);
}

export function useWorkouts(routineId: RoutineId | null) {
  return useLiveQuery(
    () => (routineId === null ? Promise.resolve([]) : listWorkoutsByRoutine(routineId)),
    [routineId],
  );
}

export function usePlacements(routineId: RoutineId | null) {
  return useLiveQuery(
    () => (routineId === null ? Promise.resolve([]) : listPlacementsByRoutine(routineId)),
    [routineId],
  );
}

export function usePlannedExercises(workoutId: WorkoutId | null) {
  return useLiveQuery(
    () => (workoutId === null ? Promise.resolve([]) : listPlannedExercisesByWorkout(workoutId)),
    [workoutId],
  );
}

export function useExerciseNames(ids: readonly ExerciseId[]) {
  const key = ids.join(',');
  return useLiveQuery(() => getExerciseNames(key === '' ? [] : (key.split(',') as ExerciseId[])), [key]);
}

export function useInProgressSession() {
  return useLiveQuery(() => getInProgressSession(), []);
}

export function useSessionDetail(sessionId: SessionId | null) {
  return useLiveQuery(
    () => (sessionId === null ? Promise.resolve(undefined) : getSessionDetail(sessionId)),
    [sessionId],
  );
}

/**
 * One Session for the history detail. `undefined` while the query is in flight,
 * `null` when there is no such Session — the same distinction `useRoutine`
 * draws, and for the same reason: a detail screen must not flash "no such
 * session" during a read that is simply still running.
 *
 * `useSessionDetail` above cannot answer this: gym mode reads it for a Session
 * it already holds, so `undefined` there means only "still reading".
 */
export function useSessionRecord(sessionId: SessionId | null) {
  return useLiveQuery(
    async () => (sessionId === null ? null : ((await getSessionDetail(sessionId)) ?? null)),
    [sessionId],
  );
}

export function useExerciseHistory(exerciseId: ExerciseId) {
  return useLiveQuery(() => listExerciseHistory(exerciseId), [exerciseId]);
}

export function usePreviousPerformance(exerciseId: ExerciseId, excludeSessionId: SessionId | null) {
  return useLiveQuery(
    () => getPreviousPerformance(exerciseId, excludeSessionId ?? undefined),
    [exerciseId, excludeSessionId],
  );
}

/* ── The app shell's reads ─────────────────────────────────────────────── */

/** The Routine the app is currently running, or `undefined` (§11.2). */
export function useActiveRoutine() {
  return useLiveQuery(() => getActiveRoutine(), []);
}

/**
 * One Routine. `undefined` while the query is in flight, `null` when there is
 * no such Routine — a detail screen must not flash "no such routine" during a
 * read that is simply still running.
 */
export function useRoutine(routineId: RoutineId | null) {
  return useLiveQuery(
    async () => (routineId === null ? null : ((await getRoutine(routineId)) ?? null)),
    [routineId],
  );
}

/** Every Placement in a month, across all Routines (§11.3, R-23). */
export function usePlacementsBetween(from: LocalDate, to: LocalDate) {
  return useLiveQuery(() => listPlacementsBetween(from, to), [from, to]);
}

/** Every Session in a month, across all Routines (§11.3, R-23). */
export function useSessionsBetween(from: LocalDate, to: LocalDate) {
  return useLiveQuery(() => listSessionsBetween(from, to), [from, to]);
}

export function useSessionsByRoutine(routineId: RoutineId | null) {
  return useLiveQuery(
    () => (routineId === undefined || routineId === null ? Promise.resolve([]) : listSessionsByRoutine(routineId)),
    [routineId],
  );
}

/** The Workout rotation advances from (§11.4). */
export function useLastPerformedWorkout(routineId: RoutineId | null) {
  return useLiveQuery(
    () => (routineId === null ? Promise.resolve(null) : getLastPerformedWorkout(routineId)),
    [routineId],
  );
}

/**
 * Workouts by id, for rows that name a Workout the calendar found through a
 * Placement or a Session — which can belong to any Routine, including an
 * archived one, so there is no single Routine to list them from.
 */
export function useWorkoutsById(ids: readonly WorkoutId[]) {
  const key = [...new Set(ids)].sort().join(',');
  return useLiveQuery(async () => {
    const wanted = key === '' ? [] : (key.split(',') as WorkoutId[]);
    const found = await Promise.all(wanted.map((id) => getWorkout(id)));
    return new Map(
      found.filter((workout): workout is Workout => workout !== undefined).map((w) => [w.id, w]),
    );
  }, [key]);
}

/* ── Gym mode's reads ──────────────────────────────────────────────────── */

/**
 * Every setting, complete (§32). `undefined` only while the first read is in
 * flight — the repository resolves absent fields, so a caller never has to.
 *
 * One hook rather than one per setting: gym mode needs four of them at once
 * (the unit and RIR an unplanned exercise opens on, and the two the rest timer
 * announces with), and they live in a single row.
 */
export function useSettings() {
  return useLiveQuery(() => getSettings(), []);
}

/**
 * What the unplanned-exercise picker offers: the bundled catalog plus every
 * Exercise a routine file has already created. The catalog ships in the build
 * and is never in the table (DEC-007), so the two lists are disjoint and are
 * concatenated rather than merged.
 */
export function useUserExercises() {
  return useLiveQuery(() => listUserExercises(), []);
}

/**
 * What §11.11's selector offers: every Exercise trained at least once. An
 * exercise nobody has performed has no series to draw, so it is not on offer.
 */
export function usePerformedExercises() {
  return useLiveQuery(() => listPerformedExercises(), []);
}
