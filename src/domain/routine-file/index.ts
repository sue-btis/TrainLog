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
