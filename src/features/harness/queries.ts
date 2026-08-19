/**
 * Harness reads (AGENTS.MD: React reads the database through `useLiveQuery`
 * inside feature hooks, which call repositories — components never touch Dexie).
 *
 * Every hook is a thin wrapper over one repository call, so the harness stays
 * what it is: a driver for the two §47 flows, not a screen of the product.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import {
  getExerciseNames,
  getInProgressSession,
  getPreviousPerformance,
  getSessionDetail,
  listExerciseHistory,
  listPlacementsByRoutine,
  listPlannedExercisesByWorkout,
  listRoutines,
  listWorkoutsByRoutine,
} from '@/db';
import type { ExerciseId, RoutineId, SessionId, WorkoutId } from '@/domain/ids';

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

export function useExerciseHistory(exerciseId: ExerciseId) {
  return useLiveQuery(() => listExerciseHistory(exerciseId), [exerciseId]);
}

export function usePreviousPerformance(exerciseId: ExerciseId, excludeSessionId: SessionId | null) {
  return useLiveQuery(
    () => getPreviousPerformance(exerciseId, excludeSessionId ?? undefined),
    [exerciseId, excludeSessionId],
  );
}
