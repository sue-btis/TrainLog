/**
 * TST-129 (REQ-138, AC-162, AC-163) — a non-rep programme survives the whole
 * pipeline: file → domain → snapshot → backup → restore.
 *
 * Every other test in the tree checks one seam of that chain. This one checks
 * that the seams agree, and it is the only place that does. A plank programmed
 * as `3 × 45s` and a run as `1 × 5 km` pass through five different
 * representations — YAML, `PlannedExercise`, `PlannedExerciseSession`,
 * `CompletedSet`, and the §17 document — and a target lost in any one of them
 * does not throw: it produces a session screen stating no target, or a restored
 * database in which a lifter's plank is programmed against nothing. Both are
 * silent, and both are only visible from end to end.
 *
 * The two movements are deliberately named something the catalog does not
 * carry, so the import mints the Exercise and the file's declared measurement
 * is the one that lands (REQ-131).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import { importRoutine } from '@/db/repositories/import';
import { getExerciseMeasurements, listUserExercises } from '@/db/repositories/exercises';
import { listPlannedExercisesByWorkout } from '@/db/repositories/plannedExercises';
import { createStartedWorkout } from '@/db/repositories/sessions';
import { saveLoggedSet } from '@/db/repositories/completedSets';
import { exportBackup, restoreBackup } from '@/db/repositories/backup';
import { parseBackup } from '@/domain/backup';
import { logSet, startWorkout } from '@/domain/session';
import { parseRoutineFile, routineFileToDomain, validateRoutineFile } from '@/domain/routine-file';
import { generatePlacements } from '@/domain/scheduling';
import { toLocalDate } from '@/domain/dates';
import type { Measurement, PlannedExerciseSession } from '@/domain/types';
import type { ExerciseId } from '@/domain/ids';

const ANCHOR = toLocalDate('2026-09-07'); // a Monday
const CREATED_AT = 1_757_200_000_000;
const STARTED_AT = 1_757_286_400_000;

/**
 * A version-2 file stating both targets in the axis's canonical unit: seconds
 * for the plank, metres for the run (REQ-138). Neither exercise declares
 * `reps`, because neither type has any.
 */
const YAML = `
version: 2
routine:
  name: Engine Block
  weeks: 1
  workouts:
    - name: Conditioning
      suggested_days: [monday]
      exercises:
        - name: Long Plank Hold
          measurement: duration
          sets: 3
          target: { min: 45, max: 45 }
          rest_seconds: 60
          progression: { type: manual }
        - name: Easy Zone Two Run
          measurement: distance_duration
          sets: 1
          target: { min: 5000, max: 5000 }
          progression: { type: manual }
`;

/** Parses, validates and imports the file; returns what reached the database. */
async function importTheProgramme(): Promise<void> {
  const parsed = parseRoutineFile(YAML);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  expect(validateRoutineFile(parsed.file)).toEqual([]);

  const draft = routineFileToDomain(parsed.file, {
    defaultUnit: 'kg',
    existingExercises: await listUserExercises(),
    createdAt: CREATED_AT,
  });
  const placements = generatePlacements({
    workouts: draft.workouts,
    weeks: draft.routine.weeks,
    anchorDate: ANCHOR,
  });

  await importRoutine(draft, placements);
}

/**
 * Starts the imported Workout exactly as the app does: the templates come from
 * the database, and `measurementOf` is resolved from the Exercises the import
 * minted (REQ-105).
 */
async function startTheWorkout(): Promise<readonly PlannedExerciseSession[]> {
  const workout = await db.workouts.toCollection().first();
  if (!workout) throw new Error('the import must have written a workout');

  const planned = await listPlannedExercisesByWorkout(workout.id);
  const measurements = await getExerciseMeasurements(planned.map((it) => it.exerciseId));
  const measurementOf = (id: ExerciseId): Measurement =>
    measurements.get(id) ?? 'weight_reps';

  const started = startWorkout({
    routineId: workout.routineId,
    workoutId: workout.id,
    planned,
    measurementOf,
    startedAt: STARTED_AT,
  });
  await createStartedWorkout(started);

  return started.exerciseSessions;
}

beforeEach(resetDatabase);

