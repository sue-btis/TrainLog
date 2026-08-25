/**
 * TST-001 — the §12 example parses into the expected domain objects
 * (REQ-030, REQ-033, AC-030, AC-034).
 * TST-004 — exercise resolution (REQ-022, AC-023, AC-024, AC-025) and the
 * default unit (REQ-034, AC-035).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseRoutineFile,
  resolveFileExercise,
  routineFileToDomain,
  validateRoutineFile,
} from '@/domain/routine-file';
import { resolvedFileExercise } from '@/domain/routine-file/to-domain';
import { getCatalogExercise } from '@/domain/catalog';
import { MEASUREMENTS, targetsReps, type Measurement } from '@/domain/measurement';
import { EXAMPLE_YAML, aFile, anExercise, aWorkout } from '@/domain/routine-file/fixtures';
import type { RoutineFile, RoutineFileExercise } from '@/domain/routine-file';
import type { Exercise } from '@/domain/types';
import { toId, type ExerciseId } from '@/domain/ids';

const CREATED_AT = 1_755_000_000_000;

function parsed(text: string): RoutineFile {
  const result = parseRoutineFile(text);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.file;
}

describe('routineFileToDomain — the §12 example (TST-001)', () => {
  const draft = routineFileToDomain(parsed(EXAMPLE_YAML), {
    defaultUnit: 'lb',
    existingExercises: [],
    createdAt: CREATED_AT,
  });

  it('yields one Routine with the file values (AC-030)', () => {
    expect(draft.routine.name).toBe('Hybrid Strength - September');
    expect(draft.routine.weeks).toBe(4);
    expect(draft.routine.status).toBe('active');
    expect(draft.routine.createdAt).toBe(CREATED_AT);
    expect(draft.routine.id).toBeTruthy();
  });

  it('yields one Workout carrying its suggested days and order', () => {
    expect(draft.workouts).toHaveLength(1);
    const workout = draft.workouts[0];
    expect(workout?.name).toBe('Push - Quad + Shoulder Strength');
    expect(workout?.suggestedDays).toEqual(['monday', 'friday']);
    expect(workout?.order).toBe(0);
    expect(workout?.routineId).toBe(draft.routine.id);
  });

  it('yields one PlannedExercise with every mapped field', () => {
    expect(draft.plannedExercises).toHaveLength(1);
    const planned = draft.plannedExercises[0];
    expect(planned).toMatchObject({
      workoutId: draft.workouts[0]?.id,
      exerciseId: 'front-squat',
      sets: 4,
      minReps: 4,
      maxReps: 6,
      minRir: 1,
      maxRir: 2,
      restSeconds: 210,
      unit: 'kg',
      focus: 'Quadriceps Strength',
      notes: ['Maintain upright torso', 'Avoid technical failure'],
      order: 0,
      progression: { type: 'double_progression', increment: 2.5 },
    });
  });

  it('creates no user Exercise for a catalog reference (AC-022)', () => {
    expect(draft.createdExercises).toEqual([]);
  });

  it('assigns order from list position (AC-034)', () => {
    const file = aFile([
      aWorkout({
        name: 'A',
        exercises: [
          anExercise({ name: 'Front Squat' }),
          anExercise({ name: 'Bench Press' }),
          anExercise({ name: 'Barbell Row' }),
        ],
      }),
      aWorkout({ name: 'B', exercises: [anExercise({ name: 'Deadlift' })] }),
    ]);
    const result = routineFileToDomain(file, {
      defaultUnit: 'kg',
      existingExercises: [],
      createdAt: CREATED_AT,
    });
    expect(result.workouts.map((w) => [w.name, w.order])).toEqual([
      ['A', 0],
      ['B', 1],
    ]);
    const first = result.workouts[0]?.id;
    expect(
      result.plannedExercises.filter((p) => p.workoutId === first).map((p) => p.order),
    ).toEqual([0, 1, 2]);
  });

  it('adopts the default unit when the file omits one (AC-035)', () => {
    const result = routineFileToDomain(aFile(), {
      defaultUnit: 'lb',
      existingExercises: [],
      createdAt: CREATED_AT,
    });
    expect(result.plannedExercises[0]?.unit).toBe('lb');
  });

  it('falls back to manual for an unrecognized progression type', () => {
    const result = routineFileToDomain(
      aFile([
        aWorkout({
          exercises: [anExercise({ progression: { type: 'wave_loading' } })],
        }),
      ]),
      { defaultUnit: 'kg', existingExercises: [], createdAt: CREATED_AT },
    );
    expect(result.plannedExercises[0]?.progression).toEqual({ type: 'manual' });
  });
});

describe('resolveFileExercise (TST-004)', () => {
  it('resolves exercise_id against the catalog (AC-023)', () => {
    const resolved = resolveFileExercise(
      anExercise({ name: 'Anything At All', exercise_id: 'front-squat' }),
      [],
    );
    expect(resolved.created).toBe(false);
    expect(resolved.exercise.id).toBe('front-squat');
    expect(resolved.exercise.name).toBe('Front Squat');
  });

  it('resolves a normalized name against the catalog (AC-024)', () => {
    const resolved = resolveFileExercise(anExercise({ name: '  front   SQUAT ' }), []);
    expect(resolved.created).toBe(false);
    expect(resolved.exercise.id).toBe('front-squat');
  });

  it('resolves a normalized name against known user exercises', () => {
    const mine: Exercise = {
      id: toId<ExerciseId>('user-1'),
      name: 'Zercher Good Morning',
      category: null,
      equipment: null,
      measurement: 'weight_reps',
    };
    const resolved = resolveFileExercise(
      anExercise({ name: 'zercher  good morning' }),
      [mine],
    );
    expect(resolved.created).toBe(false);
    expect(resolved.exercise).toBe(mine);
  });

  it('creates a user Exercise when nothing matches', () => {
    const resolved = resolveFileExercise(
      anExercise({ name: 'Zercher Good Morning', category: 'hamstrings' }),
      [],
    );
    expect(resolved.created).toBe(true);
    expect(resolved.exercise.name).toBe('Zercher Good Morning');
    expect(resolved.exercise.category).toBe('hamstrings');
    expect(resolved.exercise.equipment).toBeNull();
    expect(resolved.exercise.id).not.toBe('');
  });

  it('creates one user Exercise and reuses it within the same file (AC-025)', () => {
    const draft = routineFileToDomain(
      aFile([
        aWorkout({
          name: 'A',
          exercises: [anExercise({ name: 'Zercher Good Morning' })],
        }),
        aWorkout({
          name: 'B',
          exercises: [anExercise({ name: '  zercher   good MORNING ' })],
        }),
      ]),
      { defaultUnit: 'kg', existingExercises: [], createdAt: CREATED_AT },
    );
    expect(draft.createdExercises).toHaveLength(1);
    const created = draft.createdExercises[0];
    expect(draft.plannedExercises.map((p) => p.exerciseId)).toEqual([
      created?.id,
      created?.id,
    ]);
  });

  it('reuses an existing user Exercise instead of creating one', () => {
    const mine: Exercise = {
      id: toId<ExerciseId>('user-1'),
      name: 'Zercher Good Morning',
      category: null,
      equipment: null,
      measurement: 'weight_reps',
    };
    const draft = routineFileToDomain(
      aFile([aWorkout({ exercises: [anExercise({ name: 'Zercher Good Morning' })] })]),
      { defaultUnit: 'kg', existingExercises: [mine], createdAt: CREATED_AT },
    );
    expect(draft.createdExercises).toEqual([]);
    expect(draft.plannedExercises[0]?.exerciseId).toBe('user-1');
  });
});

/**
 * The lookup half of `resolveFileExercise`, without the mint (REQ-022, REQ-102).
 *
 * The wizard asks this to decide whether an entry's measurement is still the
 * lifter's to choose, and it must answer exactly what Accept will bind to.
 * Two deciders that can disagree do not throw — they silently mint a second
 * Exercise for a movement the file already names, splitting a lifter's history
 * inside one Routine (§26, `offer.ts` header). Hence the agreement test below.
 */
