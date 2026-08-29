
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  CATALOG_CATEGORIES,
  CATALOG_EQUIPMENT,
  findExerciseByName,
  getCatalogExercise,
  UNCATEGORIZED,
  groupExercises,
  normalizeExerciseName,
} from '@/domain/catalog';
import { toId } from '@/domain/ids';
import type { ExerciseId } from '@/domain/ids';
import type { Exercise } from '@/domain/types';
import { MEASUREMENTS } from '@/domain/measurement';
import { parseRoutineFile } from '@/domain/routine-file/schema';

describe('catalog', () => {
  it('has 250–400 entries (REQ-020)', () => {
    // The bound guards against a catalog that grows into a search problem, not
    // against a specific number, and the Workout Guide import moved where that
    // problem starts: 107 rows became 299. What keeps it navigable is the
    // catalog screen's search and equipment filter, not the row count — a
    // lifter looks a movement up, they do not scroll to it. Past ~400 that
    // stops being true and the screen needs more than a filter.
    expect(CATALOG.length).toBeGreaterThanOrEqual(250);
    expect(CATALOG.length).toBeLessThanOrEqual(400);
  });

  it('every id is a kebab-case slug (REQ-023)', () => {
    const bad = CATALOG.filter((e) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id));
    expect(bad.map((e) => e.id)).toEqual([]);
  });

  it('every id is unique (REQ-023)', () => {
    const ids = CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a non-empty name, category and equipment (REQ-020)', () => {
    for (const entry of CATALOG) {
      expect(entry.name.trim()).not.toBe('');
      expect(entry.category?.trim()).toBeTruthy();
      expect(entry.equipment?.trim()).toBeTruthy();
    }
  });

  it('every normalized name is unique, so name lookup is unambiguous', () => {
    const names = CATALOG.map((e) => normalizeExerciseName(e.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(['front-squat', 'weighted-pull-up', 'romanian-deadlift'])(
    'contains the §11.12 id %s (AC-020)',
    (id) => {
      expect(getCatalogExercise(toId<ExerciseId>(id))?.id).toBe(id);
    },
  );

  it('returns undefined for an unknown id', () => {
    expect(getCatalogExercise(toId<ExerciseId>('no-such-lift'))).toBeUndefined();
  });
});

describe('normalizeExerciseName', () => {
  it.each([
    ['  front   squat ', 'front squat'],
    ['Front Squat', 'front squat'],
    ['ROMANIAN\tDEADLIFT', 'romanian deadlift'],
  ])('normalizes %j to %j (§26)', (input, expected) => {
    expect(normalizeExerciseName(input)).toBe(expected);
  });
});

describe('CATALOG_CATEGORIES and CATALOG_EQUIPMENT', () => {
  const dirty: Exercise = {
    id: toId<ExerciseId>('cable-moon-walk'),
    name: 'Cable Moon Walk',
    category: 'lunar',
    equipment: 'moon-rope',
    measurement: 'weight_reps',
  };

  it('offers nothing that is not in the catalog', () => {
    for (const category of CATALOG_CATEGORIES) {
      expect(CATALOG.some((entry) => entry.category === category)).toBe(true);
    }
    for (const equipment of CATALOG_EQUIPMENT) {
      expect(CATALOG.some((entry) => entry.equipment === equipment)).toBe(true);
    }
  });

  it('offers every category and equipment the catalog does use, sorted and deduped', () => {
    const distinct = (values: readonly (string | null)[]) =>
      [...new Set(values.filter((value): value is string => value !== null))].sort();

    expect(CATALOG_CATEGORIES).toEqual(distinct(CATALOG.map((entry) => entry.category)));
    expect(CATALOG_EQUIPMENT).toEqual(distinct(CATALOG.map((entry) => entry.equipment)));
  });

  it('stays closed when a stored Exercise carries a word the catalog never used', () => {
    // `groupExercises` accepts the dirty row and groups it — this module does
    // see such values elsewhere, which is what makes the exclusion below a
    // property rather than an accident of the fixture.
    const groups = groupExercises([...CATALOG, dirty], '', null);
    expect(groups.some((group) => group.category === dirty.category)).toBe(true);

    expect(CATALOG_CATEGORIES).not.toContain(dirty.category);
    expect(CATALOG_EQUIPMENT).not.toContain(dirty.equipment);
  });
});

describe('groupExercises', () => {
  const own = (name: string, category: string | null, equipment: string | null): Exercise => ({
    id: toId<ExerciseId>(normalizeExerciseName(name).replace(/ /g, '-')),
    name,
    category,
    equipment,
    measurement: 'weight_reps',
  });

  it('groups the whole catalog by category, alphabetically', () => {
    const groups = groupExercises(CATALOG, '', null);
    expect(groups.map((group) => group.category)).toEqual([
      'back', 'biceps', 'calves', 'chest', 'core', 'forearms',
      'full-body', 'glutes', 'hamstrings', 'quadriceps', 'shoulders', 'triceps',
    ]);
    expect(groups.reduce((total, group) => total + group.exercises.length, 0)).toBe(CATALOG.length);
  });

  it('orders the exercises inside a group by name', () => {
    const [first] = groupExercises(CATALOG, '', null);
    const names = first!.exercises.map((exercise) => exercise.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('puts an uncategorized exercise in a trailing group, never dropping it', () => {
    const groups = groupExercises([...CATALOG, own('Sled Push', null, null)], '', null);
    const last = groups.at(-1)!;
    expect(last.category).toBe(UNCATEGORIZED);
    expect(last.exercises.map((exercise) => exercise.name)).toEqual(['Sled Push']);
  });

  it('keeps the uncategorized group last when it comes first in the input', () => {
    // The order the screen actually builds: a lifter's own exercises are
    // prepended to the catalog, so the uncategorized one arrives first. The
    // earlier case appends it, where 'uncategorized' already sorts after
    // 'triceps' on its own and the rule is never exercised.
    const groups = groupExercises([own('Sled Push', null, null), ...CATALOG], '', null);
    expect(groups.at(-1)!.category).toBe(UNCATEGORIZED);
    expect(groups[0]!.category).toBe('back');
  });

  it('keeps it last even behind a category that sorts after it', () => {
    // A routine file names its own categories, so one past 'u' is not
    // hypothetical. Alphabetical order alone puts 'uncategorized' after the
    // twelve the catalog ships; only a category like 'wrists' shows that the
    // group is last by rule rather than by luck.
    const groups = groupExercises(
      [own('Sled Push', null, null), own('Wrist Roller', 'wrists', null)],
      '',
      null,
    );
    expect(groups.map((group) => group.category)).toEqual(['wrists', UNCATEGORIZED]);

    // Both ways round: which of the two guards fires depends on the order the
    // groups were built in, so one input order only ever exercises one of them.
    const reversed = groupExercises(
      [own('Wrist Roller', 'wrists', null), own('Sled Push', null, null)],
      '',
      null,
    );
    expect(reversed.map((group) => group.category)).toEqual(['wrists', UNCATEGORIZED]);
  });

  it('names the uncategorized group in words a heading can carry', () => {
    expect(UNCATEGORIZED).toBe('uncategorized');
  });

  it('treats an empty-string category as uncategorized, never as a nameless group', () => {
    // `category: ""` survives the routine-file schema: it is
    // `z.string().optional()` with no minimum, and nothing validates it. Left
    // alone it would open a group whose heading renders as nothing at all.
    const groups = groupExercises([own('Sled Push', '', null)], '', null);
    expect(groups.map((group) => group.category)).toEqual([UNCATEGORIZED]);
  });

  it('searches by normalized name (§26) and drops the groups it empties', () => {
    const groups = groupExercises(CATALOG, '  front   SQUAT ', null);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.exercises.map((exercise) => exercise.id)).toEqual(['front-squat']);
  });

  it('filters to one equipment value, excluding entries that name none', () => {
    const withNone = [...CATALOG, own('Sled Push', 'full-body', null)];
    const barbell = groupExercises(withNone, '', 'barbell');
    const shown = barbell.flatMap((group) => group.exercises);
    expect(shown).toHaveLength(42);
    expect(shown.every((exercise) => exercise.equipment === 'barbell')).toBe(true);

    const unfiltered = groupExercises(withNone, '', null).flatMap((group) => group.exercises);
    expect(unfiltered.map((exercise) => exercise.name)).toContain('Sled Push');
  });

  it('composes search and equipment, neither resetting the other', () => {
    const shown = groupExercises(CATALOG, 'squat', 'barbell').flatMap((group) => group.exercises);
    expect(shown.length).toBeGreaterThan(0);
    expect(
      shown.every(
        (exercise) =>
          exercise.equipment === 'barbell' && normalizeExerciseName(exercise.name).includes('squat'),
      ),
    ).toBe(true);
    expect(shown.length).toBeLessThan(
      groupExercises(CATALOG, 'squat', null).flatMap((group) => group.exercises).length,
    );
  });

  it('returns no groups at all when nothing matches', () => {
    expect(groupExercises(CATALOG, 'cable moon walk', null)).toEqual([]);
  });
});

describe('findExerciseByName', () => {
  const mine: Exercise = {
    id: toId<ExerciseId>('11111111-2222-3333-4444-555555555555'),
    name: 'Zercher Good Morning',
    category: null,
    equipment: null,
    measurement: 'weight_reps',
  };

  it('finds a catalog entry by normalized name (AC-024)', () => {
    expect(findExerciseByName('  front   SQUAT ', [])?.id).toBe('front-squat');
  });

  // reachable through the one matcher that survived, not just the sample above.
  it('resolves every catalog entry by its own name', () => {
    for (const entry of CATALOG) {
      expect(findExerciseByName(entry.name, [])?.id).toBe(entry.id);
    }
  });

  it('finds a user Exercise by normalized name', () => {
    expect(findExerciseByName('zercher good morning', [mine])?.id).toBe(mine.id);
  });

  it('prefers the catalog over a user Exercise sharing a name', () => {
    const shadow: Exercise = { ...mine, name: 'Front Squat' };
    expect(findExerciseByName('front squat', [shadow])?.id).toBe('front-squat');
  });

  it('returns undefined when neither knows the name', () => {
    expect(findExerciseByName('Cable Moon Walk', [mine])).toBeUndefined();
  });

  it('resolves the way resolveFileExercise resolves, so the two cannot drift', () => {
    // The property that matters: whatever the create screen binds a name to is
    // the Exercise an import of that same name would bind to.
    for (const name of ['Front Squat', 'front squat', 'Zercher Good Morning']) {
      expect(findExerciseByName(name, [mine])).toBeDefined();
    }
  });

  it('treats two Unicode spellings of one name as two movements (accepted §26 gap)', () => {
    // Precomposed vs combining-mark. normalizeExerciseName lowercases, trims and
    // collapses whitespace — it does not fold Unicode composition. Closing this
    // would change which Exercise every stored name resolves to, so it is left
    // of a change that decides that.
    const precomposed: Exercise = { ...mine, name: 'Curl Bíceps' };
    expect(findExerciseByName('Curl Bi\u0301ceps', [precomposed])).toBeUndefined();
  });
});

const ORIGINAL_SLUGS = [
  'back-squat', 'front-squat', 'box-squat', 'pause-squat', 'overhead-squat', 'goblet-squat',
  'hack-squat', 'leg-press', 'leg-extension', 'barbell-lunge', 'walking-lunge',
  'bulgarian-split-squat', 'step-up', 'conventional-deadlift', 'sumo-deadlift',
  'romanian-deadlift', 'stiff-leg-deadlift', 'deficit-deadlift', 'rack-pull', 'good-morning',
  'lying-leg-curl', 'seated-leg-curl', 'nordic-curl', 'glute-ham-raise', 'hip-thrust',
  'cable-pull-through', 'hip-abduction', 'kettlebell-swing', 'standing-calf-raise',
  'seated-calf-raise', 'bench-press', 'incline-bench-press', 'close-grip-bench-press',
  'dumbbell-bench-press', 'incline-dumbbell-press', 'dumbbell-fly', 'cable-fly',
  'machine-chest-press', 'pec-deck', 'push-up', 'dip', 'weighted-dip', 'pull-up',
  'weighted-pull-up', 'chin-up', 'inverted-row', 'lat-pulldown', 'straight-arm-pulldown',
  'seated-cable-row', 'barbell-row', 'pendlay-row', 't-bar-row', 'dumbbell-row',
  'chest-supported-row', 'machine-row', 'barbell-shrug', 'dumbbell-shrug', 'back-extension',
  'overhead-press', 'push-press', 'seated-dumbbell-press', 'arnold-press',
  'machine-shoulder-press', 'lateral-raise', 'cable-lateral-raise', 'rear-delt-fly',
  'reverse-pec-deck', 'upright-row', 'face-pull', 'band-pull-apart', 'barbell-curl',
  'ez-bar-curl', 'dumbbell-curl', 'incline-dumbbell-curl', 'hammer-curl', 'preacher-curl',
  'cable-curl', 'triceps-pushdown', 'overhead-triceps-extension', 'skull-crusher',
  'triceps-kickback', 'reverse-curl', 'wrist-curl', 'farmers-walk', 'plank',
  'hanging-leg-raise', 'ab-wheel-rollout', 'russian-twist', 'cable-crunch', 'pallof-press',
  'power-clean', 'hang-clean', 'clean-and-jerk', 'snatch', 'thruster', 'turkish-get-up',
] as const;

describe('catalog measurement', () => {
  const frozen: readonly string[] = ORIGINAL_SLUGS;
  const added = CATALOG.filter((entry) => !frozen.includes(entry.id));

  it('lists exactly 96 original slugs, each of them distinct', () => {
    // Guards the fixture itself: a truncated list would weaken every case below.
    expect(ORIGINAL_SLUGS).toHaveLength(96);
    expect(new Set(frozen).size).toBe(96);
  });

  it('still ships every one of the 96 original slugs (AC-134)', () => {
    const missing = frozen.filter((slug) => getCatalogExercise(toId<ExerciseId>(slug)) === undefined);
    expect(missing).toEqual([]);
  });

  it('declares a measurement on every row (AC-133)', () => {
    const undeclared = CATALOG.filter((entry) => !MEASUREMENTS.includes(entry.measurement));
    expect(undeclared.map((entry) => entry.id)).toEqual([]);
  });

  /** Every loaded twin: the two that always shipped, and the seven added since. */
  const WEIGHTED_TWINS = [
    'weighted-dip', 'weighted-pull-up', 'weighted-chin-up', 'weighted-push-up',
    'weighted-inverted-row', 'weighted-back-extension', 'weighted-glute-ham-raise',
    'weighted-hanging-leg-raise', 'weighted-russian-twist',
  ] as const;

  it.each(WEIGHTED_TWINS)('types %s as weighted_bodyweight (REQ-123, AC-134)', (slug) => {
    expect(getCatalogExercise(toId<ExerciseId>(slug))?.measurement).toBe('weighted_bodyweight');
  });

  // The naming rule is the whole navigation story: a lifter who has outgrown a
  // movement finds its loaded version by prefixing the name they already know.
  // A twin whose unloaded half is missing would be a row nobody arrives at.
  it.each(WEIGHTED_TWINS)('%s is the loaded twin of a bodyweight_reps row', (slug) => {
    const unloaded = getCatalogExercise(toId<ExerciseId>(slug.replace(/^weighted-/, '')));
    expect(unloaded, `${slug} names no unloaded twin`).toBeDefined();
    expect(unloaded?.measurement).toBe('bodyweight_reps');
  });

  it('adds new slugs only, renaming and removing none (AC-135)', () => {
    // Both directions: nothing added collides with a frozen slug, and the two
    // sets together account for every row — so no original slug was quietly
    // respelled into the added half.
    for (const entry of added) {
      expect(frozen).not.toContain(entry.id);
    }
    expect(CATALOG.length).toBe(frozen.length + added.length);
  });

  it('adds no cardio row (AC-169)', () => {
    // `distance_duration` is the cardio type. The change owner's programme
    // contains no running, cycling, rowing or swimming, and such a movement
    // names no muscle group, which would dirty the `category` vocabulary that
    expect(CATALOG.filter((entry) => entry.measurement === 'distance_duration')).toEqual([]);

    // The list of *permitted* measurements is gone, not relaxed. Earlier
    // changes added a handful of rows each and could name what they added; the
    // Workout Guide import adds 192 across five measurement types, so an
    // allow-list would just be `MEASUREMENTS` minus one member, restated. The
    // exclusion above is the rule that survives, and it is asserted over the
    // whole catalog rather than over the added half.
    expect(added.length).toBeGreaterThan(0);
  });

  it('leaves the two vocabularies exactly as they were (REQ-140, AC-170)', () => {
    expect(CATALOG_CATEGORIES).toEqual([
      'back', 'biceps', 'calves', 'chest', 'core', 'forearms',
      'full-body', 'glutes', 'hamstrings', 'quadriceps', 'shoulders', 'triceps',
    ]);
    expect(CATALOG_EQUIPMENT).toEqual([
      'band', 'barbell', 'bodyweight', 'cable', 'dumbbell', 'kettlebell', 'machine',
    ]);
  });

  it('does not duplicate the plank that was already a duration row', () => {
    expect(
      CATALOG.filter((entry) => entry.measurement === 'duration' && entry.name === 'Plank'),
    ).toHaveLength(1);
  });
});

describe('the movements bloque-a-acumulacion.yaml programmes', () => {
  const parsed = parseRoutineFile(
    readFileSync(new URL('../../../docs/bloque-a-acumulacion.yaml', import.meta.url), 'utf8'),
  );
  if (!parsed.ok) throw new Error('docs/bloque-a-acumulacion.yaml no longer parses');
  const programmed = parsed.file.routine.workouts.flatMap((workout) => workout.exercises);

  const resolve = (exercise: { readonly name: string; readonly exercise_id?: string }) =>
    exercise.exercise_id !== undefined
      ? getCatalogExercise(toId<ExerciseId>(exercise.exercise_id))
      : findExerciseByName(exercise.name, []);

  const programmedAs = (name: string) => {
    const exercise = programmed.find((candidate) => candidate.name === name);
    expect(exercise, `${name} is no longer programmed by the file`).toBeDefined();
    return resolve(exercise!);
  };

  it.each(['Planche Lean', 'Handstand Hold', 'Tuck Planche Hold'])(
    'resolves the isometric hold %s to a duration row',
    (name) => {
      expect(programmedAs(name)?.measurement).toBe('duration');
    },
  );

  // Counted in jumps, not measured in metres: a set is three of them, and what
  it('resolves Broad Jump to a bodyweight_reps row', () => {
    expect(programmedAs('Broad Jump')?.measurement).toBe('bodyweight_reps');
  });

  it('still resolves every movement the file names by exercise_id', () => {
    // The added rows must not have disturbed the ids the file already binds to.
    for (const exercise of programmed) {
      if (exercise.exercise_id === undefined) continue;
      expect(getCatalogExercise(toId<ExerciseId>(exercise.exercise_id))?.id).toBe(
        exercise.exercise_id,
      );
    }
  });
});
