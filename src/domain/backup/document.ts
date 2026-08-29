import type {
  CompletedSet,
  Exercise,
  ExerciseSession,
  Placement,
  PlannedExercise,
  Routine,
  Session,
  Settings,
  Timestamp,
  Workout,
} from '@/domain/types';

export const BACKUP_VERSION = 2;

export interface BackupDocument {
  readonly version: number;
  readonly exportedAt: Timestamp;
  readonly routines: readonly Routine[];
  readonly workouts: readonly Workout[];
  readonly plannedExercises: readonly PlannedExercise[];
  readonly placements: readonly Placement[];
  readonly exercises: readonly Exercise[];
  readonly sessions: readonly Session[];
  readonly exerciseSessions: readonly ExerciseSession[];
  readonly completedSets: readonly CompletedSet[];
  readonly settings: Settings;
}

export const RESTORED_TABLES = [
  'routines',
  'workouts',
  'plannedExercises',
  'placements',
  'exercises',
  'sessions',
  'exerciseSessions',
  'completedSets',
] as const;

export type RestoredTable = (typeof RESTORED_TABLES)[number];
