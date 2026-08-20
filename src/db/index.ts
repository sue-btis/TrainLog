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
  RoutineHasSessionsError,
  activateRoutine,
  archiveRoutine,
  deleteRoutine,
  getActiveRoutine,
  getRoutine,
  listRoutines,
  listRoutinesByStatus,
} from '@/db/repositories/routines';

export { getWorkout, listWorkoutsByRoutine } from '@/db/repositories/workouts';

export {
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
  getExercise,
  getExerciseName,
  getExerciseNames,
  listUserExercises,
} from '@/db/repositories/exercises';

export {
  DEFAULT_UNIT,
  getDefaultUnit,
  getSettings,
  setDefaultUnit,
} from '@/db/repositories/settings';

export {
  SessionInProgressError,
  createSession,
  createStartedWorkout,
  getInProgressSession,
  getLastPerformedWorkout,
  getSession,
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
  groupCompletedSetsByExerciseSession,
  listCompletedSetsByExerciseSession,
  saveLoggedSet,
} from '@/db/repositories/completedSets';

export {
  getPreviousPerformance,
  getSessionDetail,
  listExerciseHistory,
} from '@/db/repositories/history';
