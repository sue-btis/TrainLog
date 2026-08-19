/**
 * The harness's reads. The shared hooks moved to `@/features/data/queries` when
 * the app shell needed them too; these names stay so the panels read as before.
 */

export {
  useExerciseHistory,
  useExerciseNames,
  useInProgressSession,
  usePlacements,
  usePlannedExercises,
  usePreviousPerformance,
  useRoutines,
  useSessionDetail,
  useWorkouts,
} from '@/features/data/queries';

