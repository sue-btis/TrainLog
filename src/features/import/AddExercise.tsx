/**
 * Putting an exercise into a Workout while the draft is still being shaped
 * (REQ-300, REQ-305, REQ-306, REQ-308, REQ-309).
 *
 * New code, deliberately. The live-session picker in
 * `features/session/ExercisePicker.tsx` answers a different question — which
 * movement am I about to perform, out of what already exists — and it refuses
 * to create. This one must create, and creating is the whole reason the wizard
 * could not add exercises before (§11.1). Sharing a component between the two
 * would mean one of them growing a mode flag, and the flag would decide whether
 * a lifter can mint an Exercise (DEC-Q4, REQ-311).
 *
 * It renders **in flow**, where the add control was, and never as an overlay
 * (REQ-308). The action bar at the bottom of the wizard is fixed, and a sheet
 * or a popover over it would cover the one control that says what still stands
 * between the lifter and Accept. The list is bounded and scrolls inside itself
 * so a hundred catalog entries cannot push that bar off the reasoning either.
 *
 * The three sources arrive already merged and ordered as one list: this
 * component does not decide what may be offered, it draws what
 * `offeredExercises` returns. That separation is what keeps the picker from
 * becoming a second answer to "does this movement already exist?" (§26).
 */

import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { normalizeExerciseName } from '@/domain/catalog';
import { offerName, resolveTypedName, type Offer } from '@/domain/routine-file';
import { Button } from '@/components/ui/button';
import { TextField } from '@/features/import/fields';
import { ICON_STROKE, LABEL, WELL } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

interface AddExerciseProps {
  readonly offers: readonly Offer[];
  /** The Workout this control belongs to, for the labels and the field id. */
  readonly workoutIndex: number;
  readonly workoutName: string;
  readonly onAdd: (offer: Offer) => void;
}

export function AddExercise({ offers, workoutIndex, workoutName, onAdd }: AddExerciseProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const needle = normalizeExerciseName(query);

  // Substring over the normalized name, the same comparison §26 matches by, so
  // `  front   SQ ` narrows to Front Squat rather than to nothing.
  const matching = useMemo(
    () =>
      needle === ''
        ? offers
        : offers.filter((offer) => normalizeExerciseName(offerName(offer)).includes(needle)),
    [offers, needle],
  );

  // What the typed text *means*, decided in the domain and never here. When it
  // names something already offered this is that offer, which is REQ-306's
  // reuse; otherwise it is the `new` offer REQ-305 promises.
  const typed = resolveTypedName(query, offers);

  function commit(offer: Offer) {
    onAdd(offer);
    setQuery('');
    setOpen(false);
  }

  if (!open) {
    return (
      <Button
        aria-label={`Add an exercise to ${workoutName}`}
        onClick={() => setOpen(true)}
        size="block"
        type="button"
        variant="secondary"
      >
        <Plus aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
        Add an exercise
      </Button>
    );
  }

  return (
    <div className={cn(WELL, 'arrive')}>
      <TextField
        id={`add-exercise-${workoutIndex}`}
        label={`add to ${workoutName}`}
        onCommit={setQuery}
        placeholder="Search, or type a new movement"
        value={query}
      />

      {/* REQ-306 — said before they commit, not discovered afterwards. A
          duplicate is the correct outcome on this path: the lifter is naming a
          movement to program, and binding to the one that already exists is
          what keeps their history in one piece. */}
      {needle !== '' && typed.kind !== 'new' && (
        <p className="type-body-sm text-planned-ink">
          {offerName(typed)} already exists — adding it will use that movement, not make a
          second one.
        </p>
      )}

      {matching.length > 0 && (
        <div
          aria-label="Exercises you can add"
          className="-mx-1 flex max-h-72 flex-col overflow-y-auto overscroll-contain px-1"
          role="group"
        >
          {matching.map((offer) => (
            <button
              className="flex min-h-12 items-center gap-3 rounded-field px-2 text-left hover:bg-well focus-visible:bg-well"
              key={`${offer.kind}-${offerName(offer)}`}
              onClick={() => commit(offer)}
              type="button"
            >
              <span className="min-w-0 flex-1 truncate type-title">{offerName(offer)}</span>
              <span className={LABEL}>{sourceOf(offer)}</span>
            </button>
          ))}
        </div>
      )}

      {/* REQ-305 — a movement none of the three sources knows, named without
          leaving the wizard. It writes a name into the draft and stores
          nothing; the Exercise is minted at Accept, inside the same transaction
          an imported file's would be. */}
      {typed.kind === 'new' && typed.name !== '' && (
        <Button onClick={() => commit(typed)} size="block" type="button" variant="primary">
          <Plus aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          Add “{typed.name}” as a new movement
        </Button>
      )}

      {needle !== '' && matching.length === 0 && typed.kind === 'new' && (
        <p className="type-body-sm text-ink-2">
          <Search aria-hidden="true" className="mr-1.5 inline" size={14} strokeWidth={ICON_STROKE} />
          Nothing here matches. The button above adds it as a new movement.
        </p>
      )}

      <Button
        onClick={() => {
          setQuery('');
          setOpen(false);
        }}
        type="button"
        variant="ghost"
      >
        Cancel
      </Button>
    </div>
  );
}

/**
 * Where an offer came from, in one word.
 *
 * Provenance is worth the pixels because the three sources mean different
 * things to a lifter: the catalog is what the app ships, "yours" is what they
 * created, and "in this routine" is a name they wrote minutes ago in another
 * Workout — the last of which would otherwise look like a movement the app
 * somehow already knew.
 */
function sourceOf(offer: Offer): string {
  switch (offer.kind) {
    case 'catalog':
      return 'catalog';
    case 'user':
      return 'yours';
    case 'draft':
      return 'in this routine';
    case 'new':
      return 'new';
  }
}
