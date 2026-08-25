/**
 * The validator's job is to refuse (AC-4, AC-5).
 *
 * These tests are mostly rejections, and that is the point. Restore replaces
 * the only copy of a lifter's history, so a document that is wrong must not
 * reach the database at all — not partially, not with the bad rows dropped.
 * Every case below is a document that must never be written.
 *
 * Fixture rows are named rather than indexed so a test reads as the thing it
 * breaks: `{ ...SET, reps: '6' }`, not `document.completedSets[0]`.
 */

import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION } from '@/domain/backup/document';
import { formatPath, parseBackup } from '@/domain/backup/schema';

const ROUTINE = {
  id: 'r1',
  name: 'Base',
  weeks: 4,
  status: 'active',
  createdAt: 1_754_000_000_000,
};

const WORKOUT = {
  id: 'w1',
  routineId: 'r1',
  name: 'Lower',
  suggestedDays: ['monday'],
  order: 0,
};

const PLANNED = {
  id: 'pe1',
  workoutId: 'w1',
  // A catalog slug: it is never in the `exercises` table (DEC-007).
  exerciseId: 'front-squat',
  sets: 4,
  minReps: 5,
  maxReps: 6,
  minRir: 1,
  maxRir: 2,
  restSeconds: 180,
  unit: 'kg',
  focus: null,
  notes: [],
  order: 0,
  progression: { type: 'double_progression', increment: 2.5 },
};

const PLACEMENT = { id: 'p1', routineId: 'r1', workoutId: 'w1', date: '2026-08-17' };

/** A user-created Exercise: it *must* travel inside the document. */
const EXERCISE = { id: 'user-1', name: 'Reverse Hyper', category: null, equipment: null };

const SESSION = {
  id: 's1',
  routineId: 'r1',
  workoutId: 'w1',
  startedAt: 1_755_100_000_000,
  completedAt: 1_755_103_000_000,
  status: 'completed',
};

const PLANNED_ES = {
  id: 'es1',
  sessionId: 's1',
  exerciseId: 'front-squat',
  order: 0,
  status: 'performed',
  plannedExerciseId: 'pe1',
  plannedUnit: 'kg',
  plannedSets: 4,
  plannedMinReps: 5,
  plannedMaxReps: 6,
  plannedMinRir: 1,
  plannedMaxRir: 2,
  plannedRestSeconds: 180,
  plannedProgression: { type: 'double_progression', increment: 2.5 },
};

const UNPLANNED_ES = {
  id: 'es2',
  sessionId: 's1',
  exerciseId: 'user-1',
  order: 1,
  status: 'performed',
  plannedExerciseId: null,
};

const SET = {
  id: 'cs1',
  exerciseSessionId: 'es1',
  setNumber: 1,
  weight: 75,
  unit: 'kg',
  weightKg: 75,
  reps: 6,
  rir: 2,
  completedAt: 1_755_100_500_000,
};

/** A complete, internally consistent document: one routine, one logged set. */
function validDocument(): Record<string, unknown> {
  return {
    version: BACKUP_VERSION,
    exportedAt: 1_755_000_000_000,
    routines: [ROUTINE],
    workouts: [WORKOUT],
    plannedExercises: [PLANNED],
    placements: [PLACEMENT],
    exercises: [EXERCISE],
    sessions: [SESSION],
    exerciseSessions: [PLANNED_ES, UNPLANNED_ES],
    completedSets: [SET],
    settings: { id: 'settings', defaultUnit: 'kg' },
  };
}

/** The document with one top-level key replaced. */
function withKey(key: string, value: unknown): Record<string, unknown> {
  return { ...validDocument(), [key]: value };
}

/** The document with one top-level key removed. */
function without(key: string): Record<string, unknown> {
  const document = validDocument();
  delete document[key];
  return document;
}

/** Parses a document object as the file it would be on disk. */
function parse(document: unknown) {
  return parseBackup(JSON.stringify(document));
}

/** The document, accepted. Throws with the reasons if it was not. */
function accept(document: unknown) {
  const result = parse(document);
  if (!result.ok) throw new Error(`Expected acceptance: ${JSON.stringify(result.errors)}`);
  return result.document;
}

/** The formatted field paths of a refusal. Throws if the document was accepted. */
function refusedPaths(document: unknown): string[] {
  const result = parse(document);
  if (result.ok) throw new Error('Expected the document to be refused');
  return result.errors.map((error) => formatPath(error.path));
}

