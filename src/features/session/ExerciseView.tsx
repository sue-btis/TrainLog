import { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CompletedSetId } from '@/domain/ids';
import { targetUnitOf, targetsReps } from '@/domain/measurement';
import type { CompletedSet, ExerciseSession } from '@/domain/types';
import type { LoadSuggestion } from '@/domain/progression';
import { suggestLoad } from '@/domain/progression';
import type { Unit } from '@/domain/units';
import { SetEditor } from '@/features/session/SetEditor';
import {
  EMPTY_VALUES,
  SetLogger,
  targetsOf,
  valuesOf,
  type SetValues,
} from '@/features/session/SetLogger';
import { useExerciseHistory, usePreviousPerformance } from '@/features/data/queries';
import { ExerciseArt } from '@/features/exercises/ExerciseArt';
import { Figure } from '@/features/ui/Figure';
import { snapshotFigures } from '@/features/ui/format';
import { ICON_STROKE, RULED, chip, dome } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

const DEFAULT_STEP = 2.5;

interface ExerciseViewProps {
  readonly exerciseSession: ExerciseSession;
  readonly name: string;
  readonly sets: readonly CompletedSet[];
  readonly defaultUnit: Unit;
  readonly defaultRir: number | null;
  readonly onLog: (values: SetValues, setNumber: number) => Promise<void>;
  readonly onAdvance: () => void;
  readonly isLast: boolean;
  readonly onEditSet: (set: CompletedSet, values: SetValues) => Promise<void>;
  readonly onDeleteSet: (set: CompletedSet) => Promise<void>;
  readonly busy: boolean;
}

export function ExerciseView({
  exerciseSession,
  name,
  sets,
  defaultUnit,
  defaultRir,
  onLog,
  onAdvance,
  isLast,
  onEditSet,
  onDeleteSet,
  busy,
}: ExerciseViewProps) {
  const planned = exerciseSession.plannedExerciseId === null ? null : exerciseSession;
  const history = useExerciseHistory(exerciseSession.exerciseId);
  const previous = usePreviousPerformance(exerciseSession.exerciseId, exerciseSession.sessionId);

  const suggestion = history === undefined ? null : suggestLoad(exerciseSession, history);

  const lastSet = sets.at(-1);
  const previousSets = previous?.exercises.flatMap((entry) => entry.sets) ?? [];

  // A recorded unit wins; the plan and prior context outrank the user's default seed.
  const unit =
    lastSet?.unit ?? planned?.plannedUnit ?? suggestion?.unit ?? previousSets[0]?.unit ?? defaultUnit;

  const [values, setValues] = useState<SetValues | null>(null);

  const [addingExtra, setAddingExtra] = useState(false);
  const [editing, setEditing] = useState<CompletedSetId | null>(null);
  const editedSet = sets.find((set) => set.id === editing) ?? null;

  const targets = targetsOf(exerciseSession);

  const opening = openingValues(exerciseSession, sets, suggestion, previousSets, defaultRir, unit);
  const current = values ?? opening;
  const setNumber = sets.length + 1;

  const done = planned !== null && sets.length >= planned.plannedSets;

  const entering = editedSet === null && (!done || addingExtra);

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          {/* The figure sits beside the title rather than above it: between
              sets the lifter is checking a position, not studying a diagram,
              and a full-width illustration would push the targets below the
              fold on a phone. */}
          <ExerciseArt className="size-16 text-planned-ink" id={exerciseSession.exerciseId} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <h2 className="type-display">{name}</h2>
            {planned === null && <span className={chip('neutral')}>Unplanned</span>}
            {sets.length > (planned?.plannedSets ?? Infinity) && (
              <span className={chip('actual')}>{sets.length - planned!.plannedSets} extra</span>
            )}
          </div>
        </div>

        {planned !== null && (
          <div className="grid grid-cols-3 gap-x-3 border-t border-rule pt-3">
            {snapshotFigures(planned).map((figure) => (
              <Figure compact key={figure.label} label={figure.label} value={figure.value} />
            ))}
          </div>
        )}
      </header>

      <DomeStrip
        canAdd={editedSet === null && !entering}
        entering={entering}
        onAddSet={() => setAddingExtra(true)}
        onEdit={(set) => setEditing(set.id)}
        plannedSets={planned?.plannedSets ?? 0}
        previousSets={previousSets}
        sets={sets}
      />

      <div className={RULED}>
        {editedSet !== null ? (
          <SetEditor
            busy={busy}
            key={editedSet.id}
            measurement={exerciseSession.measurement}
            onCancel={() => setEditing(null)}
            onDelete={() => {
              setEditing(null);
              void onDeleteSet(editedSet);
            }}
            onSave={(next) => {
              setEditing(null);
              void onEditSet(editedSet, next);
            }}
            set={editedSet}
            targets={targets}
            weightStep={stepOf(exerciseSession)}
          />
        ) : !entering ? (
          // `disabled` matters most on the last exercise, where this control is
          // not a pager but the whole finish: it writes the Session, its
          // exercises and the progression behind them, then leaves.
          <Button disabled={busy} onClick={onAdvance} size="block" type="button" variant="primary">
            {isLast ? (
              <CheckCircle2 aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
            ) : (
              <ArrowRight aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
            )}
            {isLast ? 'Finish session' : 'Next exercise'}
          </Button>
        ) : (
          <SetLogger
            busy={busy}
            measurement={exerciseSession.measurement}
            onChange={setValues}
            onComplete={() => {
              setAddingExtra(false);
              void onLog(current, setNumber);
            }}
            setNumber={setNumber}
            targets={targets}
            values={current}
            weightStep={stepOf(exerciseSession)}
          />
        )}
      </div>

    </section>
  );
}