describe('resolvedFileExercise', () => {
  const mine: Exercise = {
    id: toId<ExerciseId>('user-1'),
    name: 'Zercher Good Morning',
    category: null,
    equipment: null,
    measurement: 'weight_reps',
  };

  it('resolves a catalog row by exercise_id (AC-023)', () => {
    const resolved = resolvedFileExercise(
      anExercise({ name: 'Anything At All', exercise_id: 'front-squat' }),
      [],
    );
    expect(resolved?.id).toBe('front-squat');
    expect(resolved?.measurement).toBe('weight_reps');
  });

  it('resolves a catalog row by name alone, measurement and all (AC-024)', () => {
    // The dangerous one: a file writing `Plank` with a stale `reps: 8–12` binds
    // to a duration movement, and the rep range it states is not the range the
    // Exercise is programmed on (REQ-139).
    const resolved = resolvedFileExercise(anExercise({ name: 'Plank' }), []);
    expect(resolved?.id).toBe('plank');
    expect(resolved?.measurement).toBe('duration');
  });

  it('resolves one of the lifter\u2019s own Exercises by name', () => {
    expect(resolvedFileExercise(anExercise({ name: 'zercher  good morning' }), [mine])).toBe(
      mine,
    );
  });

  it('returns undefined for a name nothing knows \u2014 the case that mints', () => {
    expect(resolvedFileExercise(anExercise({ name: 'Zercher Good Morning' }), [])).toBeUndefined();
  });

  it('falls through to the name when exercise_id names no catalog row', () => {
    const resolved = resolvedFileExercise(
      anExercise({ name: 'Plank', exercise_id: 'no-such-slug' }),
      [],
    );
    expect(resolved?.id).toBe('plank');
  });

  const cases: readonly {
    readonly what: string;
    readonly fileExercise: RoutineFileExercise;
    readonly known: readonly Exercise[];
  }[] = [
    {
      what: 'a catalog id',
      fileExercise: anExercise({ name: 'Anything At All', exercise_id: 'front-squat' }),
      known: [],
    },
    { what: 'a catalog name', fileExercise: anExercise({ name: 'Plank' }), known: [] },
    {
      what: 'a user Exercise name',
      fileExercise: anExercise({ name: 'zercher  good morning' }),
      known: [mine],
    },
    {
      what: 'a name nothing knows',
      fileExercise: anExercise({ name: 'Zercher Good Morning' }),
      known: [],
    },
    {
      what: 'an unknown id with a known name',
      fileExercise: anExercise({ name: 'Plank', exercise_id: 'no-such-slug' }),
      known: [],
    },
  ];

  it.each(cases)('agrees with resolveFileExercise on $what', ({ fileExercise, known }) => {
    const incumbent = resolvedFileExercise(fileExercise, known);
    const resolved = resolveFileExercise(fileExercise, known);

    if (incumbent) {
      expect(resolved).toEqual({ exercise: incumbent, created: false });
    } else {
      expect(resolved.created).toBe(true);
    }
  });
});