/** The messages of a refusal, joined. Throws if the document was accepted. */
function refusedBecause(document: unknown): string {
  const result = parse(document);
  if (result.ok) throw new Error('Expected the document to be refused');
  return result.errors.map((error) => error.message).join('\n');
}

describe('parseBackup', () => {
  it('accepts a complete document', () => {
    const document = accept(validDocument());
    expect(document.completedSets).toHaveLength(1);
    expect(document.exerciseSessions).toHaveLength(2);
    expect(document.settings.defaultUnit).toBe('kg');
  });

  // AC-4a — `validDocument` already carries the settings row as it was written
  // before the other four settings existed. Stated as its own test because it
  // is a compatibility promise, not an incidental property of the fixture: a
  // backup a lifter took months ago is the copy they will need.
  it('accepts a settings row carrying only the unit', () => {
    const document = accept(withKey('settings', { id: 'settings', defaultUnit: 'lb' }));
    expect(document.settings).toEqual({ id: 'settings', defaultUnit: 'lb' });
  });

  it('accepts a settings row carrying every setting', () => {
    const full = {
      id: 'settings',
      defaultUnit: 'kg',
      defaultRir: 2,
      timerVibration: false,
      timerSound: true,
      keepScreenAwake: false,
    };
    expect(accept(withKey('settings', full)).settings).toEqual(full);
  });

  it('refuses a setting of the wrong type rather than dropping it', () => {
    expect(refusedPaths(withKey('settings', { id: 'settings', defaultUnit: 'kg', timerSound: 'yes' }))).toEqual([
      'settings.timerSound',
    ]);
  });

  // Raw text, deliberately *not* through `parse`: `JSON.stringify('not a
  // backup')` is valid JSON, so routing this through the helper would exercise
  // the object schema and never reach the JSON failure it claims to test.
  it('rejects text that is not JSON', () => {
    const result = parseBackup('not a backup');
    if (result.ok) throw new Error('Expected the document to be refused');
    expect(result.errors.map((error) => formatPath(error.path))).toEqual(['']);
    expect(result.errors[0]?.message).toMatch(/JSON/i);
  });

  // `JSON.parse` accepts these and yields a value with no properties. Reading
  // `.version` off them must refuse, not throw — the file picker hands this
  // function whatever the lifter chose.
  it.each(['null', 'true', '42', '"a string"', '[]'])('refuses %s without throwing', (text) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a version that is not a number', () => {
    expect(refusedPaths(withKey('version', '1'))).toEqual(['version']);
  });

  it('rejects a date that is not a string', () => {
    expect(refusedPaths(withKey('placements', [{ ...PLACEMENT, date: 20260817 }]))).toEqual([
      'placements[0].date',
    ]);
  });

  // AC-4a, TST-116 (REQ-127, AC-143) — §18: a newer document is refused rather
  // than partially read. `z.object` strips unknown keys before any check runs,
  // so a build that read one anyway would drop the fields it does not know and
  // restore a lifter's planks as weight x reps. The gate is the only thing
  // standing between them and that.
  it('TST-116 — rejects a version newer than this build', () => {
    const newer = withKey('version', BACKUP_VERSION + 1);
    expect(refusedPaths(newer)).toEqual(['version']);
    expect(refusedBecause(newer)).toContain(String(BACKUP_VERSION + 1));
    expect(refusedBecause(newer)).toContain(`this app reads version ${BACKUP_VERSION}`);
    expect(refusedBecause(newer)).toContain('Update the app before restoring it.');
  });

  // TST-116 — the refusal is about the version, not about the fields a newer
  // document happens to carry: it fires before the shape is read at all.
  it('TST-116 — refuses a newer version before reading the rest of the document', () => {
    const newer = { ...withKey('version', BACKUP_VERSION + 5), routines: 'not a table' };
    expect(refusedPaths(newer)).toEqual(['version']);
  });

  it('accepts a version this build reads', () => {
    expect(accept(withKey('version', BACKUP_VERSION)).version).toBe(BACKUP_VERSION);
  });

  it('rejects a missing version', () => {
    expect(refusedPaths(without('version'))).toContain('version');
  });

  // AC-4b — a row whose values are the wrong type.
  it('rejects reps written as a string', () => {
    expect(refusedPaths(withKey('completedSets', [{ ...SET, reps: '6' }]))).toEqual([
      'completedSets[0].reps',
    ]);
  });

  it('rejects an unknown session status', () => {
    expect(refusedPaths(withKey('sessions', [{ ...SESSION, status: 'scheduled' }]))).toEqual([
      'sessions[0].status',
    ]);
  });

  it('rejects an unknown weekday', () => {
    expect(refusedPaths(withKey('workouts', [{ ...WORKOUT, suggestedDays: ['funday'] }]))).toEqual(
      ['workouts[0].suggestedDays[0]'],
    );
  });

  it('rejects a date that is not a calendar day', () => {
    expect(refusedPaths(withKey('placements', [{ ...PLACEMENT, date: '2026-02-31' }]))).toEqual([
      'placements[0].date',
    ]);
  });

  it('rejects an empty id', () => {
    expect(refusedPaths(withKey('routines', [{ ...ROUTINE, id: '' }]))).toContain('routines[0].id');
  });

  it('rejects double_progression without an increment', () => {
    const progression = { type: 'double_progression' };
    expect(refusedPaths(withKey('plannedExercises', [{ ...PLANNED, progression }]))).toHaveLength(1);
  });

  it('rejects an unknown progression type', () => {
    const progression = { type: 'rir_based' };
    expect(refusedPaths(withKey('plannedExercises', [{ ...PLANNED, progression }]))).toEqual([
      'plannedExercises[0].progression.type',
    ]);
  });

  // A refusal with an empty reason list is as unhelpful as a silent one, and a
  // union that matches no member is the case that produces it.
  it('always gives at least one reason when it refuses', () => {
    const refusals: unknown[] = [
      'not a backup',
      without('sessions'),
      withKey('plannedExercises', [{ ...PLANNED, progression: { type: 'rir_based' } }]),
      withKey('exerciseSessions', [{ ...PLANNED_ES, plannedExerciseId: null }]),
      withKey('completedSets', [{ ...SET, exerciseSessionId: 'missing' }]),
    ];
    for (const document of refusals) {
      expect(refusedPaths(document).length).toBeGreaterThan(0);
    }
  });

  // AC-4b — the union must not admit a shape the domain forbids.
  it('rejects an unplanned ExerciseSession carrying planned targets', () => {
    const contradiction = { ...PLANNED_ES, plannedExerciseId: null };
    expect(refusedBecause(withKey('exerciseSessions', [contradiction]))).toContain('plannedSets');
  });

  it('rejects a planned ExerciseSession missing a snapshotted target', () => {
    const incomplete: Record<string, unknown> = { ...PLANNED_ES };
    delete incomplete.plannedUnit;
    expect(refusedPaths(withKey('exerciseSessions', [incomplete, UNPLANNED_ES]))).not.toHaveLength(
      0,
    );
  });

  it('rejects a table that is not an array', () => {
    expect(refusedPaths(withKey('routines', ROUTINE))).toEqual(['routines']);
  });

  it('rejects a missing table', () => {
    expect(refusedPaths(without('sessions'))).toEqual(['sessions']);
  });

  it('rejects settings written as an array', () => {
    expect(refusedPaths(withKey('settings', [{ id: 'settings', defaultUnit: 'kg' }]))).toEqual([
      'settings',
    ]);
  });

  // Additive fields must not break an older reader — the routine file format
  // makes the same promise (`routine-file/schema.ts`).
  it('drops unknown keys inside a row', () => {
    const document = accept(withKey('routines', [{ ...ROUTINE, colour: 'blue' }]));
    expect(document.routines[0]).not.toHaveProperty('colour');
  });

  it('drops unknown keys inside an unplanned ExerciseSession', () => {
    // The loose object that catches the planned* contradiction must not also
    // start persisting every stray key.
    const document = accept(
      withKey('exerciseSessions', [PLANNED_ES, { ...UNPLANNED_ES, colour: 'blue' }]),
    );
    expect(document.exerciseSessions[1]).not.toHaveProperty('colour');
  });

  it('reports every structural failure at once, not just the first', () => {
    const broken = {
      ...validDocument(),
      sessions: [{ ...SESSION, status: 'scheduled' }],
      completedSets: [{ ...SET, reps: '6' }],
    };
    expect(refusedPaths(broken).length).toBeGreaterThan(1);
  });
});

