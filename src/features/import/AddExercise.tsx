import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { normalizeExerciseName } from '@/domain/catalog';
import { offerName, resolveTypedName, type Offer } from '@/domain/routine-file';
import { Button } from '@/components/ui/button';
import { TextField } from '@/features/ui/fields';
import { ExerciseOptions } from '@/features/ui/ExerciseOptions';
import { ICON_STROKE, WELL } from '@/features/ui/styles';
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
    <ExerciseSearch
      action="Add"
      id={`add-exercise-${workoutIndex}`}
      label={`add to ${workoutName}`}
      offers={offers}
      onCancel={() => setOpen(false)}
      onPick={(offer) => {
        onAdd(offer);
        setOpen(false);
      }}
    />
  );
}

interface ExerciseSearchProps {
  readonly offers: readonly Offer[];
  readonly id: string;
  readonly label: string;
  /** The verb on the button that turns typed text into a new exercise. */
  readonly action: string;
  readonly onPick: (offer: Offer) => void;
  readonly onCancel: () => void;
}

export function ExerciseSearch({ offers, id, label, action, onPick, onCancel }: ExerciseSearchProps) {
  const [query, setQuery] = useState('');

  const needle = normalizeExerciseName(query);

  const matching = useMemo(
    () =>
      needle === ''
        ? offers
        : offers.filter((offer) => normalizeExerciseName(offerName(offer)).includes(needle)),
    [offers, needle],
  );

  const typed = resolveTypedName(query, offers);

  return (
    <div className={cn(WELL, 'arrive')}>
      <TextField
        autoFocus
        id={id}
        label={label}
        onCommit={setQuery}
        placeholder="Search, or type a new exercise"
        value={query}
      />

      {needle !== '' && typed.kind !== 'new' && (
        <p className="type-body-sm text-planned-ink">
          {offerName(typed)} already exists — picking it will use that exercise, not make a
          second one.
        </p>
      )}

      {/* The cut and the "N more" tail belong to `ExerciseOptions`, shared with
          the Routine screen's own add-form. This list used to run to ninety-six
          rows with nothing saying so. */}
      <ExerciseOptions
        onPick={onPick}
        options={matching.map((offer) => ({
          key: `${offer.kind}-${offerName(offer)}`,
          name: offerName(offer),
          note: sourceOf(offer),
          value: offer,
        }))}
      />

      {typed.kind === 'new' && typed.name !== '' && (
        <Button onClick={() => onPick(typed)} size="block" type="button" variant="primary">
          <Plus aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          {action} “{typed.name}” as a new exercise
        </Button>
      )}

      {needle !== '' && matching.length === 0 && typed.kind === 'new' && (
        <p className="type-body-sm text-ink-2">
          <Search aria-hidden="true" className="mr-1.5 inline" size={14} strokeWidth={ICON_STROKE} />
          Nothing here matches. The button above adds it as a new exercise.
        </p>
      )}

      <Button onClick={onCancel} type="button" variant="ghost">
        Cancel
      </Button>
    </div>
  );
}

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