// --------------------------------------------------------------- TST-120

/** A file whose one exercise names a movement the catalog does not know. */
function fileYaml(version: 1 | 2, exerciseBody: string): string {
  return [
    `version: ${version}`,
    'routine:',
    '  name: "Measured"',
    '  weeks: 4',
    '  workouts:',
    '    - name: "A"',
    '      exercises:',
    '        - name: "Zercher Good Morning"',
    exerciseBody,
    '          progression: { type: "manual" }',
    '',
  ].join('\n');
}

function draftOf(yaml: string, existingExercises: readonly Exercise[] = []) {
  return routineFileToDomain(parsed(yaml), {
    defaultUnit: 'kg',
    existingExercises,
    createdAt: CREATED_AT,
  });
}

describe('the file format states how an exercise is measured (TST-120)', () => {
  it('mints weight_reps for a version-1 file and fills the rep pair (REQ-130, AC-147, AC-148)', () => {
    const draft = draftOf(
      fileYaml(1, ['          sets: 4', '          reps: { min: 4, max: 6 }'].join('\n')),
    );
    expect(draft.createdExercises.map((e) => e.measurement)).toEqual(['weight_reps']);
    expect(draft.plannedExercises[0]).toMatchObject({
      minReps: 4,
      maxReps: 6,
      minTarget: null,
      maxTarget: null,
    });
  });

  it('maps a version-2 duration exercise onto the target pair (AC-165)', () => {
    const draft = draftOf(
      fileYaml(
        2,
        [
          '          measurement: duration',
          '          sets: 3',
          '          target: { min: 45, max: 45 }',
        ].join('\n'),
      ),
    );
    expect(draft.createdExercises.map((e) => e.measurement)).toEqual(['duration']);
    expect(draft.plannedExercises[0]).toMatchObject({
      minTarget: 45,
      maxTarget: 45,
      minReps: null,
      maxReps: null,
    });
  });

  it('maps a version-2 rep-axis exercise onto the rep pair (AC-164)', () => {
    const draft = draftOf(
      fileYaml(
        2,
        [
          '          measurement: bodyweight_reps',
          '          sets: 3',
          '          reps: { min: 8, max: 12 }',
        ].join('\n'),
      ),
    );
    expect(draft.createdExercises.map((e) => e.measurement)).toEqual(['bodyweight_reps']);
    expect(draft.plannedExercises[0]).toMatchObject({
      minReps: 8,
      maxReps: 12,
      minTarget: null,
      maxTarget: null,
    });
  });

  it('leaves an existing Exercise its own type (REQ-131, AC-150)', () => {
    const mine: Exercise = {
      id: toId<ExerciseId>('user-1'),
      name: 'Zercher Good Morning',
      category: null,
      equipment: null,
      measurement: 'weight_reps',
    };
    const draft = draftOf(
      fileYaml(
        2,
        [
          '          measurement: duration',
          '          sets: 3',
          '          target: { min: 45, max: 45 }',
        ].join('\n'),
      ),
      [mine],
    );
    expect(draft.createdExercises).toEqual([]);
    expect(mine.measurement).toBe('weight_reps');
    expect(draft.plannedExercises[0]?.exerciseId).toBe('user-1');
  });
});