/**
 * TST-128, REQ-139, AC-166 — exactly one target pair per planned exercise.
 *
 * The routine-file validator refuses this at import (`validate.test.ts`); this
 * is the second half, and it is the one that matters most. A row with neither
 * pair populated is what a file whose rep range met a duration Exercise
 * produces, and the failure it causes is the worst one this app has: a database
 * that exports a backup its own validator then refuses. `migrations.test.ts`
 * exists because that has happened here before.
 */
describe('parseBackup target pairs (TST-128)', () => {
  const bothPairs = { ...PLANNED, minTarget: 30, maxTarget: 45 };
  const neitherPair = { ...PLANNED, minReps: null, maxReps: null };

  it('refuses a planned exercise stating both a rep range and a target range (AC-166)', () => {
    const document = withKey('plannedExercises', [bothPairs]);
    expect(refusedBecause(document)).toContain('never both');
    expect(refusedPaths(document)).toContain('plannedExercises[0].minTarget');
  });

  it('refuses a planned exercise stating neither range (AC-166)', () => {
    const document = withKey('plannedExercises', [neitherPair]);
    expect(refusedBecause(document)).toContain('needs a range');
    expect(refusedPaths(document)).toContain('plannedExercises[0].minReps');
  });

  it('refuses a half-open pair, because a range needs both ends', () => {
    const document = withKey('plannedExercises', [{ ...PLANNED, maxReps: null }]);
    expect(refusedBecause(document)).toContain('needs a range');
  });

  it('applies the same rule to the ExerciseSession snapshot', () => {
    const both = withKey('exerciseSessions', [
      { ...PLANNED_ES, plannedMinTarget: 30, plannedMaxTarget: 45 },
      UNPLANNED_ES,
    ]);
    expect(refusedBecause(both)).toContain('never both');

    const neither = withKey('exerciseSessions', [
      { ...PLANNED_ES, plannedMinReps: null, plannedMaxReps: null },
      UNPLANNED_ES,
    ]);
    expect(refusedBecause(neither)).toContain('needs a range');
  });

  it('accepts a duration row stating its range in the target pair (AC-165)', () => {
    const document = accept(
      withKey('plannedExercises', [
        { ...PLANNED, exerciseId: 'plank', minReps: null, maxReps: null, minTarget: 45, maxTarget: 45 },
      ]),
    );
    expect(document.plannedExercises[0]?.minTarget).toBe(45);
    expect(document.plannedExercises[0]?.minReps).toBeNull();
  });
});

