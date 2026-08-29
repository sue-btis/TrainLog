import { useMemo, useState } from 'react';
import { LoaderCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CATALOG, normalizeExerciseName } from '@/domain/catalog';
import type { ExerciseId } from '@/domain/ids';
import type { Exercise } from '@/domain/types';
import { usePerformedExercises, useUserExercises } from '@/features/data/queries';
import { ExerciseArt } from '@/features/exercises/ExerciseArt';
import { FOCUS_RING, ICON_STROKE, LABEL, PRESS, ROW, ROW_LIST, WELL } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

/** Enough to scan at arm's length; the search narrows to what is wanted. */
const SHOWN = 40;

interface ExercisePickerProps {
  readonly onPick: (exercise: Exercise) => void;
  readonly onCancel: () => void;
  readonly busy: boolean;
}

export function ExercisePicker({ onPick, onCancel, busy }: ExercisePickerProps) {
  const user = useUserExercises();
  const [query, setQuery] = useState('');
  const [pressed, setPressed] = useState<ExerciseId | null>(null);

  function pick(exercise: Exercise) {
    setPressed(exercise.id);
    onPick(exercise);
  }

  const performed = usePerformedExercises();

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
  readonly onPick: (exercise: Exercise) => void;
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
                PRESS,
                FOCUS_RING,
                busy && !adding && 'opacity-60',
              )}
              disabled={busy}
              key={exercise.id}
              onClick={() => onPick(exercise)}
              type="button"
            >
              <span className="flex items-center gap-3">
                <ExerciseArt className="size-11 text-planned-ink" id={exercise.id} reserve />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
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
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
