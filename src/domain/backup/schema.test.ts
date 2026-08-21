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

  // AC-4a — §18: a newer document is refused rather than partially read.
  it('rejects a version newer than this build', () => {
    const newer = withKey('version', BACKUP_VERSION + 1);
    expect(refusedPaths(newer)).toEqual(['version']);
    expect(refusedBecause(newer)).toContain(String(BACKUP_VERSION + 1));
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