describe('parseBackup referential integrity', () => {
  // AC-4c — an orphan would vanish from history without a word.
  it('rejects a CompletedSet pointing at no ExerciseSession', () => {
    const orphan = withKey('completedSets', [{ ...SET, exerciseSessionId: 'missing' }]);
    expect(refusedPaths(orphan)).toEqual(['completedSets[0].exerciseSessionId']);
    expect(refusedBecause(orphan)).toContain('missing');
  });

  it('rejects an ExerciseSession pointing at no Session', () => {
    const orphan = withKey('exerciseSessions', [{ ...PLANNED_ES, sessionId: 'gone' }, UNPLANNED_ES]);
    expect(refusedPaths(orphan)).toEqual(['exerciseSessions[0].sessionId']);
  });

  it('rejects a Workout pointing at no Routine', () => {
    expect(refusedPaths(withKey('workouts', [{ ...WORKOUT, routineId: 'gone' }]))).toEqual([
      'workouts[0].routineId',
    ]);
  });

  it('rejects a PlannedExercise pointing at no Workout', () => {
    expect(refusedPaths(withKey('plannedExercises', [{ ...PLANNED, workoutId: 'gone' }]))).toEqual([
      'plannedExercises[0].workoutId',
    ]);
  });

  it('rejects a Placement pointing at no Workout', () => {
    expect(refusedPaths(withKey('placements', [{ ...PLACEMENT, workoutId: 'gone' }]))).toEqual([
      'placements[0].workoutId',
    ]);
  });

  it('rejects a Session pointing at no Routine', () => {
    expect(refusedPaths(withKey('sessions', [{ ...SESSION, routineId: 'gone' }]))).toEqual([
      'sessions[0].routineId',
    ]);
  });

  it('rejects a PlannedExerciseSession pointing at no PlannedExercise', () => {
    const orphan = withKey('exerciseSessions', [
      { ...PLANNED_ES, plannedExerciseId: 'gone' },
      UNPLANNED_ES,
    ]);
    expect(refusedPaths(orphan)).toEqual(['exerciseSessions[0].plannedExerciseId']);
  });

  // AC-5 — an exerciseId resolves to the catalog or to the document's own rows.
  it('accepts a catalog exerciseId absent from the exercises table', () => {
    // `front-squat` is a catalog slug and the document never lists it.
    expect(accept(validDocument()).exercises).toHaveLength(1);
  });

  it('rejects an exerciseId in neither the catalog nor the document', () => {
    const unknown = withKey('exerciseSessions', [
      PLANNED_ES,
      { ...UNPLANNED_ES, exerciseId: 'not-an-exercise' },
    ]);
    expect(refusedPaths(unknown)).toEqual(['exerciseSessions[1].exerciseId']);
    expect(refusedBecause(unknown)).toContain('not-an-exercise');
  });

  it('rejects a PlannedExercise naming an unknown exerciseId', () => {
    expect(refusedPaths(withKey('plannedExercises', [{ ...PLANNED, exerciseId: 'nope' }]))).toEqual(
      ['plannedExercises[0].exerciseId'],
    );
  });

  it('rejects a user-created exerciseId the document forgot to carry', () => {
    // Dropping `exercises` is exactly what a naive "export only history" would
    // do, and it would strand every unplanned set logged against it.
    expect(refusedPaths(withKey('exercises', []))).toEqual(['exerciseSessions[1].exerciseId']);
  });

  it('rejects duplicate ids within one table', () => {
    const twice = withKey('routines', [ROUTINE, ROUTINE]);
    expect(refusedPaths(twice)).toEqual(['routines[1].id']);
    expect(refusedBecause(twice)).toContain('r1');
  });

  it('reports duplicates alone, before resolving any reference', () => {
    // With two rows sharing an id, every lookup against that table is
    // ambiguous — so the reference pass is not run at all and the dangling
    // `workoutId` below stays unreported until the duplicate is fixed.
    const both = {
      ...validDocument(),
      routines: [ROUTINE, ROUTINE],
      workouts: [{ ...WORKOUT, workoutId: 'gone', routineId: 'gone' }],
    };
    expect(refusedPaths(both)).toEqual(['routines[1].id']);
  });

  // The unplanned member of the union still has to validate its own fields.
  it('rejects an unplanned ExerciseSession whose own fields are malformed', () => {
    const malformed = withKey('exerciseSessions', [
      PLANNED_ES,
      { ...UNPLANNED_ES, order: 'first' },
    ]);
    expect(refusedPaths(malformed).length).toBeGreaterThan(0);
  });

  it('rejects an unplanned ExerciseSession missing a required field', () => {
    const incomplete: Record<string, unknown> = { ...UNPLANNED_ES };
    delete incomplete.sessionId;
    expect(refusedPaths(withKey('exerciseSessions', [PLANNED_ES, incomplete])).length)
      .toBeGreaterThan(0);
  });

  it('does not run referential checks when the shape already failed', () => {
    // A malformed row cannot be meaningfully asked about its references, and
    // reporting both would bury the real fault under a consequence of it.
    const both = withKey('completedSets', [
      { ...SET, reps: '6', exerciseSessionId: 'missing' },
    ]);
    expect(refusedPaths(both)).toEqual(['completedSets[0].reps']);
  });
});

