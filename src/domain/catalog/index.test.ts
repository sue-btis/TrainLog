/** TST-023 — the shipped catalog (REQ-020, REQ-023, AC-020, AC-024). */

import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  findCatalogExerciseByNormalizedName,
  getCatalogExercise,
  normalizeExerciseName,
} from '@/domain/catalog';
import { toId } from '@/domain/ids';
import type { ExerciseId } from '@/domain/ids';

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

describe('findCatalogExerciseByNormalizedName', () => {
  it('resolves "  front   squat " to front-squat (AC-024)', () => {
    expect(findCatalogExerciseByNormalizedName('  front   squat ')?.id).toBe('front-squat');
  });

  it('resolves every catalog entry by its own name', () => {
    for (const entry of CATALOG) {
      expect(findCatalogExerciseByNormalizedName(entry.name)?.id).toBe(entry.id);
    }
  });

  it('returns undefined for an unknown name', () => {
    expect(findCatalogExerciseByNormalizedName('cable moon walk')).toBeUndefined();
  });
});