function DomeStrip({
  plannedSets,
  sets,
  previousSets,
  entering,
  canAdd,
  onEdit,
  onAddSet,
}: {
  readonly plannedSets: number;
  readonly sets: readonly CompletedSet[];
  readonly previousSets: readonly CompletedSet[];
  /** Whether the logger is open for a new set — the live dome's only reason. */
  readonly entering: boolean;
  readonly canAdd: boolean;
  readonly onEdit: (set: CompletedSet) => void;
  readonly onAddSet: () => void;
}) {
  const liveNumber = sets.length + 1;
  const count = Math.max(plannedSets, sets.length + (entering ? 1 : 0));

  const openedRef = useRef<ReadonlySet<CompletedSetId> | null>(null);
  const opened = (openedRef.current ??= new Set(sets.map((set) => set.id)));

  const liveOnOpenRef = useRef<number | null>(null);
  const liveOnOpen = (liveOnOpenRef.current ??= entering ? liveNumber : -1);

  return (
    <div className="flex flex-wrap items-center gap-3 py-1">
      <DomeGoo />

      {Array.from({ length: count }, (_, index) => {
        const number = index + 1;
        const set = sets[index];
        const before = previousSets[index];

        if (set !== undefined) {
          return (
            <Cell before={before} key={set.id}>
              <button
                aria-label={`Edit set ${number}, ${set.weight} ${set.unit} for ${set.reps} reps at RIR ${set.rir}${ghostLabel(before)}`}
                className={dome(
                  'logged',
                  'compact',
                  opened.has(set.id) ? undefined : 'relative isolate dome-flood',
                )}
                onClick={() => onEdit(set)}
                type="button"
              >
                {!opened.has(set.id) && (
                  <span aria-hidden="true" className="dome-liquid">
                    <span className="dome-body bg-actual-ink" />
                    <span className="dome-sat dome-sat-a bg-actual-ink" />
                    <span className="dome-sat dome-sat-b bg-actual-ink" />
                    <span className="dome-sat dome-sat-c bg-actual-ink" />
                  </span>
                )}

                {/* Both numerals move as one so the flood uncovers a value
                    rather than two lines arriving separately. */}
                <span
                  className={cn(
                    'flex flex-col items-center gap-0.5',
                    opened.has(set.id) ? undefined : 'dome-value',
                  )}
                >
                  <span>{set.weight}</span>
                  <span className="type-label opacity-80">
                    {set.reps}·{set.rir}
                  </span>
                </span>
              </button>
            </Cell>
          );
        }

        const live = entering && number === liveNumber;
        const igniting = live && number !== liveOnOpen;
        return (
          <Cell before={before} key={number}>
            <div
              aria-label={`Set ${number}, ${live ? 'in progress' : 'planned'}${ghostLabel(before)}`}
              className={dome(
                live ? 'live' : 'planned',
                live ? 'default' : 'compact',
                igniting ? 'relative isolate dome-ignite' : undefined,
              )}
            >
              {igniting && (
                <span aria-hidden="true" className="dome-liquid">
                  <span className="dome-ignite-body bg-live" />
                  <span className="dome-ignite-sat dome-ignite-sat-a bg-live" />
                  <span className="dome-ignite-sat dome-ignite-sat-b bg-live" />
                  <span className="dome-ignite-sat dome-ignite-sat-c bg-live" />
                </span>
              )}

              <span>{number}</span>
            </div>
          </Cell>
        );
      })}

      {canAdd && (
        <Cell before={undefined}>
          <button
            aria-label={`Add set ${liveNumber}`}
            className={dome('add', 'compact')}
            onClick={onAddSet}
            type="button"
          >
            <Plus aria-hidden="true" size={22} strokeWidth={ICON_STROKE} />
          </button>
        </Cell>
      )}
    </div>
  );
}

