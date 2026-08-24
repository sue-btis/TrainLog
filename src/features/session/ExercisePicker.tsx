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
import { LoaderCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CATALOG, normalizeExerciseName } from '@/domain/catalog';
import type { ExerciseId } from '@/domain/ids';
import type { Exercise } from '@/domain/types';
import { usePerformedExercises, useUserExercises } from '@/features/data/queries';
import { FOCUS_RING, ICON_STROKE, LABEL, PRESS, ROW, ROW_LIST, WELL } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

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
  /**
   * Which row was pressed, so the write has somewhere to show.
   *
   * `busy` arrives as one flag for the whole screen and the list read it as
   * `disabled`: every row dimmed together, and the exercise a lifter had just
   * chosen looked exactly like the forty they had not. Read only while `busy`,
   * so nothing ever has to clear it.
   */
  const [pressed, setPressed] = useState<ExerciseId | null>(null);

  function pick(exerciseId: ExerciseId) {
    setPressed(exerciseId);
    onPick(exerciseId);
  }

  const performed = usePerformedExercises();

  // The catalog ships in the build and is never in the table (DEC-007), so the
  // two lists are disjoint and concatenate rather than merge. A lifter's own
  // exercises come first — they are the ones the catalog did not have.
  //
  // Then the part that matters mid-session: **what you have actually trained,
  // first.** The list used to be the catalog in catalog order, so the top of
  // the largest decision point in the product was "Back Squat, Front Squat, Box
  // Squat…" whether or not a lifter had ever done any of them. Their own twenty
  // movements were somewhere below the fold, behind a search box, while a rest
  // timer ran. Membership is enough to fix that; true recency would cost a
  // second query for an ordering a labelled section already conveys.
  const { trained, rest, total } = useMemo(() => {
    const all: readonly Exercise[] = [...(user ?? []), ...CATALOG];
    const needle = normalizeExerciseName(query);
    const matching =
      needle === ''
        ? all
        : all.filter((exercise) => normalizeExerciseName(exercise.name).includes(needle));

    const known = new Set(performed ?? []);
    return {
      trained: matching.filter((exercise) => known.has(exercise.id)),
      rest: matching.filter((exercise) => !known.has(exercise.id)),
      total: matching.length,
    };
  }, [user, performed, query]);

  // Trained exercises are never cut — there are only ever a few dozen, and they
  // are the answer. The catalog takes whatever room is left.
  const shownRest = rest.slice(0, Math.max(0, SHOWN - trained.length));
  const hidden = total - trained.length - shownRest.length;

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
        {/* No `autoFocus`. It raised the keyboard over the list it had just
            rendered, so the first thing a lifter saw of their own exercises was
            nothing. Typing is one tap away for anyone who wants it. */}
        <Input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Front squat, dip, row…"
          value={query}
        />
      </label>

      {total === 0 ? (
        <section className={WELL}>
          <p className="type-title">No exercise matches “{query}”</p>
          <p className="type-body-sm text-ink-2">
            Only what the app ships with, and what your routines named.
          </p>
        </section>
      ) : (
        <>
          {trained.length > 0 && (
            <Group
              busy={busy}
              exercises={trained}
              label="you have trained"
              onPick={pick}
              pressed={pressed}
            />
          )}
          {shownRest.length > 0 && (
            <Group
              busy={busy}
              exercises={shownRest}
              label={trained.length > 0 ? 'everything else' : 'the catalog'}
              onPick={pick}
              pressed={pressed}
            />
          )}
          {/* The list used to end silently at forty, so an exercise ranked
              forty-first simply was not there for anyone who scrolled rather
              than typed. */}
          {hidden > 0 && (
            <p className="type-measure-sm text-ink-3">
              {hidden} more — search to narrow the list.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** One labelled block of the list. Two of these are the whole ordering. */
function Group({
  label,
  exercises,
  busy,
  pressed,
  onPick,
}: {
  readonly label: string;
  readonly exercises: readonly Exercise[];
  readonly busy: boolean;
  /** The row the write belongs to. Every other one is what dims. */
  readonly pressed: ExerciseId | null;
  readonly onPick: (exerciseId: ExerciseId) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <span className={LABEL}>{label}</span>
      <div className={ROW_LIST}>
        {exercises.map((exercise) => {
          const adding = busy && pressed === exercise.id;
          return (
            <button
              className={cn(
                ROW,
                'text-left',
                // The list is the largest decision point in the product, and its
                // rows were the only pressable surface in the app wearing no
                // press at all — forty rows answering a thumb with nothing.
                PRESS,
                FOCUS_RING,
                busy && !adding && 'opacity-60',
              )}
              disabled={busy}
              key={exercise.id}
              onClick={() => onPick(exercise.id)}
              type="button"
            >
              <span className="flex items-center gap-2 type-title">
                {exercise.name}
                {adding && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="ml-auto shrink-0 animate-spin text-ink-3"
                    size={16}
                    strokeWidth={ICON_STROKE}
                  />
                )}
              </span>
              {exercise.category !== null && (
                <span className="type-measure-sm text-ink-3">{exercise.category}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