/** The document with the first row of one table replaced by a patched copy. */
function withRow(table: string, patch: Record<string, unknown>): Record<string, unknown> {
  const document = validDocument();
  const rows = document[table] as Record<string, unknown>[];
  return { ...document, [table]: [{ ...rows[0], ...patch }, ...rows.slice(1)] };
}

describe('parseBackup numeric bounds', () => {
  // Every numeric field carried a type and no range, so a hand-edited document
  // could restore a set of -40 reps and turn it into a negative estimated 1RM on
  // the Progress screen. The bound is what the app can write, never what the
  // routine-file validator demands — see the no-upper-bound cases below.
  it.each([
    ['completedSets', 'setNumber', 0],
    ['completedSets', 'weight', -0.5],
    ['completedSets', 'weightKg', -0.5],
    ['completedSets', 'reps', -1],
    ['completedSets', 'rir', -1],
    ['completedSets', 'completedAt', -1],
    ['sessions', 'startedAt', -1],
    ['routines', 'weeks', -1],
    ['routines', 'createdAt', -1],
    ['workouts', 'order', -1],
    ['plannedExercises', 'order', -1],
    ['plannedExercises', 'sets', -1],
    ['plannedExercises', 'minReps', -1],
    ['plannedExercises', 'maxReps', -1],
    ['plannedExercises', 'minRir', -1],
    ['plannedExercises', 'maxRir', -1],
    ['plannedExercises', 'restSeconds', -1],
    ['exerciseSessions', 'order', -1],
    ['exerciseSessions', 'plannedSets', -1],
    ['exerciseSessions', 'plannedMinReps', -1],
    ['exerciseSessions', 'plannedRestSeconds', -1],
  ])('refuses %s.%s below its bound, and says which field', (table, field, value) => {
    const paths = refusedPaths(withRow(table, { [field]: value }));
    expect(paths.join(' ')).toContain(field);
  });

  it('refuses a negative progression increment, which would walk the bar down forever', () => {
    const paths = refusedPaths(
      withRow('plannedExercises', { progression: { type: 'double_progression', increment: -2.5 } }),
    );
    expect(paths.join(' ')).toContain('increment');
  });

  it('refuses a negative exportedAt', () => {
    expect(refusedPaths(withKey('exportedAt', -1)).join(' ')).toContain('exportedAt');
  });

  it('refuses a negative defaultRir', () => {
    const paths = refusedPaths(withKey('settings', { id: 'settings', defaultUnit: 'kg', defaultRir: -1 }));
    expect(paths.join(' ')).toContain('defaultRir');
  });

  // Zero is a real logged value, not an absent one: a bodyweight set is 0 kg,
  // and a set taken to failure with nothing left is 0 reps in the bank.
  it('accepts a set of 0 kg, 0 reps and 0 RIR', () => {
    accept(withRow('completedSets', { weight: 0, weightKg: 0, reps: 0, rir: 0 }));
  });

  it('accepts setNumber 1, the first position there is', () => {
    accept(withRow('completedSets', { setNumber: 1 }));
  });

  it('accepts order 0, because order is 0-based', () => {
    accept(withRow('workouts', { order: 0 }));
  });

  // No upper bound anywhere. `Field` clamps at zero and caps nothing, so RIR 12
  // is a real thing a lifter can log; MAX_RIR governs a *planned* RIR in a
  // routine file, and borrowing it here would refuse a genuine backup.
  it('accepts a logged RIR above MAX_RIR, which the set logger permits', () => {
    accept(withRow('completedSets', { rir: 12 }));
  });

  it('accepts an extreme rep count rather than judging it', () => {
    accept(withRow('completedSets', { reps: 500 }));
  });

  it('accepts a planned RIR above MAX_RIR, which an older document may carry', () => {
    accept(withRow('plannedExercises', { minRir: 0, maxRir: 50 }));
  });
});


