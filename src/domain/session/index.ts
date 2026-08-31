import type { Timestamp } from '@/domain/dates';
import {
  newId,
  type CompletedSetId,
  type ExerciseId,
  type ExerciseSessionId,
  type RoutineId,
  type SessionId,
  type WorkoutId,
} from '@/domain/ids';
import type {
  CompletedSet,
  ExerciseSession,
  PlannedExercise,
  PlannedExerciseSession,
  Session,
  SessionStatus,
  UnplannedExerciseSession,
} from '@/domain/types';
import { toKg, toMetres, type DistanceUnit, type Unit } from '@/domain/units';
import type { Measurement } from '@/domain/measurement';

export interface StartSessionInput {
  readonly routineId: RoutineId;
  readonly workoutId: WorkoutId;
  readonly startedAt: Timestamp;
  readonly bodyweightKg?: number | null;
}

export function startSession({
  routineId,
  workoutId,
  startedAt,
  bodyweightKg = null,
}: StartSessionInput): Session {
  return {
    id: newId<SessionId>(),
    routineId,
    workoutId,
    startedAt,
    completedAt: null,
    status: 'in_progress',
    bodyweightKg,
  };
}

export interface StartPlannedExerciseInput {
  readonly sessionId: SessionId;
  readonly planned: PlannedExercise;
  readonly measurement: Measurement;
  readonly order: number;
}

export function startPlannedExercise({
  sessionId,
  planned,
  measurement,
  order,
}: StartPlannedExerciseInput): PlannedExerciseSession {
  return {
    id: newId<ExerciseSessionId>(),
    sessionId,
    exerciseId: planned.exerciseId,
    order,
    status: 'pending',
    measurement,
    plannedExerciseId: planned.id,
    plannedUnit: planned.unit,
    plannedSets: planned.sets,
    plannedMinReps: planned.minReps,
    plannedMaxReps: planned.maxReps,
    plannedMinTarget: planned.minTarget,
    plannedMaxTarget: planned.maxTarget,
    plannedMinRir: planned.minRir,
    plannedMaxRir: planned.maxRir,
    plannedRestSeconds: planned.restSeconds,
    plannedProgression: { ...planned.progression },
  };
}

export interface StartUnplannedExerciseInput {
  readonly sessionId: SessionId;
  readonly exerciseId: ExerciseId;
  readonly measurement: Measurement;
  readonly order: number;
}

export function startUnplannedExercise({
  sessionId,
  exerciseId,
  measurement,
  order,
}: StartUnplannedExerciseInput): UnplannedExerciseSession {
  return {
    id: newId<ExerciseSessionId>(),
    sessionId,
    exerciseId,
    order,
    status: 'pending',
    measurement,
    plannedExerciseId: null,
  };
}

export interface LogSetInput<T extends ExerciseSession> {
  readonly exerciseSession: T;
  readonly setNumber: number;
  readonly weight: number;
  readonly unit: Unit;
  readonly reps: number | null;
  readonly rir: number;
  readonly durationSeconds?: number | null;
  readonly distance?: number | null;
  readonly distanceUnit?: DistanceUnit | null;
  readonly completedAt: Timestamp;
}

export function logSet<T extends ExerciseSession>({
  exerciseSession,
  setNumber,
  weight,
  unit,
  reps,
  rir,
  durationSeconds = null,
  distance = null,
  distanceUnit = null,
  completedAt,
}: LogSetInput<T>): { readonly set: CompletedSet; readonly exerciseSession: T } {
  const set: CompletedSet = {
    id: newId<CompletedSetId>(),
    exerciseSessionId: exerciseSession.id,
    setNumber,
    weight,
    unit,
    weightKg: toKg(weight, unit),
    reps,
    rir,
    durationSeconds,
    distance,
    distanceUnit,
    distanceM: metresOf(distance, distanceUnit),
    completedAt,
  };

  return { set, exerciseSession: { ...exerciseSession, status: 'performed' } };
}

export function skipExercise<T extends ExerciseSession>(exerciseSession: T): T {
  return { ...exerciseSession, status: 'skipped' };
}

export function deriveSessionStatus(
  exerciseSessions: readonly ExerciseSession[],
): Extract<SessionStatus, 'completed' | 'partial'> {
  const abandoned = exerciseSessions.some((it) => it.status === 'pending');
  return abandoned ? 'partial' : 'completed';
}

