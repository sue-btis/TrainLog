/**
 * Step 1 — Exercises (§11.1).
 *
 * One Workout at a time, because a real programme is three or four Workouts of
 * five or six exercises and all of it at once is twenty screens of scroll on a
 * phone. Each exercise is a collapsed row that reads like the programme —
 * `4×4–6 · RIR 1–2 · 210s` — and opens into its editor. A row carrying a
 * semantic issue is open and stays open: it is the one thing standing between
 * the lifter and `Accept`, so it does not get to hide.
 *
 * §11.1 gives no way to add an exercise in the MVP, so none is offered.
 */

import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Trash2, TriangleAlert } from 'lucide-react';
import type {
  ExerciseRef,
  MoveDirection,
  RoutineFile,
  RoutineFileExercise,
} from '@/domain/routine-file';
import type { Unit } from '@/domain/types';
import { NotesField, NumberField, SelectField } from '@/features/import/fields';
import {
  describeIssue,
  exercisePath,
  fieldId,
  hasIssuesUnder,
  issuesAt,
  workoutPath,
  type IssueIndex,
} from '@/features/import/issues';
import {
  FOCUS_RING,
  ICON_STROKE,
  LABEL,
  PANEL_CARD,
  WELL,
  button,
  chip,
  tab,
} from '@/features/ui/styles';
import { cn } from '@/lib/utils';

const UNIT_OPTIONS = [
  { value: 'kg' as Unit, label: 'kg' },
  { value: 'lb' as Unit, label: 'lb' },
];

interface ExercisesStepProps {
  readonly file: RoutineFile;
  readonly defaultUnit: Unit;
  readonly issues: IssueIndex;
  readonly activeWorkout: number;
  readonly openRef: ExerciseRef | null;
  readonly onActiveWorkout: (index: number) => void;
  readonly onToggle: (ref: ExerciseRef | null) => void;
  readonly onEdit: (ref: ExerciseRef, patch: Partial<RoutineFileExercise>) => void;
  readonly onDelete: (ref: ExerciseRef) => void;
  readonly onMove: (ref: ExerciseRef, direction: MoveDirection) => void;
}