function DomeGoo() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute size-0" focusable="false">
      <defs>
        <filter height="260%" id="dome-goo" width="260%" x="-80%" y="-80%">
          <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="3" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
          />
        </filter>
      </defs>
    </svg>
  );
}

function Cell({
  before,
  children,
}: {
  readonly before: CompletedSet | undefined;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {children}
      <span className="type-micro text-ink-3 tabular-nums">
        {before === undefined ? ' ' : `${before.weight}×${before.reps}`}
      </span>
    </div>
  );
}

/** The ghost value, spoken. A dome with nothing before it says nothing extra. */
function ghostLabel(before: CompletedSet | undefined): string {
  if (before === undefined) return '';
  return `. Last time ${before.weight} ${before.unit} for ${before.reps} reps`;
}

function stepOf(exerciseSession: ExerciseSession): number {
  if (exerciseSession.plannedExerciseId === null) return DEFAULT_STEP;
  const rule = exerciseSession.plannedProgression;
  return rule.type === 'double_progression' ? rule.increment : DEFAULT_STEP;
}

function openingValues(
  exerciseSession: ExerciseSession,
  sets: readonly CompletedSet[],
  suggestion: LoadSuggestion | null,
  previousSets: readonly CompletedSet[],
  defaultRir: number | null,
  unit: Unit,
): SetValues {
  const planned = exerciseSession.plannedExerciseId === null ? null : exerciseSession;
  const rir = planned?.plannedMinRir ?? previousSets[0]?.rir ?? defaultRir ?? 0;

  // The last set of this exercise, in this Session, is the strongest opening
  // there is: it is what the lifter just did, on every axis at once.
  const lastLogged = sets.at(-1);
  if (lastLogged !== undefined) return valuesOf(lastLogged);

  // Otherwise the previous session's first set carries every axis the type
  // collects, and the plan's own target overrides the one axis it states.
  const previous = previousSets[0];
  // `unit` overrides whatever last session's set carried: the chain above is
  // the one statement of which unit an exercise opens in, and a stale set must
  // not quietly outrank the snapshot it already lost to there.
  const base: SetValues =
    previous === undefined
      ? { ...EMPTY_VALUES, rir, unit }
      : { ...valuesOf(previous), rir, unit };

  const opening = targetsReps(exerciseSession.measurement)
    ? { ...base, reps: planned?.plannedMaxReps ?? base.reps }
    : { ...base, ...targetOpening(exerciseSession, planned?.plannedMaxTarget ?? null, base) };

  return suggestion === null ? opening : { ...opening, weight: suggestion.weight };
}

function targetOpening(
  exerciseSession: ExerciseSession,
  plannedMaxTarget: number | null,
  base: SetValues,
): Partial<SetValues> {
  if (plannedMaxTarget === null) return {};
  if (targetUnitOf(exerciseSession.measurement) === 'seconds') {
    return { durationSeconds: plannedMaxTarget };
  }
  return base.distanceUnit === 'm' ? { distance: plannedMaxTarget } : {};
}
