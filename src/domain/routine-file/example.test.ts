
import { describe, expect, it } from 'vitest';
import { parseRoutineFile, routineFileToDomain, validateRoutineFile } from '@/domain/routine-file';
import { DEMO_ROUTINE_YAML } from '@/domain/routine-file/example';
import { getCatalogExercise } from '@/domain/catalog';
import { toId, type ExerciseId } from '@/domain/ids';

function demo() {
  const result = parseRoutineFile(DEMO_ROUTINE_YAML);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.file;
}

describe('the bundled demo routine', () => {
  it('imports without structural or semantic issues', () => {
    expect(validateRoutineFile(demo())).toEqual([]);
  });

  it('spreads three workouts over different days', () => {
    const workouts = demo().routine.workouts;
    expect(workouts).toHaveLength(3);
    expect(new Set(workouts.flatMap((w) => w.suggested_days ?? [])).size).toBe(3);
  });

  it('references only catalog exercises, so importing creates none', () => {
    const draft = routineFileToDomain(demo(), { defaultUnit: 'kg', existingExercises: [], createdAt: 0 });
    expect(draft.createdExercises).toEqual([]);
  });

  it('shows at least five measurement types', () => {
    const measurements = demo().routine.workouts
      .flatMap((w) => w.exercises)
      .map((e) => getCatalogExercise(toId<ExerciseId>(e.exercise_id ?? ''))?.measurement);
    expect(measurements).not.toContain(undefined);
    expect(new Set(measurements).size).toBeGreaterThanOrEqual(5);
  });
});
