/** TST-023 — the shipped catalog (REQ-020, REQ-023, AC-020, AC-024). */

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

describe('catalog', () => {
  it('has 60–100 entries (REQ-020)', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(60);
    expect(CATALOG.length).toBeLessThanOrEqual(100);
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

/**
 * TST-105 (REQ-105) — the clause the rest of the suite never asserted: the
 * offered vocabularies come from `CATALOG` alone.
 *
 * The failure it guards is a rewrite to `[...user, ...CATALOG]`, which reads
 * like an improvement and is not: a routine file may write anything into
 * `category`, so one dirty import would teach the create form a word the
 * catalog never used, and PRD §39 item 8 groups muscle volume over exactly
 * these values.
 */
describe('CATALOG_CATEGORIES and CATALOG_EQUIPMENT', () => {
  const dirty: Exercise = {
    id: toId<ExerciseId>('cable-moon-walk'),
    name: 'Cable Moon Walk',
    category: 'lunar',
    equipment: 'moon-rope',
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
    expect(shown).toHaveLength(34);
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

/** TST-100, TST-108 — the shared §26 matcher (REQ-102, REQ-109). */
describe('findExerciseByName', () => {
  const mine: Exercise = {
    id: toId<ExerciseId>('11111111-2222-3333-4444-555555555555'),
    name: 'Zercher Good Morning',
    category: null,
    equipment: null,
  };

  it('finds a catalog entry by normalized name (AC-024)', () => {
    expect(findExerciseByName('  front   SQUAT ', [])?.id).toBe('front-squat');
  });

  // Moved here when the second §26 decider was deleted: the whole catalog is
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
    // open deliberately and pinned here (REQ-109). Delete this test only as part
    // of a change that decides that.
    const precomposed: Exercise = { ...mine, name: 'Curl Bíceps' };
    expect(findExerciseByName('Curl Bi\u0301ceps', [precomposed])).toBeUndefined();
  });
});