// --------------------------------------------------------------- TST-121

const BLOCK_FILES = ['bloque-a-acumulacion.yaml', 'bloque-b-intensificacion.yaml'];

/**
 * The worked example of the v2 format, which teaches by being read. A file
 * nothing exercises rots into instructions for producing broken imports, and
 * one nothing references can go missing without a sound.
 */
const EXAMPLE_FILE = 'examples/hibrido-v2.yaml';

function docsYaml(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../../docs/${name}`, import.meta.url)),
    'utf8',
  );
}

/** The three isometric holds the blocks programme, and the seconds each states. */
const HOLDS = [
  ['planche-lean', 15, 30],
  ['handstand-hold', 20, 40],
  ['tuck-planche-hold', 10, 20],
] as const;


describe('the shipped blocks still load unchanged (TST-121)', () => {
  it.each(BLOCK_FILES)('%s parses, validates clean and maps (REQ-123, AC-149)', (name) => {
    const file = parsed(docsYaml(name));
    expect(file.version).toBe(2);
    expect(validateRoutineFile(file)).toEqual([]);

    const draft = routineFileToDomain(file, {
      defaultUnit: 'kg',
      existingExercises: [],
      createdAt: CREATED_AT,
    });
    expect(draft.plannedExercises.length).toBeGreaterThan(0);

    // Exactly one target pair per row, and which one is the measurement's call
    // rather than a guess from which field happens to be non-null (REQ-139).
    const minted = new Map(draft.createdExercises.map((it) => [it.id, it] as const));
    for (const planned of draft.plannedExercises) {
      const exercise = minted.get(planned.exerciseId) ?? getCatalogExercise(planned.exerciseId);
      expect(exercise).toBeDefined();
      const onReps = targetsReps(exercise!.measurement);
      expect([planned.minReps, planned.maxReps].every((it) => it !== null)).toBe(onReps);
      expect([planned.minTarget, planned.maxTarget].every((it) => it !== null)).toBe(!onReps);
    }
  });

  // The whole point of the migration: the seconds that used to sit in `notes`
  // beside a fake one-rep range are the programmed target now, so the app can
  // mark a hold against it instead of the lifter reading prose mid-set.
  it.each(BLOCK_FILES)(
    '%s programmes its holds on their own axis (REQ-138, AC-162, AC-163)',
    (name) => {
    const draft = routineFileToDomain(parsed(docsYaml(name)), {
      defaultUnit: 'kg',
      existingExercises: [],
      createdAt: CREATED_AT,
    });

    for (const [id, min, max] of HOLDS) {
      const planned = draft.plannedExercises.filter((it) => it.exerciseId === id);
      expect(planned.length).toBeGreaterThan(0);
      for (const row of planned) {
        expect(getCatalogExercise(toId<ExerciseId>(id))?.measurement).toBe('duration');
        expect(row.minTarget).toBe(min);
        expect(row.maxTarget).toBe(max);
        expect(row.minReps).toBeNull();
        expect(row.maxReps).toBeNull();
      }
      // Bound to the catalog, so both blocks feed one history (REQ-131, §26).
      expect(draft.createdExercises.some((it) => it.id === id)).toBe(false);
    }
  });

  it(`${EXAMPLE_FILE} covers all nine measurement types (REQ-101)`, () => {
    const file = parsed(docsYaml(EXAMPLE_FILE));
    expect(file.version).toBe(2);
    expect(validateRoutineFile(file)).toEqual([]);

    const draft = routineFileToDomain(file, {
      defaultUnit: 'kg',
      existingExercises: [],
      createdAt: CREATED_AT,
    });

    const minted = new Map(draft.createdExercises.map((it) => [it.id, it] as const));
    const covered = new Set<Measurement>();

    for (const planned of draft.plannedExercises) {
      const exercise = minted.get(planned.exerciseId) ?? getCatalogExercise(planned.exerciseId);
      expect(exercise).toBeDefined();
      covered.add(exercise!.measurement);

      const onReps = targetsReps(exercise!.measurement);
      expect([planned.minReps, planned.maxReps].every((it) => it !== null)).toBe(onReps);
      expect([planned.minTarget, planned.maxTarget].every((it) => it !== null)).toBe(!onReps);
    }

    // The whole point of the file. A type nobody wrote down is a type nobody
    // has a worked example of.
    expect([...covered].sort()).toEqual([...MEASUREMENTS].sort());
  });

  it.each(['weighted-dip', 'weighted-pull-up'])(
    'resolves %s to the weighted_bodyweight catalog Exercise (REQ-130)',
    (id) => {
      const yaml = BLOCK_FILES.map(docsYaml).join('\n');
      expect(yaml).toContain(`exercise_id: "${id}"`);
      const resolved = resolveFileExercise(
        anExercise({ name: 'Whatever The File Calls It', exercise_id: id }),
        [],
      );
      expect(resolved.created).toBe(false);
      expect(resolved.exercise.id).toBe(id);
      expect(resolved.exercise.measurement).toBe('weighted_bodyweight');
      expect(getCatalogExercise(toId<ExerciseId>(id))?.measurement).toBe(
        'weighted_bodyweight',
      );
    },
  );
});
