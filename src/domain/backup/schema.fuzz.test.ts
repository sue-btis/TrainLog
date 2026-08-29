
import { describe, expect, it } from 'vitest';
import { parseBackup } from '@/domain/backup/schema';
import { BACKUP_VERSION } from '@/domain/backup/document';

/** mulberry32 — a small deterministic PRNG, so every failure is reproducible. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Values chosen to be awkward rather than merely random. */
const HOSTILE: readonly unknown[] = [
  null,
  undefined,
  true,
  false,
  0,
  -1,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER,
  1e308,
  '',
  ' ',
  '0',
  'null',
  '[]',
  '__proto__',
  'constructor',
  [],
  {},
  [[[[[]]]]],
  { toString: null },
  { __proto__: { polluted: true } },
  '\u0000',
  '𝕏'.repeat(50),
  // A near-miss is the input that finds a `startsWith` where an `===` belonged.
  'weight_reps',
  'WEIGHT_REPS',
  'weight_reps ',
  'yoga',
  'duration_',
  'km',
  'KM',
  'furlong',
  ['weight_reps'],
  { measurement: 'weight_reps' },
];

function validDocument(): Record<string, unknown> {
  return {
    version: BACKUP_VERSION,
    exportedAt: 1_755_000_000_000,
    routines: [{ id: 'r1', name: 'Base', weeks: 4, status: 'active', createdAt: 1 }],
    workouts: [{ id: 'w1', routineId: 'r1', name: 'Lower', suggestedDays: ['monday'], order: 0 }],
    // fields this change added. An empty table cannot be corrupted *inside*,
    // so with the old fixture the row-level branch of `corrupt` only ever
    // reached routines and workouts, and the new fields were never fuzzed at
    // all.
    plannedExercises: [
      {
        id: 'pe1',
        workoutId: 'w1',
        exerciseId: 'front-squat',
        sets: 4,
        minReps: null,
        maxReps: null,
        minTarget: 400,
        maxTarget: 800,
        minRir: 1,
        maxRir: 2,
        restSeconds: 180,
        unit: 'kg',
        focus: null,
        notes: [],
        order: 0,
        progression: { type: 'double_progression', increment: 2.5 },
      },
    ],
    placements: [{ id: 'p1', routineId: 'r1', workoutId: 'w1', date: '2026-08-17' }],
    exercises: [
      {
        id: 'user-1',
        name: 'Sled Push',
        category: null,
        equipment: null,
        measurement: 'weight_distance',
      },
    ],
    sessions: [
      {
        id: 's1',
        routineId: 'r1',
        workoutId: 'w1',
        startedAt: 2,
        completedAt: 3,
        status: 'completed',
        bodyweightKg: 81.4,
      },
    ],
    exerciseSessions: [
      {
        id: 'es1',
        sessionId: 's1',
        exerciseId: 'front-squat',
        order: 0,
        status: 'performed',
        measurement: 'distance_duration',
        plannedExerciseId: 'pe1',
        plannedUnit: 'kg',
        plannedSets: 4,
        plannedMinReps: null,
        plannedMaxReps: null,
        plannedMinTarget: 400,
        plannedMaxTarget: 800,
        plannedMinRir: 1,
        plannedMaxRir: 2,
        plannedRestSeconds: 180,
        plannedProgression: { type: 'double_progression', increment: 2.5 },
      },
    ],
    completedSets: [
      {
        id: 'cs1',
        exerciseSessionId: 'es1',
        setNumber: 1,
        weight: 0,
        unit: 'kg',
        weightKg: 0,
        reps: null,
        rir: 2,
        durationSeconds: 96.5,
        distance: 0.4,
        distanceUnit: 'km',
        distanceM: 400,
        completedAt: 4,
      },
    ],
    // and the field passes below both reach it.
    settings: { id: 'settings', defaultUnit: 'kg', bodyweightKg: 81.4 },
  };
}

const KEYS = Object.keys(validDocument());

/** Walks the document and corrupts it in `depth` random places. */
function corrupt(random: () => number, depth: number): unknown {
  const document = validDocument();
  for (let step = 0; step < depth; step += 1) {
    const key = KEYS[Math.floor(random() * KEYS.length)] ?? 'version';
    const choice = random();
    if (choice < 0.3) {
      delete document[key];
    } else if (choice < 0.7) {
      document[key] = HOSTILE[Math.floor(random() * HOSTILE.length)];
    } else {
      // Corrupt a field *inside* a row rather than the table itself.
      const table = document[key];
      if (Array.isArray(table) && table.length > 0) {
        const row = { ...(table[0] as Record<string, unknown>) };
        const rowKeys = Object.keys(row);
        const rowKey = rowKeys[Math.floor(random() * rowKeys.length)];
        if (rowKey !== undefined) {
          row[rowKey] = HOSTILE[Math.floor(random() * HOSTILE.length)];
        }
        document[key] = [row];
      }
    }
  }
  return document;
}

function withField(
  document: Record<string, unknown>,
  table: string,
  field: string,
  value: unknown,
): void {
  const rows = document[table];
  if (Array.isArray(rows)) {
    document[table] = [{ ...(rows[0] as Record<string, unknown>), [field]: value }];
  } else {
    document[table] = { ...(rows as Record<string, unknown>), [field]: value };
  }
}

