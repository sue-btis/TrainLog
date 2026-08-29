import { describe, expect, it } from 'vitest';
import { CATALOG, getCatalogExercise, normalizeExerciseName } from '@/domain/catalog';
import { toId, type ExerciseId } from '@/domain/ids';
import type { Exercise } from '@/domain/types';
import { addExercise } from '@/domain/routine-file/edit';
import { aFile, anExercise, aWorkout } from '@/domain/routine-file/fixtures';
import {
  draftExercise,
  offeredExercises,
  offerName,
  resolveTypedName,
  type Offer,
} from '@/domain/routine-file/offer';
import type { RoutineFile } from '@/domain/routine-file/schema';
import { resolveFileExercise, routineFileToDomain } from '@/domain/routine-file/to-domain';
import { validateRoutineFile } from '@/domain/routine-file/validate';

// 'Zercher Squat', 'Sled Push' and 'Sandbag Carry' are deliberately absent from
// the bundled catalog, and several tests below depend on that staying true.

const frontSquat = getCatalogExercise(toId<ExerciseId>('front-squat'))!;

function aUserExercise(name: string, id = 'user-1'): Exercise {
  return {
    id: toId<ExerciseId>(id),
    name,
    category: null,
    equipment: null,
    measurement: 'weight_reps',
  };
}

/** A draft with the given Workouts and no exercises in any of them. */
function anEmptyDraft(...names: string[]): RoutineFile {
  return aFile(
    (names.length === 0 ? ['Push'] : names).map((name) => aWorkout({ name, exercises: [] })),
  );
}

function toDomain(file: RoutineFile, existingExercises: readonly Exercise[] = []) {
  return routineFileToDomain(file, { defaultUnit: 'kg', existingExercises, createdAt: 1_000 });
}

function named(offers: readonly Offer[], name: string): readonly Offer[] {
  const needle = normalizeExerciseName(name);
  return offers.filter((offer) => normalizeExerciseName(offerName(offer)) === needle);
}

describe('offeredExercises', () => {
  it('de-duplicates by resolved identity, so a draft row the catalog knows is offered once', () => {
    // The spelling is the proof that it routes through `findExerciseByName`:
    // only a normalized comparison recognizes this as the Front Squat.
    const file = aFile([aWorkout({ exercises: [anExercise({ name: '  front   SQUAT ' })] })]);

    expect(named(offeredExercises(file, []), 'Front Squat')).toEqual([
      { kind: 'catalog', exercise: frontSquat },
    ]);
  });

  it('offers the whole catalog first, then persisted Exercises, then draft-only ones', () => {
    const file = aFile([aWorkout({ exercises: [anExercise({ name: 'Sled Push' })] })]);
    const stored = aUserExercise('Zercher Squat');

    const offers = offeredExercises(file, [stored]);

    expect(offers).toHaveLength(CATALOG.length + 2);
    expect(new Set(offers.slice(0, CATALOG.length).map((offer) => offer.kind))).toEqual(
      new Set(['catalog']),
    );
    expect(offers[CATALOG.length]).toEqual({ kind: 'user', exercise: stored });
    expect(offers[CATALOG.length + 1]).toEqual({ kind: 'draft', name: 'Sled Push' });
  });

  it('surfaces a name that exists only in the draft, from every Workout of the file', () => {
    const file = aFile([
      aWorkout({ name: 'Push', exercises: [anExercise({ name: 'Sled Push' })] }),
      aWorkout({ name: 'Pull', exercises: [anExercise({ name: 'Sandbag Carry' })] }),
    ]);

    const drafts = offeredExercises(file, []).filter((offer) => offer.kind === 'draft');

    expect(drafts.map(offerName)).toEqual(['Sled Push', 'Sandbag Carry']);
  });

  it('does not offer a nameless draft row', () => {
    // The file schema puts no minimum on `name`, so a row can carry a blank one.
    // Offered, it would be a control the lifter cannot read and that
    // `resolveTypedName` can never reach — its blank guard sees to that.
    const file = aFile([
      aWorkout({ exercises: [anExercise({ name: '   ' }), anExercise({ name: 'Sled Push' })] }),
    ]);

    const drafts = offeredExercises(file, []).filter((offer) => offer.kind === 'draft');

    expect(drafts.map(offerName)).toEqual(['Sled Push']);
  });

  it('does not offer a user Exercise the catalog shadows, because no pick could bind to it', () => {
    const shadow = aUserExercise('front squat', 'shadow-1');

    const offers = offeredExercises(anEmptyDraft(), [shadow]);

    expect(offers.some((offer) => offer.kind === 'user')).toBe(false);
    // And this is why: resolution walks straight past it to the catalog entry.
    expect(resolveFileExercise(anExercise({ name: 'Front Squat' }), [shadow]).exercise.id).toBe(
      'front-squat',
    );
  });
});