export function ExercisesStep({
  file,
  defaultUnit,
  issues,
  activeWorkout,
  openRef,
  onActiveWorkout,
  onToggle,
  onEdit,
  onDelete,
  onMove,
}: ExercisesStepProps) {
  const workouts = file.routine.workouts;
  const current = workouts[activeWorkout];

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="type-display">Review the exercises</h1>
        <p className="type-measure text-ink-3">
          {file.routine.name} · {workouts.length} {workouts.length === 1 ? 'Workout' : 'Workouts'}
        </p>
      </header>

      {workouts.length > 1 && (
        <div
          aria-label="Workouts"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
          role="group"
        >
          {workouts.map((workout, index) => (
            <button
              aria-pressed={index === activeWorkout}
              className={tab(index === activeWorkout)}
              key={`${workout.name}-${index}`}
              onClick={() => onActiveWorkout(index)}
              type="button"
            >
              {workout.name}
              {hasIssuesUnder(issues, workoutPath(index)) && (
                <span
                  aria-label="has a problem"
                  className={cn(
                    'size-2 rounded-cell',
                    index === activeWorkout ? 'bg-on-fill' : 'bg-missed',
                  )}
                  role="img"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {current === undefined ? (
        <div className={WELL}>
          <p className="type-title">This routine declares no Workouts</p>
          <p className="type-body-sm text-ink-2">
            Add at least one Workout to the file and choose it again.
          </p>
        </div>
      ) : (
        <>
          {workouts.length === 1 && <h2 className="type-headline">{current.name}</h2>}

          {current.exercises.length === 0 ? (
            <div className={WELL}>
              <p className="type-title">{current.name} has no exercises left</p>
              <p className="type-body-sm text-ink-2">
                You removed all of them. That is allowed — the Workout will simply record
                nothing. To put one back, choose the file again.
              </p>
            </div>
          ) : (
            current.exercises.map((exercise, index) => (
              <ExerciseRow
                defaultUnit={defaultUnit}
                exercise={exercise}
                exerciseRef={{ workout: activeWorkout, exercise: index }}
                isFirst={index === 0}
                isLast={index === current.exercises.length - 1}
                issues={issues}
                key={`${exercise.name}-${index}`}
                onDelete={onDelete}
                onEdit={onEdit}
                onMove={onMove}
                onToggle={onToggle}
                open={openRef?.workout === activeWorkout && openRef.exercise === index}
                position={index + 1}
              />
            ))
          )}
        </>
      )}
    </>
  );
}

interface ExerciseRowProps {
  readonly exercise: RoutineFileExercise;
  readonly exerciseRef: ExerciseRef;
  readonly position: number;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly open: boolean;
  readonly defaultUnit: Unit;
  readonly issues: IssueIndex;
  readonly onToggle: (ref: ExerciseRef | null) => void;
  readonly onEdit: (ref: ExerciseRef, patch: Partial<RoutineFileExercise>) => void;
  readonly onDelete: (ref: ExerciseRef) => void;
  readonly onMove: (ref: ExerciseRef, direction: MoveDirection) => void;
}

function ExerciseRow({
  exercise,
  exerciseRef,
  position,
  isFirst,
  isLast,
  open,
  defaultUnit,
  issues,
  onToggle,
  onEdit,
  onDelete,
  onMove,
}: ExerciseRowProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const base = exercisePath(exerciseRef.workout, exerciseRef.exercise);
  const flagged = hasIssuesUnder(issues, base);
  const expanded = open || flagged;

  const errorFor = (key: string): string | null => {
    const found = issuesAt(issues, key)[0];
    return found === undefined ? null : describeIssue(found, exercise);
  };

  const patch = (fields: Partial<RoutineFileExercise>) => onEdit(exerciseRef, fields);

  return (
    <article className={cn(PANEL_CARD, flagged && 'border-missed')}>
      {flagged ? (
        <div className="flex min-h-12 w-full items-center gap-3">
          <Summary
            defaultUnit={defaultUnit}
            exercise={exercise}
            position={position}
          />
          <span className={chip('missed')}>
            <TriangleAlert aria-hidden="true" size={12} strokeWidth={ICON_STROKE} />
            fix
          </span>
        </div>
      ) : (
        <button
          aria-controls={`${fieldId(base)}-editor`}
          aria-expanded={expanded}
          className={cn('flex min-h-12 w-full items-center gap-3 rounded-field text-left', FOCUS_RING)}
          onClick={() => onToggle(expanded ? null : exerciseRef)}
          type="button"
        >
          <Summary defaultUnit={defaultUnit} exercise={exercise} position={position} />
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'shrink-0 text-ink-3 transition-transform duration-[110ms] ease-snap',
              expanded && 'rotate-180',
            )}
            size={20}
            strokeWidth={ICON_STROKE}
          />
        </button>
      )}

      {expanded && (
        <div className="flex flex-col gap-3" id={`${fieldId(base)}-editor`}>
          <div className={WELL}>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                error={errorFor(`${base}.sets`)}
                id={fieldId(`${base}.sets`)}
                label="sets"
                onCommit={(value) => patch({ sets: value ?? 0 })}
                value={exercise.sets}
              />
              <NumberField
                error={errorFor(`${base}.rest_seconds`)}
                id={fieldId(`${base}.rest_seconds`)}
                label="rest (s)"
                onCommit={(value) => patch({ rest_seconds: value })}
                optional
                value={exercise.rest_seconds}
              />
              <NumberField
                error={errorFor(`${base}.reps`)}
                id={fieldId(`${base}.reps`)}
                label="min reps"
                onCommit={(value) =>
                  patch({ reps: { ...exercise.reps, min: value ?? exercise.reps.min } })
                }
                value={exercise.reps.min}
              />
              <NumberField
                id={`${fieldId(`${base}.reps`)}-max`}
                label="max reps"
                onCommit={(value) =>
                  patch({ reps: { ...exercise.reps, max: value ?? exercise.reps.max } })
                }
                value={exercise.reps.max}
              />
              <NumberField
                error={errorFor(`${base}.rir`)}
                id={fieldId(`${base}.rir`)}
                label="min RIR"
                onCommit={(value) => patch({ rir: withRir(exercise, 'min', value) })}
                optional
                value={exercise.rir?.min}
              />
              <NumberField
                id={`${fieldId(`${base}.rir`)}-max`}
                label="max RIR"
                onCommit={(value) => patch({ rir: withRir(exercise, 'max', value) })}
                optional
                value={exercise.rir?.max}
              />
              <SelectField
                id={fieldId(`${base}.unit`)}
                label="unit"
                onCommit={(value) => patch({ unit: value })}
                options={UNIT_OPTIONS}
                value={exercise.unit ?? defaultUnit}
              />
            </div>

            <NotesField
              id={fieldId(`${base}.notes`)}
              label="notes"
              onCommit={(notes) => patch({ notes })}
              value={exercise.notes}
            />
          </div>

          <ProgressionRow
            error={errorFor(`${base}.progression.type`)}
            exercise={exercise}
            id={fieldId(`${base}.progression.type`)}
            onUseManual={() => patch({ progression: { type: 'manual' } })}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              aria-label={`Move ${exercise.name} up`}
              className={button('secondary', 'icon')}
              disabled={isFirst}
              onClick={() => onMove(exerciseRef, -1)}
              type="button"
            >
              <ArrowUp aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
            </button>
            <button
              aria-label={`Move ${exercise.name} down`}
              className={button('secondary', 'icon')}
              disabled={isLast}
              onClick={() => onMove(exerciseRef, 1)}
              type="button"
            >
              <ArrowDown aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
            </button>

            <div className="ml-auto flex items-center gap-2">
              {confirmingDelete && (
                <button
                  className={button('ghost', 'compact')}
                  onClick={() => setConfirmingDelete(false)}
                  type="button"
                >
                  Keep it
                </button>
              )}
              <button
                aria-label={
                  confirmingDelete
                    ? `Confirm removing ${exercise.name}`
                    : `Remove ${exercise.name}`
                }
                className={button(confirmingDelete ? 'danger' : 'secondary', 'compact')}
                onClick={() => {
                  if (confirmingDelete) onDelete(exerciseRef);
                  else setConfirmingDelete(true);
                }}
                type="button"
              >
                <Trash2 aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
                {confirmingDelete ? 'Remove it' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

interface SummaryProps {
  readonly exercise: RoutineFileExercise;
  readonly position: number;
  readonly defaultUnit: Unit;
}

/** What the row says when it is closed: the exercise, as the programme states it. */
function Summary({ exercise, position, defaultUnit }: SummaryProps) {
  return (
    <>
      <span className="type-measure-sm text-ink-3">{position}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="type-title truncate">{exercise.name}</span>
        <span className="type-measure-sm text-ink-3">
          {programmingLine(exercise, defaultUnit)}
        </span>
      </span>
    </>
  );
}

interface ProgressionRowProps {
  readonly exercise: RoutineFileExercise;
  readonly error: string | null;
  /** The repair button's id, so the action bar can jump to this issue. */
  readonly id: string;
  readonly onUseManual: () => void;
}

/**
 * Progression is not one of the fields §11.1 lists as editable, and it is not
 * edited here — except in the one case the same section calls a semantic issue
 * to be corrected in the wizard. An unrecognized type has exactly two honest
 * outcomes: run the exercise on manual progression, or remove it.
 */
function ProgressionRow({ exercise, error, id, onUseManual }: ProgressionRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={LABEL}>progression</span>
        <span className="type-measure-sm text-ink-2">{progressionLine(exercise)}</span>
      </div>
      {error !== null && (
        <>
          <p className="type-caption order-last w-full text-missed-ink" id={`${id}-error`}>
            {error}
          </p>
          <button
            aria-describedby={`${id}-error`}
            className={button('secondary', 'compact')}
            id={id}
            onClick={onUseManual}
            type="button"
          >
            Use manual progression
          </button>
        </>
      )}
    </div>
  );
}

/** `4×4–6 · RIR 1–2 · 210s · kg` — the programme as the file states it. */
function programmingLine(exercise: RoutineFileExercise, defaultUnit: Unit): string {
  const parts = [`${exercise.sets}×${range(exercise.reps.min, exercise.reps.max)}`];
  if (exercise.rir !== undefined) parts.push(`RIR ${range(exercise.rir.min, exercise.rir.max)}`);
  if (exercise.rest_seconds !== undefined) parts.push(`${exercise.rest_seconds}s`);
  parts.push(exercise.unit ?? defaultUnit);
  return parts.join(' · ');
}

function progressionLine(exercise: RoutineFileExercise): string {
  const { type, increment } = exercise.progression;
  const name = type.replace(/_/g, ' ');
  return increment === undefined ? name : `${name} · +${increment}`;
}

function range(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

/** Entering one end of an absent RIR range seeds the other end with it. */
function withRir(
  exercise: RoutineFileExercise,
  end: 'min' | 'max',
  value: number | undefined,
): { min: number; max: number } | undefined {
  if (value === undefined) return undefined;
  const current = exercise.rir ?? { min: value, max: value };
  return { ...current, [end]: value };
}
