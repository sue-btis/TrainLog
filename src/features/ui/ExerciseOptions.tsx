/**
 * The list of exercises an add-form offers, and the cut it makes.
 *
 * One component because there are two of these forms — the wizard's
 * `AddExercise`, which may also mint a name, and `AddPlannedExerciseForm` on a
 * Routine already running, which may not — and they were answering the same
 * question two different ways. The wizard rendered all 96 catalog entries as a
 * flat scroller with no count, sixteen screens deep inside a 288px window; its
 * sibling cut at forty and said how many were left. The cut and the tail live
 * here now, so neither form owns the answer and they cannot drift again.
 *
 * What it deliberately does **not** do is group by category, the way the
 * Exercises screen does. Both callers hand it a list whose *order* is
 * load-bearing: the wizard's mirrors `resolveFileExercise`'s resolution order,
 * so what the picker shows is what a pick will bind to, and the Routine form
 * puts the lifter's own movements first because a catalog-first list buried a
 * movement they created minutes ago. Regrouping alphabetically would throw both
 * away to save a scroll the search box already saves.
 */

import { LABEL } from '@/features/ui/styles';

/**
 * The cut. Forty is enough to scroll and few enough to stay cheap, and anything
 * past it is reachable by typing — which the tail says out loud.
 */
export const SHOWN = 40;

export interface ExerciseOption<T> {
  /** React key. The name alone is not unique: two sources may spell one name. */
  readonly key: string;
  readonly name: string;
  /** Where it came from, when the caller has more than one source. */
  readonly note?: string;
  /** What `onPick` receives. The caller's own type; this component never reads it. */
  readonly value: T;
}

interface ExerciseOptionsProps<T> {
  readonly options: readonly ExerciseOption<T>[];
  readonly onPick: (value: T) => void;
}

export function ExerciseOptions<T>({ options, onPick }: ExerciseOptionsProps<T>) {
  if (options.length === 0) return null;

  const shown = options.slice(0, SHOWN);
  const hidden = options.length - shown.length;

  return (
    <div
      aria-label="Exercises you can add"
      className="-mx-1 flex max-h-72 flex-col overflow-y-auto overscroll-contain px-1"
      role="group"
    >
      {shown.map((option) => (
        <button
          className="flex min-h-12 items-center gap-3 rounded-field px-2 text-left hover:bg-well focus-visible:bg-well"
          key={option.key}
          onClick={() => onPick(option.value)}
          type="button"
        >
          <span className="min-w-0 flex-1 truncate type-title">{option.name}</span>
          {option.note !== undefined && <span className={LABEL}>{option.note}</span>}
        </button>
      ))}
      {/* Both lists used to end at their cut without saying so — one of them
          silently, at ninety-six. */}
      {hidden > 0 && (
        <p className="type-measure-sm px-2 py-1 text-ink-3">
          {hidden} more — search to narrow the list.
        </p>
      )}
    </div>
  );
}