describe('resolveTypedName', () => {
  const offers = offeredExercises(anEmptyDraft(), []);

  it('matches through normalizeExerciseName and nothing else', () => {
    expect(resolveTypedName('  front   SQUAT ', offers)).toEqual({
      kind: 'catalog',
      exercise: frontSquat,
    });
  });

  it('yields a new offer for a name none of the sources knows', () => {
    expect(resolveTypedName('Front Squats', offers)).toEqual({ kind: 'new', name: 'Front Squats' });
    expect(resolveTypedName('  Sled Push  ', offers)).toEqual({ kind: 'new', name: 'Sled Push' });
  });

  it('matches nothing on a blank name, and still yields an offer', () => {
    expect(resolveTypedName('   ', offers)).toEqual({ kind: 'new', name: '' });
  });

  it('reuses a persisted Exercise rather than treating the typed name as new', () => {
    const stored = aUserExercise('Zercher Squat');
    const withUser = offeredExercises(anEmptyDraft(), [stored]);

    expect(resolveTypedName('zercher   squat', withUser)).toEqual({
      kind: 'user',
      exercise: stored,
    });
  });
});

describe('draftExercise', () => {
  it('seeds three sets of eight to twelve on manual progression, every optional field absent', () => {
    const row = draftExercise({ kind: 'new', name: 'Sled Push' });

    expect(row).toEqual({
      name: 'Sled Push',
      sets: 3,
      reps: { min: 8, max: 12 },
      notes: [],
      progression: { type: 'manual' },
    });
    // `unit` absent is load-bearing: `routineFileToDomain` maps a missing unit
    // onto the Settings default, so the row inherits the lifter's preference.
    expect('unit' in row).toBe(false);
  });

  it('writes the catalog spelling and slug for a catalog offer', () => {
    expect(draftExercise({ kind: 'catalog', exercise: frontSquat })).toMatchObject({
      name: 'Front Squat',
      exercise_id: 'front-squat',
    });
  });

  it('preserves the exercise_id a draft row declares, under the draft row own spelling', () => {
    expect(
      draftExercise({ kind: 'draft', name: 'Sentadilla Frontal', exerciseId: 'front-squat' }),
    ).toMatchObject({ name: 'Sentadilla Frontal', exercise_id: 'front-squat' });
  });

  it('omits exercise_id entirely for a persisted-user offer, a typed name and a bare draft row', () => {
    const rows = [
      draftExercise({ kind: 'user', exercise: aUserExercise('Zercher Squat') }),
      draftExercise({ kind: 'new', name: 'Sled Push' }),
      draftExercise({ kind: 'draft', name: 'Sandbag Carry' }),
    ];

    for (const row of rows) expect('exercise_id' in row).toBe(false);
  });

  it('leaves the issue list exactly as it was, for every offer kind', () => {
    const base = aFile();
    const baseline = validateRoutineFile(base);
    const offers: readonly Offer[] = [
      { kind: 'catalog', exercise: frontSquat },
      { kind: 'user', exercise: aUserExercise('Zercher Squat') },
      { kind: 'draft', name: 'Sentadilla Frontal', exerciseId: 'front-squat' },
      { kind: 'new', name: 'Sled Push' },
    ];

    for (const offer of offers) {
      expect(validateRoutineFile(addExercise(base, 0, draftExercise(offer)))).toEqual(baseline);
    }
  });
});

