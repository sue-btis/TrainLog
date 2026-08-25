/**
 * The routine file pipeline (§11.1, §12): parse → validate → domain objects.
 *
 * ```ts
 * const result = parseRoutineFile(text);           // structural, rejects
 * if (!result.ok) return result.errors;
 * const issues = validateRoutineFile(result.file); // semantic, never rejects
 * const draft = routineFileToDomain(result.file, {
 *   defaultUnit, existingExercises, createdAt,
 * });
 * ```
 *
 * Between validation and mapping the wizard may edit the file — `addWorkout`,
 * `addExercise`, `setRoutineName`, `setWorkoutName`, `editExercise`,
 * `deleteExercise`, `moveExercise`, `toggleSuggestedDay`, `setWeeks` — and
 * re-validate. The wizard is where a *draft* is corrected; a Routine already
 * accepted takes additions only, never a rewrite or a deletion (AGENTS.MD).
 *
 * `blankRoutineFile` is the same pipeline entered without a file: a draft with
 * no name and no Workouts, which validates as exactly those two problems.
 *
 * Nothing here touches a database or a clock; `src/db` persists the draft.
 */

export {
  formatPath,
  parseRoutineFile,
  type FieldPath,
  type ParseRoutineFileResult,
  type PathSegment,
  type RoutineFile,
  type RoutineFileExercise,
  type RoutineFileProgression,
  type RoutineFileRoutine,
  type RoutineFileWeekday,
  type RoutineFileWorkout,
  type StructuralError,
} from '@/domain/routine-file/schema';

export {
  addExercise,
  addWorkout,
  blankRoutineFile,
  deleteExercise,
  editExercise,
  moveExercise,
  setRoutineName,
  setWeeks,
  setWorkoutName,
  toggleSuggestedDay,
  type ExerciseRef,
  type MoveDirection,
} from '@/domain/routine-file/edit';

export {
  MAX_RIR,
  MIN_RIR,
  validateRoutineFile,
  type SemanticIssue,
  type SemanticIssueCode,
} from '@/domain/routine-file/validate';

export {
  resolveFileExercise,
  routineFileToDomain,
  type ResolvedExercise,
  type RoutineDraft,
  type RoutineFileToDomainOptions,
} from '@/domain/routine-file/to-domain';

/**
 * What the wizard's add-exercise picker may offer, and what picking one writes.
 * The list and the row it produces both route through `resolveFileExercise`, so
 * the offer shown is the Exercise Accept will bind to (§26).
 */
export {
  draftExercise,
  offeredExercises,
  offerName,
  resolveTypedName,
  type Offer,
} from '@/domain/routine-file/offer';

/**
 * Targets entered outside the wizard, dressed as a file so `validateRoutineFile`
 * can check them — one semantic tier, not two that must agree (REQ-913).
 */
export {
  plannedExerciseDraftFile,
  plannedExerciseDraftRefusals,
  type PlannedExerciseDraft,
} from '@/domain/routine-file/planned-exercise-draft';
