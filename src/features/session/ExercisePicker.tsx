/**
 * Choosing an unplanned exercise (FR-15, §11.5).
 *
 * It offers the bundled catalog and every Exercise a routine file has already
 * created, and nothing else: this picks, it does not create (A-1). Creating one
 * would mean owning the name-matching rules of §26 — normalize, look for an
 * existing match, decide whether "Front squat" and "front  squat" are the same
 * movement — and getting that wrong splits a lifter's history in two, silently.
 * The catalog covers the movements; a name it does not know arrives through a
 * routine file, which already does that matching properly.
 *
 * A substitution is expressed here too: skip the planned exercise, add this one
 * (§11.5). There is deliberately no third mechanism for it.
 */

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CATALOG, normalizeExerciseName } from '@/domain/catalog';
import type { ExerciseId } from '@/domain/ids';
import type { Exercise } from '@/domain/types';
import { useUserExercises } from '@/features/data/queries';
import { ICON_STROKE, LABEL, ROW, ROW_LIST, WELL } from '@/features/ui/styles';

/** Enough to scan at arm's length; the search narrows to what is wanted. */
const SHOWN = 40;

interface ExercisePickerProps {
  readonly onPick: (exerciseId: ExerciseId) => void;
  readonly onCancel: () => void;
  readonly busy: boolean;
}

export function ExercisePicker({ onPick, onCancel, busy }: ExercisePickerProps) {
  const user = useUserExercises();
  const [query, setQuery] = useState('');

  // The catalog ships in the build and is never in the table (DEC-007), so the
  // two lists are disjoint and concatenate rather than merge. A lifter's own
  // exercises come first — they are the ones the catalog did not have.
  const matches = useMemo(() => {
    const all: readonly Exercise[] = [...(user ?? []), ...CATALOG];
    const needle = normalizeExerciseName(query);
    if (needle === '') return all.slice(0, SHOWN);
    return all
      .filter((exercise) => normalizeExerciseName(exercise.name).includes(needle))
      .slice(0, SHOWN);
  }, [user, query]);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="type-headline">Add an exercise</h2>
        <Button aria-label="Cancel" onClick={onCancel} size="icon" type="button" variant="ghost">
          <X aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        </Button>
      </header>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>
          <Search aria-hidden="true" className="mr-1.5 inline" size={13} strokeWidth={ICON_STROKE} />
          search
        </span>
        <Input
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Front squat, dip, row…"
          value={query}
        />
      </label>

      {matches.length === 0 ? (
        <section className={WELL}>
          <p className="type-title">No exercise matches “{query}”</p>
          <p className="type-body-sm text-ink-2">
            Only the built-in catalog and the exercises your routine files created are
            available here. A new movement arrives by importing a routine that names it.
          </p>
        </section>
      ) : (
        <div className={ROW_LIST}>
          {matches.map((exercise) => (
            <button
              className={`${ROW} text-left disabled:opacity-60`}
              disabled={busy}
              key={exercise.id}
              onClick={() => onPick(exercise.id)}
              type="button"
            >
              <span className="type-title">{exercise.name}</span>
              {exercise.category !== null && (
                <span className="type-measure-sm text-ink-3">{exercise.category}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