describe('offers through routineFileToDomain', () => {
  it('binds a persisted-user offer to the stored Exercise and creates nothing', () => {
    const stored = aUserExercise('Zercher Squat');
    const offer = offeredExercises(anEmptyDraft(), [stored]).find((o) => o.kind === 'user')!;

    const draft = toDomain(addExercise(anEmptyDraft(), 0, draftExercise(offer)), [stored]);

    expect(draft.createdExercises).toHaveLength(0);
    expect(draft.plannedExercises[0]!.exerciseId).toBe(stored.id);
  });

  it('mints exactly one Exercise when the same new name is added to two Workouts', () => {
    let file = addExercise(anEmptyDraft('Push', 'Pull'), 0, draftExercise({
      kind: 'new',
      name: 'Sled Push',
    }));

    const fromDraft = offeredExercises(file, []).find((offer) => offer.kind === 'draft')!;
    file = addExercise(file, 1, draftExercise(fromDraft));
    const draft = toDomain(file);

    expect(draft.createdExercises).toHaveLength(1);
    expect(draft.plannedExercises[0]!.exerciseId).toBe(draft.plannedExercises[1]!.exerciseId);
  });

  it('ignores a UUID in exercise_id and re-matches the row by name', () => {
    const stored = aUserExercise('Zercher Squat', '11111111-2222-3333-4444-555555555555');
    const file = aFile([
      aWorkout({ exercises: [anExercise({ name: 'Zercher Squat', exercise_id: stored.id })] }),
    ]);

    expect(named(offeredExercises(file, [stored]), 'Zercher Squat')).toHaveLength(1);
    const draft = toDomain(file, [stored]);
    expect(draft.createdExercises).toHaveLength(0);
    expect(draft.plannedExercises[0]!.exerciseId).toBe(stored.id);
  });

  it('does not split a movement whose draft row carries a slug under a foreign name', () => {
    let file = aFile([
      aWorkout({
        name: 'Push',
        exercises: [anExercise({ name: 'Sentadilla Frontal', exercise_id: 'front-squat' })],
      }),
      aWorkout({ name: 'Pull', exercises: [] }),
    ]);

    const offers = offeredExercises(file, []);
    // and the file's spelling is offered too — carrying the slug, so picking
    expect(offers.filter((offer) => offerName(offer) === 'Front Squat')).toHaveLength(1);
    expect(offers).toContainEqual({
      kind: 'draft',
      name: 'Sentadilla Frontal',
      exerciseId: 'front-squat',
    });

    const offer = offers.find((o) => o.kind === 'draft' && o.name === 'Sentadilla Frontal')!;
    file = addExercise(file, 1, draftExercise(offer));
    const draft = toDomain(file);

    expect(draft.createdExercises).toHaveLength(0);
    expect(draft.plannedExercises[0]!.exerciseId).toBe(draft.plannedExercises[1]!.exerciseId);
  });

  // The wizard SHOWS "Sentadilla Frontal" in Push, so a lifter adding the same
  // movement to Pull types exactly that. It must reuse the draft row's identity
  // rather than mint a second Exercise for a movement the draft already binds.
  it('reuses a draft row identity when its own spelling is typed back', () => {
    let file = aFile([
      aWorkout({
        name: 'Push',
        exercises: [anExercise({ name: 'Sentadilla Frontal', exercise_id: 'front-squat' })],
      }),
      aWorkout({ name: 'Pull', exercises: [] }),
    ]);

    const typed = resolveTypedName('  sentadilla   FRONTAL ', offeredExercises(file, []));
    expect(typed).toEqual({
      kind: 'draft',
      name: 'Sentadilla Frontal',
      exerciseId: 'front-squat',
    });

    file = addExercise(file, 1, draftExercise(typed));
    const draft = toDomain(file);

    expect(draft.createdExercises).toHaveLength(0);
    expect(draft.plannedExercises[0]!.exerciseId).toBe(draft.plannedExercises[1]!.exerciseId);
    expect(draft.plannedExercises[0]!.exerciseId).toBe('front-squat');
  });
});
