import { useLiveQuery } from 'dexie-react-hooks';
import {
  getActiveRoutine,
  getExerciseMeasurements,
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

export function useExerciseMeasurements(ids: readonly ExerciseId[]) {
  const key = ids.join(',');
  return useLiveQuery(
    () => getExerciseMeasurements(key === '' ? [] : (key.split(',') as ExerciseId[])),
    [key],
  );
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

export function useSessionRecord(sessionId: SessionId | null) {
  return useLiveQuery(
    async () => (sessionId === null ? null : ((await getSessionDetail(sessionId)) ?? null)),
    [sessionId],
  );
}

export function useExerciseHistory(exerciseId: ExerciseId) {
  return useLiveQuery(() => listExerciseHistory(exerciseId), [exerciseId]);
}

export function useExerciseHistories(ids: readonly ExerciseId[]) {
  const key = [...new Set(ids)].sort().join(',');
  return useLiveQuery(async () => {
    const unique = key === '' ? [] : (key.split(',') as ExerciseId[]);
    const histories = await Promise.all(unique.map((id) => listExerciseHistory(id)));
    return new Map(unique.map((id, index) => [id, histories[index]!] as const));
  }, [key]);
}

export function usePreviousPerformance(exerciseId: ExerciseId, excludeSessionId: SessionId | null) {
  return useLiveQuery(
    () => getPreviousPerformance(exerciseId, excludeSessionId ?? undefined),
    [exerciseId, excludeSessionId],
  );
}


export function useActiveRoutine() {
  return useLiveQuery(async () => (await getActiveRoutine()) ?? null, []);
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

export function usePlacementsBetween(from: LocalDate, to: LocalDate) {
  return useLiveQuery(() => listPlacementsBetween(from, to), [from, to]);
}

export function useSessionsBetween(from: LocalDate, to: LocalDate) {
  return useLiveQuery(() => listSessionsBetween(from, to), [from, to]);
}

export function useSessionsByRoutine(routineId: RoutineId | null) {
  return useLiveQuery(
    () => (routineId === undefined || routineId === null ? Promise.resolve([]) : listSessionsByRoutine(routineId)),
    [routineId],
  );
}

export function useLastPerformedWorkout(routineId: RoutineId | null) {
  return useLiveQuery(
    () => (routineId === null ? Promise.resolve(null) : getLastPerformedWorkout(routineId)),
    [routineId],
  );
}

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


export function useSettings() {
  return useLiveQuery(() => getSettings(), []);
}

export function useUserExercises() {
  return useLiveQuery(() => listUserExercises(), []);
}

export function usePerformedExercises() {
  return useLiveQuery(() => listPerformedExercises(), []);
}
