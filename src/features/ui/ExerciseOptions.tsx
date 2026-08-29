import { LABEL } from '@/features/ui/styles';

export const SHOWN = 40;

export interface ExerciseOption<T> {
  readonly key: string;
  readonly name: string;
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
