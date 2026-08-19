/**
 * Session execution (REQ-050…057, §11.5, §11.7, §16, §36, ADR 0002, DEC-009).
 *
 * Pure constructors and transitions over the execution entities. Nothing here
 * reads the clock or touches storage: every instant is a parameter, and each
 * function returns the value the persistence layer is expected to write.
 *
 * The load-bearing rule is the snapshot (ADR 0002): starting a planned exercise
 * copies the PlannedExercise targets into the ExerciseSession. `plannedExerciseId`
 * is provenance only — nothing here, or downstream, reads a target back through
 * it, so editing or re-importing a template cannot rewrite a past Session.
 */

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
import { toKg, type Unit } from '@/domain/units';

export interface StartSessionInput {
  readonly routineId: RoutineId;
  readonly workoutId: WorkoutId;
  /** The instant the session started. Never read from the clock here (DEC-008). */
  readonly startedAt: Timestamp;
}

/**
 * REQ-050 — starting a Workout produces an `in_progress` Session.
 *
 * It records which Routine and Workout it came from and nothing about *when it
 * was meant to happen*: intent is a Placement, and a Session never references
 * one (ADR 0001, AC-051).
 */
export function startSession({
  routineId,
  workoutId,
  startedAt,
}: StartSessionInput): Session {
  return {
    id: newId<SessionId>(),
    routineId,
    workoutId,
    startedAt,
    completedAt: null,
    status: 'in_progress',
  };
}

export interface StartPlannedExerciseInput {
  readonly sessionId: SessionId;
  /** The template being executed. Read once, here, and never again (ADR 0002). */
  readonly planned: PlannedExercise;
  /** Position within the Session — free to differ from `planned.order` (§11.5). */
  readonly order: number;
}

/**
 * REQ-051, REQ-053 — starts a planned exercise by *snapshotting* its targets.
 *
 * Every planned field, including the progression rule, is copied by value. The
 * rule is a plain value object (DEC-006), and every member of the union is
 * immutable, so the spread below is a complete copy — there is no nested
 * mutable state to share with the template.
 */
export function startPlannedExercise({
  sessionId,
  planned,
  order,
}: StartPlannedExerciseInput): PlannedExerciseSession {
  return {
    id: newId<ExerciseSessionId>(),
    sessionId,
    exerciseId: planned.exerciseId,
    order,
    status: 'pending',
    plannedExerciseId: planned.id,
    plannedSets: planned.sets,
    plannedMinReps: planned.minReps,
    plannedMaxReps: planned.maxReps,
    plannedMinRir: planned.minRir,
    plannedMaxRir: planned.maxRir,
    plannedRestSeconds: planned.restSeconds,
    plannedProgression: { ...planned.progression },
  };
}

export interface StartUnplannedExerciseInput {
  readonly sessionId: SessionId;
  readonly exerciseId: ExerciseId;
  readonly order: number;
}

/**
 * REQ-052 — an exercise with no PlannedExercise behind it (§11.5). It carries
 * no targets and receives no progression suggestion (§11.9). A substitution is
 * expressed as `skipExercise` on the planned one plus one of these.
 */
export function startUnplannedExercise({
  sessionId,
  exerciseId,
  order,
}: StartUnplannedExerciseInput): UnplannedExerciseSession {
  return {
    id: newId<ExerciseSessionId>(),
    sessionId,
    exerciseId,
    order,
    status: 'pending',
    plannedExerciseId: null,
  };
}

export interface LogSetInput<T extends ExerciseSession> {
  readonly exerciseSession: T;
  /** Its position in the exercise, 1-based. May exceed `plannedSets` (§11.5). */
  readonly setNumber: number;
  /** The weight exactly as entered, in `unit`. */
  readonly weight: number;
  readonly unit: Unit;
  readonly reps: number;
  /** The RIR actually achieved, not the planned one (§30). */
  readonly rir: number;
  readonly completedAt: Timestamp;
}

/**
 * REQ-054, REQ-056 — builds the CompletedSet and moves its ExerciseSession to
 * `performed` in one step, so "performed on the first logged set" (DEC-009)
 * cannot drift apart from the set that caused it.
 *
 * `weight` and `unit` are kept as entered; `weightKg` is derived with `toKg`
 * and is what every comparison, chart and progression step reads (§11.7).
 * Persisting both atomically is WS-7's job; this only produces the values.
 */
export function logSet<T extends ExerciseSession>({
  exerciseSession,
  setNumber,
  weight,
  unit,
  reps,
  rir,
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
    completedAt,
  };

  return { set, exerciseSession: { ...exerciseSession, status: 'performed' } };
}

/**
 * REQ-056 — the only way to reach `skipped`: an explicit user action. Skipping
 * is legitimate deviation (§11.5) and does not make the Session partial.
 */
export function skipExercise<T extends ExerciseSession>(exerciseSession: T): T {
  return { ...exerciseSession, status: 'skipped' };
}

/**
 * REQ-057, DEC-009 — `completed` when no ExerciseSession is still `pending`,
 * `partial` otherwise. Read from `ExerciseSession.status` alone; no extra field
 * exists and none is needed.
 */
export function deriveSessionStatus(
  exerciseSessions: readonly ExerciseSession[],
): Extract<SessionStatus, 'completed' | 'partial'> {
  const abandoned = exerciseSessions.some((it) => it.status === 'pending');
  return abandoned ? 'partial' : 'completed';
}

/** REQ-057 — stamps `completedAt` and the derived status onto the Session. */
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