describe('TST-129 a non-rep programme, file to backup and back', () => {
  // AC-162, AC-163, AC-165
  it('stores 3 × 45s and 1 × 5 km in minTarget/maxTarget with the rep pair null', async () => {
    await importTheProgramme();

    const planned = (await db.plannedExercises.toArray()).sort((a, b) => a.order - b.order);
    expect(planned).toHaveLength(2);

    const [plank, run] = planned;
    expect(plank).toMatchObject({ sets: 3, minTarget: 45, maxTarget: 45 });
    expect(plank?.minReps).toBeNull();
    expect(plank?.maxReps).toBeNull();
    expect(run).toMatchObject({ sets: 1, minTarget: 5000, maxTarget: 5000 });
    expect(run?.minReps).toBeNull();
    expect(run?.maxReps).toBeNull();

    // The Exercises the import minted carry the type the file declared, which
    // is what decides which pair above was populated (REQ-131, REQ-139).
    const minted = await listUserExercises();
    expect(
      Object.fromEntries(minted.map((it) => [it.name, it.measurement])),
    ).toEqual({
      'Long Plank Hold': 'duration',
      'Easy Zone Two Run': 'distance_duration',
    });
  });

  // AC-162, AC-163 — the snapshot (ADR 0002) is where the session screen reads
  // its target from, so a target that stops here never reaches the lifter.
  it('snapshots both targets and both measurements onto the ExerciseSessions', async () => {
    await importTheProgramme();
    await startTheWorkout();

    const stored = await db.exerciseSessions.toArray();
    const byOrder = [...stored].sort((a, b) => a.order - b.order);
    expect(byOrder).toHaveLength(2);

    expect(byOrder[0]).toMatchObject({
      measurement: 'duration',
      plannedSets: 3,
      plannedMinTarget: 45,
      plannedMaxTarget: 45,
      plannedMinReps: null,
      plannedMaxReps: null,
      plannedRestSeconds: 60,
    });
    expect(byOrder[1]).toMatchObject({
      measurement: 'distance_duration',
      plannedSets: 1,
      plannedMinTarget: 5000,
      plannedMaxTarget: 5000,
      plannedMinReps: null,
      plannedMaxReps: null,
    });
  });

  // REQ-138 — the whole chain, ending where a lifter's only copy lives.
  it('exports both targets, both measurements and both logged sets, and parseBackup accepts', async () => {
    await importTheProgramme();
    const exerciseSessions = await startTheWorkout();

    const [plankSession, runSession] = exerciseSessions;
    if (!plankSession || !runSession) throw new Error('both exercises must have started');

    // A 45-second plank: no reps at all, the work is the duration (REQ-106).
    await saveLoggedSet(
      logSet({
        exerciseSession: plankSession,
        setNumber: 1,
        weight: 0,
        unit: 'kg',
        reps: null,
        rir: 1,
        durationSeconds: 45,
        completedAt: STARTED_AT + 60_000,
      }),
    );
    // A 5 km run entered in kilometres; the metres are derived (REQ-107).
    await saveLoggedSet(
      logSet({
        exerciseSession: runSession,
        setNumber: 1,
        weight: 0,
        unit: 'kg',
        reps: null,
        rir: 0,
        durationSeconds: 1_500,
        distance: 5,
        distanceUnit: 'km',
        completedAt: STARTED_AT + 1_800_000,
      }),
    );

    const document = await exportBackup(STARTED_AT + 2_000_000);

    const sets = [...document.completedSets].sort((a, b) =>
      a.completedAt - b.completedAt,
    );
    expect(sets[0]).toMatchObject({
      reps: null,
      durationSeconds: 45,
      distance: null,
      distanceUnit: null,
      distanceM: null,
    });
    expect(sets[1]).toMatchObject({
      reps: null,
      durationSeconds: 1_500,
      distance: 5,
      distanceUnit: 'km',
      distanceM: 5000,
    });

    // The document goes out as a file and comes back as one: JSON in, JSON
    // out, through the validator restore puts every document through.
    const result = parseBackup(JSON.stringify(document));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));

    expect(result.document.plannedExercises).toEqual(document.plannedExercises);
    expect(result.document.exerciseSessions).toEqual(document.exerciseSessions);
    expect(result.document.completedSets).toEqual(document.completedSets);
    expect(result.document.exercises).toEqual(document.exercises);

    // …and back into the database it came from, which is the end of the chain:
    // what a lifter recovers is what they programmed.
    await restoreBackup(result.document);
    const reExported = await exportBackup(STARTED_AT + 3_000_000);
    expect(reExported.plannedExercises).toEqual(document.plannedExercises);
    expect(reExported.exerciseSessions).toEqual(document.exerciseSessions);
    expect(reExported.completedSets).toEqual(document.completedSets);
    expect(reExported.exercises).toEqual(document.exercises);
  });
});
