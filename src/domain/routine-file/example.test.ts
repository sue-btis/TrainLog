
import { describe, expect, it } from 'vitest';
import { parseRoutineFile, routineFileToDomain, validateRoutineFile } from '@/domain/routine-file';
import { stringify } from 'yaml';
import { DEMO_ROUTINE_YAML, FIELD_NOTES } from '@/domain/routine-file/example';
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

describe('the field reference the import wizard shows', () => {
  const exercise = {
    name: 'Front Squat',
    exercise_id: 'front-squat',
    category: 'quadriceps',
    measurement: 'weight_reps',
    unit: 'kg',
    sets: 3,
    reps: { min: 5, max: 8 },
    rir: { min: 1, max: 2 },
    rest_seconds: 120,
    focus: 'Strength',
    notes: ['Brace'],
    progression: { type: 'manual' },
  };
  const file = () => ({
    version: 2,
    routine: {
      name: 'Reference',
      weeks: 4,
      workouts: [{ name: 'Lower', suggested_days: ['monday'], exercises: [{ ...exercise }] }],
    },
  });

  /** The object holding a FIELD_NOTES entry's field, and the field's key in it. */
  function locate(document: ReturnType<typeof file>, name: string): [Record<string, unknown>, string] {
    const key = name.split('.').at(-1)!;
    if (name.startsWith('exercises[].')) return [document.routine.workouts[0]!.exercises[0]!, key];
    if (name.startsWith('workouts[].')) return [document.routine.workouts[0]!, key];
    if (name.startsWith('routine.')) return [document.routine, key];
    return [document, key];
  }

  it('lists every exercise field the parser reads', () => {
    const listed = FIELD_NOTES.map((field) => field.name).filter((name) => name.startsWith('exercises[].'));
    expect(new Set(listed)).toEqual(
      new Set([...Object.keys(exercise), 'target'].map((key) => `exercises[].${key}`)),
    );
  });

  it.each(FIELD_NOTES.filter((field) => field.name !== 'exercises[].target'))(
    '$name is marked required exactly when the parser refuses a file without it',
    ({ name, required }) => {
      const document = file();
      const [holder, key] = locate(document, name);
      expect(holder).toHaveProperty(key);
      delete holder[key];

      expect(parseRoutineFile(stringify(document)).ok).toBe(!required);
    },
  );
});