// ------------------------------------------------------ measurement, v1 and v2

/**
 * TST-115 (REQ-127, AC-141) — a document written before measurements existed.
 *
 * Written out in full rather than derived from `validDocument()`, because the
 * property under test is an *absence*: not one of the fields this change added
 * appears anywhere below. A helper that patched them out could drift; a literal
 * cannot. This is the file a lifter exported months ago, and the only copy of
 * their training they have.
 */
function versionOneDocument(): Record<string, unknown> {
  return {
    version: 1,
    exportedAt: 1_755_000_000_000,
    routines: [
      { id: 'r1', name: 'Base', weeks: 4, status: 'active', createdAt: 1_754_000_000_000 },
    ],
    workouts: [{ id: 'w1', routineId: 'r1', name: 'Lower', suggestedDays: ['monday'], order: 0 }],
    plannedExercises: [
      {
        id: 'pe1',
        workoutId: 'w1',
        exerciseId: 'front-squat',
        sets: 4,
        minReps: 5,
        maxReps: 6,
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
    exercises: [{ id: 'user-1', name: 'Reverse Hyper', category: null, equipment: null }],
    sessions: [
      {
        id: 's1',
        routineId: 'r1',
        workoutId: 'w1',
        startedAt: 1_755_100_000_000,
        completedAt: 1_755_103_000_000,
        status: 'completed',
      },
    ],
    exerciseSessions: [
      {
        id: 'es1',
        sessionId: 's1',
        exerciseId: 'front-squat',
        order: 0,
        status: 'performed',
        plannedExerciseId: 'pe1',
        plannedUnit: 'kg',
        plannedSets: 4,
        plannedMinReps: 5,
        plannedMaxReps: 6,
        plannedMinRir: 1,
        plannedMaxRir: 2,
        plannedRestSeconds: 180,
        plannedProgression: { type: 'double_progression', increment: 2.5 },
      },
      {
        id: 'es2',
        sessionId: 's1',
        exerciseId: 'user-1',
        order: 1,
        status: 'performed',
        plannedExerciseId: null,
      },
    ],
    completedSets: [
      {
        id: 'cs1',
        exerciseSessionId: 'es1',
        setNumber: 1,
        weight: 75,
        unit: 'kg',
        weightKg: 75,
        reps: 6,
        rir: 2,
        completedAt: 1_755_100_500_000,
      },
    ],
    settings: { id: 'settings', defaultUnit: 'kg' },
  };
}

describe('TST-115 (REQ-127, AC-141) — a version-1 document still restores', () => {
  it('carries not one of the fields this change added', () => {
    // The premise of the fixture, asserted rather than assumed.
    const added = [
      'measurement',
      'bodyweightKg',
      'minTarget',
      'maxTarget',
      'plannedMinTarget',
      'plannedMaxTarget',
      'durationSeconds',
      'distance',
      'distanceUnit',
      'distanceM',
    ];
    const text = JSON.stringify(versionOneDocument());
    for (const field of added) expect(text).not.toContain(field);
  });

  it('is accepted rather than refused for what it lacks', () => {
    const document = accept(versionOneDocument());
    expect(document.version).toBe(1);
    expect(document.completedSets).toHaveLength(1);
  });

  // REQ-125 — the only measurement provable from a document written before
  // measurements existed is weight x reps. Nothing else is invented.
  it('reads every Exercise and ExerciseSession as weight x reps', () => {
    const document = accept(versionOneDocument());
    expect(document.exercises[0]?.measurement).toBe('weight_reps');
    expect(document.exerciseSessions[0]?.measurement).toBe('weight_reps');
    expect(document.exerciseSessions[1]?.measurement).toBe('weight_reps');
  });

  // REQ-126 — no backfill invents a bodyweight nobody recorded.
  it('reads a Session as having no recorded bodyweight', () => {
    expect(accept(versionOneDocument()).sessions[0]?.bodyweightKg).toBeNull();
  });

  it('reads the non-rep target pair as absent, on the template and the snapshot', () => {
    const document = accept(versionOneDocument());
    expect(document.plannedExercises[0]?.minTarget).toBeNull();
    expect(document.plannedExercises[0]?.maxTarget).toBeNull();

    const planned = document.exerciseSessions[0];
    if (planned === undefined || planned.plannedExerciseId === null) {
      throw new Error('Expected the first ExerciseSession to be a planned one');
    }
    expect(planned.plannedMinTarget).toBeNull();
    expect(planned.plannedMaxTarget).toBeNull();
    // The rep range it *does* carry is untouched.
    expect(planned.plannedMinReps).toBe(5);
    expect(planned.plannedMaxReps).toBe(6);
  });

  it('reads the four conditional set fields as absent', () => {
    const set = accept(versionOneDocument()).completedSets[0];
    expect(set?.durationSeconds).toBeNull();
    expect(set?.distance).toBeNull();
    expect(set?.distanceUnit).toBeNull();
    expect(set?.distanceM).toBeNull();
    // And the fields it always had are unchanged.
    expect(set?.reps).toBe(6);
    expect(set?.weightKg).toBe(75);
  });
});

describe('TST-117 (REQ-128, AC-144) — an unreadable measurement is refused', () => {
  // Closed exactly as `progression` is closed: a type the app cannot read would
  // become history it cannot show, so it is refused rather than kept as data.
  it('refuses an unknown measurement on an Exercise, and names the field', () => {
    const yoga = withKey('exercises', [{ ...EXERCISE, measurement: 'yoga' }]);
    expect(refusedPaths(yoga)).toEqual(['exercises[0].measurement']);
    // The path names where, and the message names what would have been legal.
    // Zod does not echo the offending value back, and R-4 does not need it to:
    // the path already points at the exact cell to look at.
    expect(refusedBecause(yoga)).toContain('weight_reps');
  });

  it('refuses an unknown measurement on a planned ExerciseSession', () => {
    const yoga = withKey('exerciseSessions', [
      { ...PLANNED_ES, measurement: 'yoga' },
      UNPLANNED_ES,
    ]);
    expect(refusedPaths(yoga).join(' ')).toContain('exerciseSessions[0].measurement');
  });

  it('refuses an unknown measurement on an unplanned ExerciseSession', () => {
    const yoga = withKey('exerciseSessions', [
      PLANNED_ES,
      { ...UNPLANNED_ES, measurement: 'yoga' },
    ]);
    expect(refusedPaths(yoga).join(' ')).toContain('exerciseSessions[1].measurement');
  });

  it('refuses an unknown distanceUnit, and names the field', () => {
    const furlongs = withKey('completedSets', [{ ...SET, distanceUnit: 'furlongs' }]);
    expect(refusedPaths(furlongs)).toEqual(['completedSets[0].distanceUnit']);
    expect(refusedBecause(furlongs)).toContain('km');
  });

  it.each(['weight_reps', 'duration', 'distance_duration', 'distance'])(
    'accepts the known measurement %s',
    (measurement) => {
      const document = accept(withKey('exercises', [{ ...EXERCISE, measurement }]));
      expect(document.exercises[0]?.measurement).toBe(measurement);
    },
  );

  it.each(['m', 'km', 'mi'])('accepts the known distanceUnit %s', (distanceUnit) => {
    const set = { ...SET, distance: 400, distanceUnit, distanceM: 400 };
    expect(accept(withKey('completedSets', [set])).completedSets[0]?.distanceUnit).toBe(
      distanceUnit,
    );
  });
});

/** A version-2 document: every field this change added, populated. */
function versionTwoDocument(): Record<string, unknown> {
  return {
    ...validDocument(),
    version: 2,
    plannedExercises: [
      { ...PLANNED, minReps: null, maxReps: null, minTarget: 400, maxTarget: 800 },
    ],
    exercises: [{ ...EXERCISE, measurement: 'distance_duration' }],
    sessions: [{ ...SESSION, bodyweightKg: 81.4 }],
    exerciseSessions: [
      {
        ...PLANNED_ES,
        measurement: 'distance_duration',
        plannedMinReps: null,
        plannedMaxReps: null,
        plannedMinTarget: 400,
        plannedMaxTarget: 800,
      },
      { ...UNPLANNED_ES, measurement: 'duration' },
    ],
    completedSets: [
      {
        ...SET,
        reps: null,
        durationSeconds: 96.5,
        distance: 0.4,
        distanceUnit: 'km',
        distanceM: 400,
      },
    ],
  };
}

describe('AC-142 — a version-2 document re-imports into this build', () => {
  it('accepts one, with every added field intact', () => {
    const document = accept(versionTwoDocument());

    expect(document.version).toBe(2);
    expect(document.exercises[0]?.measurement).toBe('distance_duration');
    expect(document.sessions[0]?.bodyweightKg).toBe(81.4);
    expect(document.plannedExercises[0]?.minTarget).toBe(400);
    expect(document.plannedExercises[0]?.maxTarget).toBe(800);
    expect(document.exerciseSessions[0]?.measurement).toBe('distance_duration');
    expect(document.exerciseSessions[1]?.measurement).toBe('duration');
    expect(document.completedSets[0]).toMatchObject({
      reps: null,
      durationSeconds: 96.5,
      distance: 0.4,
      distanceUnit: 'km',
      distanceM: 400,
    });
  });

  it('survives a second pass through the parser unchanged', () => {
    // The round trip the format exists for: what came out of the parser, sent
    // back through a real string, must come out the same.
    const once = accept(versionTwoDocument());
    const twice = accept(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('keeps the non-rep range of a planned snapshot through the round trip', () => {
    const planned = accept(versionTwoDocument()).exerciseSessions[0];
    if (planned === undefined || planned.plannedExerciseId === null) {
      throw new Error('Expected the first ExerciseSession to be a planned one');
    }
    expect(planned.plannedMinTarget).toBe(400);
    expect(planned.plannedMaxTarget).toBe(800);
    expect(planned.plannedMinReps).toBeNull();
  });
});