export function finishSession(
  session: Session,
  exerciseSessions: readonly ExerciseSession[],
  completedAt: Timestamp,
): Session {
  return {
    ...session,
    completedAt,
    status: deriveSessionStatus(exerciseSessions),
  };
}

export interface StartWorkoutInput {
  readonly routineId: RoutineId;
  readonly workoutId: WorkoutId;
  readonly planned: readonly PlannedExercise[];
  readonly measurementOf: (exerciseId: ExerciseId) => Measurement;
  readonly startedAt: Timestamp;
  readonly bodyweightKg?: number | null;
}

export function startWorkout({
  routineId,
  workoutId,
  planned,
  measurementOf,
  startedAt,
  bodyweightKg = null,
}: StartWorkoutInput): {
  readonly session: Session;
  readonly exerciseSessions: readonly PlannedExerciseSession[];
} {
  const session = startSession({ routineId, workoutId, startedAt, bodyweightKg });
  const exerciseSessions = [...planned]
    .sort((a, b) => a.order - b.order)
    .map((exercise, order) =>
      startPlannedExercise({
        sessionId: session.id,
        planned: exercise,
        measurement: measurementOf(exercise.exerciseId),
        order,
      }),
    );

  return { session, exerciseSessions };
}

export function moveExerciseSession<T extends ExerciseSession>(
  exerciseSessions: readonly T[],
  id: ExerciseSessionId,
  toPosition: number,
): readonly T[] {
  // Reindex after the move because `order` is persisted and must remain a
  // contiguous, deterministic sequence; positions outside the list clamp.
  const ordered = [...exerciseSessions].sort((a, b) => a.order - b.order);
  const from = ordered.findIndex((it) => it.id === id);
  if (from === -1) return exerciseSessions;

  const to = Math.min(Math.max(toPosition, 0), ordered.length - 1);
  if (to === from) return exerciseSessions;

  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved as T);

  return ordered.map((it, order) => (it.order === order ? it : { ...it, order }));
}

export interface RestRemainingInput {
  readonly since: Timestamp;
  readonly seconds: number;
  readonly now: Timestamp;
  readonly added?: number;
  /** When the lifter paused, if they did. The clock stops there. */
  readonly pausedAt?: Timestamp;
}

export function restRemaining({
  since,
  seconds,
  now,
  added = 0,
  pausedAt,
}: RestRemainingInput): number {
  const elapsed = (pausedAt ?? now) - since;
  const remaining = (seconds + added) * 1_000 - elapsed;
  return Math.max(0, Math.ceil(remaining / 1_000));
}

export interface EditSetInput {
  readonly set: CompletedSet;
  readonly weight: number;
  readonly unit: Unit;
  readonly reps: number | null;
  readonly rir: number;
  readonly durationSeconds?: number | null;
  readonly distance?: number | null;
  readonly distanceUnit?: DistanceUnit | null;
}

export function editSet({
  set,
  weight,
  unit,
  reps,
  rir,
  durationSeconds = set.durationSeconds,
  distance = set.distance,
  distanceUnit = set.distanceUnit,
}: EditSetInput): CompletedSet {
  return {
    ...set,
    weight,
    unit,
    weightKg: toKg(weight, unit),
    reps,
    rir,
    durationSeconds,
    distance,
    distanceUnit,
    distanceM: metresOf(distance, distanceUnit),
  };
}

function metresOf(distance: number | null, unit: DistanceUnit | null): number | null {
  if (distance === null || unit === null) return null;
  return toMetres(distance, unit);
}

export interface RemoveSetInput<T extends ExerciseSession> {
  readonly exerciseSession: T;
  readonly sets: readonly CompletedSet[];
  readonly setId: CompletedSetId;
}

export function removeSet<T extends ExerciseSession>({
  exerciseSession,
  sets,
  setId,
}: RemoveSetInput<T>): { readonly sets: readonly CompletedSet[]; readonly exerciseSession: T } {
  // Survivors close the numbering gap, and an emptied performed exercise is
  // pending again so the Session cannot finish as if work still existed.
  if (!sets.some((set) => set.id === setId)) return { sets, exerciseSession };

  const survivors = [...sets]
    .filter((set) => set.id !== setId)
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((set, index) =>
      set.setNumber === index + 1 ? set : { ...set, setNumber: index + 1 },
    );

  const emptied = survivors.length === 0 && exerciseSession.status === 'performed';

  return {
    sets: survivors,
    exerciseSession: emptied ? { ...exerciseSession, status: 'pending' } : exerciseSession,
  };
}