/** The same, removing the field instead of replacing it. */
function withoutField(document: Record<string, unknown>, table: string, field: string): void {
  const rows = document[table];
  const row = Array.isArray(rows)
    ? { ...(rows[0] as Record<string, unknown>) }
    : { ...(rows as Record<string, unknown>) };
  delete row[field];
  document[table] = Array.isArray(rows) ? [row] : row;
}

/** Runs `parseBackup` and reports how it behaved, never letting it throw out. */
function probe(text: string): { threw: unknown; emptyRefusal: boolean } {
  try {
    const result = parseBackup(text);
    return {
      threw: null,
      emptyRefusal: !result.ok && result.errors.length === 0,
    };
  } catch (error) {
    return { threw: error, emptyRefusal: false };
  }
}

describe('parseBackup under hostile input', () => {
  it('never throws on a corrupted document, and never refuses silently', () => {
    const random = prng(0xc0ffee);
    for (let round = 0; round < 2000; round += 1) {
      const document = corrupt(random, 1 + Math.floor(random() * 4));
      let text: string;
      try {
        text = JSON.stringify(document) ?? 'undefined';
      } catch {
        continue; // not representable as a file; not this function's problem
      }
      const { threw, emptyRefusal } = probe(text);
      expect(threw, `round ${round} threw on: ${text.slice(0, 300)}`).toBeNull();
      expect(emptyRefusal, `round ${round} refused with no reason: ${text.slice(0, 300)}`).toBe(
        false,
      );
    }
  });

  it('never throws on arbitrary text', () => {
    const random = prng(0x5eed);
    const alphabet = '{}[]",:0123456789abcnulltruefas \\/\n\u0000é𝕏';
    for (let round = 0; round < 2000; round += 1) {
      const length = Math.floor(random() * 60);
      let text = '';
      for (let index = 0; index < length; index += 1) {
        text += alphabet[Math.floor(random() * alphabet.length)];
      }
      const { threw, emptyRefusal } = probe(text);
      expect(threw, `round ${round} threw on: ${JSON.stringify(text)}`).toBeNull();
      expect(emptyRefusal, `round ${round} refused with no reason: ${JSON.stringify(text)}`).toBe(
        false,
      );
    }
  });

  it('never throws on the JSON values that carry no properties', () => {
    for (const text of ['null', 'true', 'false', '0', '""', '[]', '{}', '-0', '1e999']) {
      const { threw, emptyRefusal } = probe(text);
      expect(threw, `threw on ${text}`).toBeNull();
      expect(emptyRefusal, `refused ${text} with no reason`).toBe(false);
    }
  });

  it('never throws on a hostile value in any field this change added', () => {
    const fields: readonly (readonly [string, string])[] = [
      ['exercises', 'measurement'],
      ['exerciseSessions', 'measurement'],
      ['sessions', 'bodyweightKg'],
      ['plannedExercises', 'minTarget'],
      ['plannedExercises', 'maxTarget'],
      ['exerciseSessions', 'plannedMinTarget'],
      ['exerciseSessions', 'plannedMaxTarget'],
      ['completedSets', 'reps'],
      ['completedSets', 'durationSeconds'],
      ['completedSets', 'distance'],
      ['completedSets', 'distanceUnit'],
      ['completedSets', 'distanceM'],
      ['settings', 'bodyweightKg'],
    ];

    for (const [table, field] of fields) {
      for (const value of HOSTILE) {
        const document = validDocument();
        withField(document, table, field, value);

        const text = JSON.stringify(document) ?? 'undefined';
        const { threw, emptyRefusal } = probe(text);
        // Not `String(value)`: one of the hostile values has a null
        // `toString`, and a test helper that throws while formatting a
        // failure message is a worse bug than the one it was reporting.
        const where = `${table}.${field} = ${text.slice(0, 200)}`;
        expect(threw, `threw on ${where}`).toBeNull();
        expect(emptyRefusal, `refused ${where} with no reason`).toBe(false);
      }
    }
  });

  it('never throws when an added field is simply absent', () => {
    const fields: readonly (readonly [string, string])[] = [
      ['exercises', 'measurement'],
      ['exerciseSessions', 'measurement'],
      ['exerciseSessions', 'plannedMinTarget'],
      ['sessions', 'bodyweightKg'],
      ['plannedExercises', 'minTarget'],
      ['completedSets', 'durationSeconds'],
      ['completedSets', 'distance'],
      ['completedSets', 'distanceUnit'],
      ['completedSets', 'distanceM'],
      ['settings', 'bodyweightKg'],
    ];

    for (const [table, field] of fields) {
      const document = validDocument();
      withoutField(document, table, field);

      const { threw, emptyRefusal } = probe(JSON.stringify(document) ?? 'undefined');
      expect(threw, `threw without ${table}.${field}`).toBeNull();
      expect(emptyRefusal, `refused a missing ${table}.${field} with no reason`).toBe(false);
    }
  });

  it('does not let a document pollute Object.prototype', () => {
    // `__proto__` in JSON is inert, but the validator spreads and rebuilds rows,
    // so this pins that no path reintroduces it.
    parseBackup(JSON.stringify({ ...validDocument(), __proto__: { polluted: true } }));
    parseBackup('{"__proto__":{"polluted":true},"version":1}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
