
import { CATALOG, findExerciseByName, normalizeExerciseName } from '@/domain/catalog';
import type { Exercise } from '@/domain/types';
import type { RoutineFile, RoutineFileExercise } from '@/domain/routine-file/schema';

export type Offer =
  | { readonly kind: 'catalog'; readonly exercise: Exercise }
  | { readonly kind: 'user'; readonly exercise: Exercise }
  | { readonly kind: 'draft'; readonly name: string; readonly exerciseId?: string }
  | { readonly kind: 'new'; readonly name: string };

export function offerName(offer: Offer): string {
  return offer.kind === 'catalog' || offer.kind === 'user' ? offer.exercise.name : offer.name;
}

export function offeredExercises(
  file: RoutineFile,
  userExercises: readonly Exercise[],
): readonly Offer[] {
  const offers: Offer[] = [];

  for (const entry of CATALOG) {
    offers.push({ kind: 'catalog', exercise: entry });
  }

  for (const exercise of userExercises) {
    if (findExerciseByName(exercise.name, userExercises)?.id !== exercise.id) continue;
    offers.push({ kind: 'user', exercise });
  }

  const spellings = new Set<string>();
  for (const workout of file.routine.workouts) {
    for (const row of workout.exercises) {
      // The one matcher decides whether this spelling is already covered.
      if (findExerciseByName(row.name, userExercises) !== undefined) continue;

      // A nameless row is not offerable. The file schema puts no minimum on
      // `name`, so a row can carry one, and a blank entry in the picker is a
      // control a lifter cannot read and `resolveTypedName` cannot reach.
      const spelling = normalizeExerciseName(row.name);
      if (spelling === '' || spellings.has(spelling)) continue;
      spellings.add(spelling);

      offers.push(
        row.exercise_id === undefined
          ? { kind: 'draft', name: row.name }
          : { kind: 'draft', name: row.name, exerciseId: row.exercise_id },
      );
    }
  }

  return offers;
}

export function resolveTypedName(name: string, offers: readonly Offer[]): Offer {
  const needle = normalizeExerciseName(name);
  const match =
    needle === ''
      ? undefined
      : offers.find((offer) => normalizeExerciseName(offerName(offer)) === needle);

  return match ?? { kind: 'new', name: name.trim() };
}

/**
 * The seeded row, shared by all four kinds so the shape cannot drift between
 * them. `exercise_id` is a conditional spread rather than
 * `exercise_id: exerciseId`: an explicit `undefined` is a *present* key, and it
 * would survive into the draft the wizard shows as `exercise_id:` with nothing
 * after it.
 */
function seed(name: string, exerciseId?: string): RoutineFileExercise {
  const row: RoutineFileExercise = {
    name,
    sets: 3,
    reps: { min: 8, max: 12 },
    notes: [],
    progression: { type: 'manual' },
  };

  return exerciseId === undefined ? row : { ...row, exercise_id: exerciseId };
}

export function draftExercise(offer: Offer): RoutineFileExercise {
  switch (offer.kind) {
    case 'catalog':
      return seed(offer.exercise.name, offer.exercise.id);
    case 'user':
      return seed(offer.exercise.name);
    case 'draft':
      return seed(offer.name, offer.exerciseId);
    case 'new':
      return seed(offer.name);
  }
}
