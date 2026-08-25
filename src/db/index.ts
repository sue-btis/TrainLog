/**
 * The persistence seam (AGENTS.MD: `features → db → domain`).
 *
 * Everything above this layer imports from here; `dexie` itself is imported
 * only inside `src/db` (REQ-073, AC-074).
 */

export { db, resetDatabase } from '@/db/database';
export { DATABASE_NAME, SCHEMA_VERSION, TABLE_NAMES, TrainLogDatabase } from '@/db/schema';

export { importRoutine } from '@/db/repositories/import';

export {
  exportBackup,
  listSetsForCsv,
  restoreBackup,
  restoreSummary,
  type RestoreSummary,
  type TableCounts,
} from '@/db/repositories/backup';

export {
  RoutineHasSessionsError,
  activateRoutine,
  archiveRoutine,
  deleteRoutine,
  getActiveRoutine,
  getRoutine,
  listRoutines,
  listRoutinesByStatus,
} from '@/db/repositories/routines';

export {
  RoutineNotActiveError,
  RoutineNotFoundError,
  WorkoutNameRequiredError,
  addWorkoutToRoutine,
  getWorkout,
  listWorkoutsByRoutine,
  type AddedWorkout,
} from '@/db/repositories/workouts';

export {
  WorkoutNotFoundError,
  addPlannedExercise,
  getPlannedExercise,
  listPlannedExercisesByWorkout,
} from '@/db/repositories/plannedExercises';

export {
  deletePlacement,
  listPlacementsBetween,
  listPlacementsByRoutine,
  movePlacement,
} from '@/db/repositories/placements';

export {
  ExerciseNameRequiredError,
  createUserExercise,
  getExercise,
  getExerciseName,
  getExerciseNames,
  listUserExercises,
  type CreatedExercise,
} from '@/db/repositories/exercises';

export {
  DEFAULT_SETTINGS,
  DEFAULT_UNIT,
  getDefaultUnit,
  getSettings,
  setDefaultRir,
  setDefaultUnit,
  setKeepScreenAwake,
  setLastBackupAt,
  setTimerSound,
  setTimerVibration,
} from '@/db/repositories/settings';

export {
  SessionHasSetsError,
  SessionInProgressError,
  createStartedWorkout,
  discardSession,
  getInProgressSession,
  getLastPerformedWorkout,
  getSession,
  listAllSessions,
  listSessionsBetween,
  listSessionsByRoutine,
  saveFinishedSession,
} from '@/db/repositories/sessions';

export {
  addExerciseSession,
  getExerciseSession,
  listExerciseSessionsByExercise,
  listExerciseSessionsBySession,
  saveExerciseSession,
  saveExerciseSessions,
} from '@/db/repositories/exerciseSessions';

export {
  deleteCompletedSet,
  groupCompletedSetsByExerciseSession,
  listCompletedSetsByExerciseSession,
  saveEditedSet,
  saveLoggedSet,
} from '@/db/repositories/completedSets';

export {
  getPreviousPerformance,
  getSessionDetail,
  listExerciseHistory,
  listPerformedExercises,
} from '@/db/repositories/history';
