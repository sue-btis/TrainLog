/**
 * What the wizard's add-exercise picker may offer, and what picking one writes
 * (REQ-301, REQ-303, REQ-305, REQ-306, REQ-900, REQ-911).
 *
 * Three sources, one list: the bundled catalog, the lifter's persisted
 * Exercises, and every exercise already written anywhere in the draft. The
 * third is what makes a movement named in Push pickable in Pull before
 * anything is stored (REQ-302).
 *
 * The whole module exists to keep one promise: **the offer the picker shows is
 * the Exercise `resolveFileExercise` will resolve to.** Two deciders would
 * eventually disagree, and a disagreement here does not throw — it silently
 * mints a second Exercise for a movement the file already names, splitting a
 * lifter's history inside a single Routine (§26, REQ-902).
 *
 * Pure, like everything in `domain/`. The persisted Exercises are passed in.
 */

import { CATALOG, findExerciseByName, normalizeExerciseName } from '@/domain/catalog';
import type { Exercise } from '@/domain/types';
import type { RoutineFile, RoutineFileExercise } from '@/domain/routine-file/schema';

/**
 * One pickable movement, as spec §6 freezes it.
 *
 * A discriminated union rather than one shape with optional fields, and for the
 * same reason `ExerciseSession` is one (§14.7): it makes the identity rule of
 * REQ-303 *structural*. A `user` offer has nowhere to put an id, so a persisted
 * Exercise's UUID cannot be written into `exercise_id` — a shape the domain
 * forbids simply cannot be constructed. Reading an id forces the caller to
 * establish which kind of offer they are holding.
 *
 * What each kind writes, which is REQ-303 exactly:
 *
 *   catalog   name (the catalog's canonical spelling) + exercise_id
 *   user      name alone
 *   draft     the source row's name + its exercise_id when it carries one
 *   new       name alone
 *
 * `new` is the only kind with no source: it is a name the lifter typed that
 * none of the three knows (REQ-305), and `resolveTypedName` manufactures it.
 */
export type Offer =
  | { readonly kind: 'catalog'; readonly exercise: Exercise }
  | { readonly kind: 'user'; readonly exercise: Exercise }
  | { readonly kind: 'draft'; readonly name: string; readonly exerciseId?: string }
  | { readonly kind: 'new'; readonly name: string };

/**
 * The label an offer carries, and the `name` a pick writes.
 *
 * Two of the four kinds hold a whole `Exercise` and two hold a bare string, so
 * every caller that wants the name needs this narrowing. Exported rather than
 * left private because the picker needs it to render and to filter, and a
 * second copy of the narrowing in the feature layer is exactly the kind of
 * duplicate that drifts. It adds nothing to the frozen surface of §6: it is a
 * reader over the union, not a new decision.
 */
export function offerName(offer: Offer): string {
  return offer.kind === 'catalog' || offer.kind === 'user' ? offer.exercise.name : offer.name;
}

/**
 * Every movement the picker may offer, in catalog-resolution order (REQ-301).
 *
 * A row whose **name** already resolves to an offered Exercise is dropped, and
 * `findExerciseByName` is what decides that — never a set of names assembled
 * here (REQ-902). So `  front   SQUAT ` is recognized as the catalog's Front
 * Squat and is offered once, as that entry, which is REQ-301's purpose.
 *
 * But a spelling the draft carries is **always** offerable, even when its
 * identity is already in the list, and that is REQ-911 read together with
 * REQ-306. A file may legitimately declare `exercise_id: front-squat` under
 * `name: Sentadilla Frontal` — `CONVERSION_PROMPT` documents that shape and
 * tells assistants to keep the source spelling. The wizard then *shows* that
 * spelling in the Workout it came from, so a lifter adding the movement
 * elsewhere reaches for it by that name. Drop it here and `resolveTypedName`,
 * which sees only this list (§6), has nothing to match: the typed name becomes
 * a `new` offer and mints a second Exercise for a movement the draft already
 * binds. That is the split REQ-911 exists to prevent, reached by the typed-name
 * path rather than the pick path.
 *
 * Identity travels with the spelling instead. A draft offer copies the source
 * row's `exercise_id` (REQ-303), so it resolves to exactly what that row
 * resolves to — not because a lookup here agreed, but because it carries the
 * same two identity fields. Two spellings of one movement may therefore both
 * appear; both bind to the same Exercise, which is the property that matters.
 *
 * The order is `resolveFileExercise`'s own: catalog, then the lifter's
 * Exercises, then what exists only in the draft. A picker that sorted by
 * anything else would still be correct, but the list would stop mirroring the
 * rule that decides what a pick binds to.
 *
 * A persisted Exercise whose normalized name equals a catalog entry's is
 * skipped, because it is unreachable: `findExerciseByName` resolves past it to
 * the catalog (REQ-910). Only `restoreBackup` can produce such a row, this
 * change does not close that gap, and offering a row no pick can bind to would
 * be the worst of the three options.
 */
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

/**
 * The offer a typed name means (REQ-306, REQ-305).
 *
 * Total, as §6 freezes it: it returns an `Offer` and never `undefined`. A name
 * that matches nothing is not a failure to report, it is the `new` offer — the
 * lifter naming a movement none of the three sources knows, which REQ-305 says
 * must be possible without leaving the wizard. Making the caller handle an
 * absent result would put that decision in the picker, where a second copy of
 * it would eventually disagree with this one.
 *
 * Matching is `normalizeExerciseName` and nothing else, so `  front   SQUAT `
 * finds Front Squat — the same comparison §26 makes, because a name that
 * resolves to an existing Exercise at Accept must resolve to it here too.
 *
 * A duplicate is the *correct* outcome on this path and is reused rather than
 * refused, which is the deliberate asymmetry with the create screen (REQ-101,
 * DEC-Q7): there a lifter is cataloguing a movement and a collision is a
 * mistake, here they are naming one to program and reuse is what keeps their
 * history in one piece.
 *
 * A blank name matches nothing — it normalizes to the empty string, and without
 * the guard it would bind to the first offer that happens to carry a blank
 * name. It still yields a `new` offer; refusing a blank name is the *picker's*
 * call, and REQ-106's refusal is scoped to the create screen.
 */
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

/**
 * The draft row a pick writes (REQ-900, REQ-303).
 *
 * The seeded shape is pinned: three sets of eight to twelve, manual
 * progression, and every optional field *absent* rather than defaulted. Absent
 * is load-bearing for `unit` — `routineFileToDomain` maps a missing unit onto
 * the Settings default, so the row inherits the lifter's preference without the
 * domain ever reading Settings (§32).
 *
 * Seeding deliberately invalid values to force the lifter to complete the row
 * was rejected: it would block Accept for the entire draft the moment an
 * exercise is added, possibly from a Workout tab nobody is looking at, and
 * `validateRoutineFile`'s message would then assert something false about a row
 * the lifter never wrote (REQ-307).
 *
 * It takes an `Offer` and not a name because only the offer knows the row's
 * identity. A name-only verb would have to invent the rest, and inventing it is
 * precisely how a catalog pick loses its slug and is re-matched as a stranger.
 * The switch is exhaustive over the union, so a fifth kind would fail to
 * compile here rather than silently fall through to "name alone".
 */
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
