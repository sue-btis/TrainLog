import type {
  CompletedSetId,
  ExerciseId,
  ExerciseSessionId,
  PlacementId,
  PlannedExerciseId,
  RoutineId,
  SessionId,
  WorkoutId,
} from '@/domain/ids';
import type { LocalDate, Timestamp } from '@/domain/dates';
import type { DistanceUnit, Unit } from '@/domain/units';
import type { Measurement } from '@/domain/measurement';

export type { LocalDate, Timestamp } from '@/domain/dates';
export type { DistanceUnit, Unit } from '@/domain/units';
export type { Measurement } from '@/domain/measurement';

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface Exercise {
  readonly id: ExerciseId;
  readonly name: string;
  readonly category: string | null;
  readonly equipment: string | null;
  /** The measurement is authoritative and is snapshotted when the exercise starts. */
  readonly measurement: Measurement;
}

export type RoutineStatus = 'active' | 'archived';

export interface Routine {
  readonly id: RoutineId;
  readonly name: string;
  readonly weeks: number;
  readonly status: RoutineStatus;
  readonly createdAt: Timestamp;
}

export interface Workout {
  readonly id: WorkoutId;
  readonly routineId: RoutineId;
  readonly name: string;
  readonly suggestedDays: readonly Weekday[];
  readonly order: number;
}

export type ProgressionRule = ManualProgression | DoubleProgression;

export interface ManualProgression {
  readonly type: 'manual';
}

export interface DoubleProgression {
  readonly type: 'double_progression';
  readonly increment: number;
}

export interface PlannedExercise {
  readonly id: PlannedExerciseId;
  readonly workoutId: WorkoutId;
  readonly exerciseId: ExerciseId;
  readonly sets: number;
  readonly minReps: number | null;
  readonly maxReps: number | null;
  readonly minTarget: number | null;
  readonly maxTarget: number | null;
  readonly minRir: number | null;
  readonly maxRir: number | null;
  readonly restSeconds: number | null;
  readonly unit: Unit;
  readonly focus: string | null;
  readonly notes: readonly string[];
  readonly order: number;
  readonly progression: ProgressionRule;
}

export interface Placement {
  readonly id: PlacementId;
  readonly routineId: RoutineId;
  readonly workoutId: WorkoutId;
  readonly date: LocalDate;
}

export type SessionStatus = 'in_progress' | 'completed' | 'partial';

export interface Session {
  readonly id: SessionId;
  readonly routineId: RoutineId;
  readonly workoutId: WorkoutId;
  readonly startedAt: Timestamp;
  readonly completedAt: Timestamp | null;
  readonly status: SessionStatus;
  readonly bodyweightKg: number | null;
}

export type ExerciseSessionStatus = 'pending' | 'performed' | 'skipped';

interface ExerciseSessionBase {
  readonly id: ExerciseSessionId;
  readonly sessionId: SessionId;
  readonly exerciseId: ExerciseId;
  readonly order: number;
  readonly status: ExerciseSessionStatus;
  readonly measurement: Measurement;
}

export interface PlannedExerciseSession extends ExerciseSessionBase {
  // These targets are copied when the Session starts so later template edits cannot rewrite history.
  readonly plannedExerciseId: PlannedExerciseId;
  readonly plannedUnit: Unit;
  readonly plannedSets: number;
  readonly plannedMinReps: number | null;
  readonly plannedMaxReps: number | null;
  readonly plannedMinTarget: number | null;
  readonly plannedMaxTarget: number | null;
  readonly plannedMinRir: number | null;
  readonly plannedMaxRir: number | null;
  readonly plannedRestSeconds: number | null;
  readonly plannedProgression: ProgressionRule;
}

export interface UnplannedExerciseSession extends ExerciseSessionBase {
  readonly plannedExerciseId: null;
}

export type ExerciseSession = PlannedExerciseSession | UnplannedExerciseSession;

export interface CompletedSet {
  // Keep entered values and units beside canonical values used for comparison and progression.
  readonly id: CompletedSetId;
  readonly exerciseSessionId: ExerciseSessionId;
  readonly setNumber: number;
  readonly weight: number;
  readonly unit: Unit;
  readonly weightKg: number;
  readonly reps: number | null;
  readonly rir: number;
  readonly durationSeconds: number | null;
  readonly distance: number | null;
  readonly distanceUnit: DistanceUnit | null;
  readonly distanceM: number | null;
  readonly completedAt: Timestamp;
}

export interface Settings {
  readonly id: 'settings';
  readonly defaultUnit: Unit;
  /** The RIR the readouts open on when nothing else is known. `null` = no opinion. */
  readonly defaultRir?: number | null;
  readonly timerVibration?: boolean;
  readonly timerSound?: boolean;
  readonly keepScreenAwake?: boolean;
  readonly bodyweightKg?: number | null;
  readonly lastBackupAt?: Timestamp | null;
}

/** The settings row as everything above the repository sees it: complete. */
export type ResolvedSettings = Required<Settings>;
