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
import { ArrowRight, EllipsisVertical, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import type { ExerciseRef, RoutineFile, RoutineFileExercise } from '@/domain/routine-file';
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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { plural } from '@/features/ui/format';
import { ICON_STROKE, LABEL, RULED, WELL, chip } from '@/features/ui/styles';
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
}: ExercisesStepProps) {
  const workouts = file.routine.workouts;
  const current = workouts[activeWorkout];

  return (
    <>
      {/* Two lines, not one: a long routine name plus a count wraps mid-phrase
          at 390px. The name is prose and takes the UI face; the count is data
          and takes the mono provenance line. The step's own title is in the bar
          above, so neither is repeated here. */}
      <div className="flex flex-col gap-1">
        <p className="type-lede text-ink-2">{file.routine.name}</p>
        <p className="type-lot text-ink-3">{plural(workouts.length, 'workout')}</p>
      </div>

      {/* Radix owns the strip: arrow keys move between Workouts and the panel
          below follows, which the two hand-rolled strips never did. The list is
          dropped for a single Workout — one tab is a label, not a choice. */}
      <Tabs
        onValueChange={(value) => onActiveWorkout(Number(value))}
        value={String(activeWorkout)}
      >
        {workouts.length > 1 && (
          <TabsList aria-label="Workouts">
            {workouts.map((workout, index) => (
              <TabsTrigger key={`${workout.name}-${index}`} value={String(index)}>
                {workout.name}
                {hasIssuesUnder(issues, workoutPath(index)) && (
                  <span
                    aria-label="has a problem"
                    className="size-2 rounded-cell bg-missed data-[state=active]:bg-on-fill"
                    role="img"
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {current === undefined ? (
          <div className={WELL}>
            <p className="type-title">This routine declares no Workouts</p>
            <p className="type-body-sm text-ink-2">
              Add at least one Workout to the file and choose it again.
            </p>
          </div>
        ) : (
          <TabsContent value={String(activeWorkout)}>
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
                  issues={issues}
                  key={`${exercise.name}-${index}`}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onToggle={onToggle}
                  open={openRef?.workout === activeWorkout && openRef.exercise === index}
                  position={index + 1}
                />
              ))
            )}

            {workouts.length > 1 && (
              <WorkoutHandoff
                hasNext={activeWorkout + 1 < workouts.length}
                onNext={() => onActiveWorkout(activeWorkout + 1)}
                position={activeWorkout + 1}
                total={workouts.length}
              />
            )}
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

interface WorkoutHandoffProps {
  readonly position: number;
  readonly total: number;
  readonly hasNext: boolean;
  readonly onNext: () => void;
}

/**
 * The end of a Workout's list, and the way into the next one.
 *
 * A tab strip is a poor invitation: it says the other Workouts exist, once, at
 * the top, and then scrolls away above six exercises. By the time the lifter
 * reaches the bottom of Push they have no reason to remember Pull is waiting —
 * so the list itself hands them over, at the moment they have finished reading
 * and are looking for what is next.
 *
 * The count is stated in words rather than left to the strip, because "1 of 3"
 * is what makes an unopened Workout feel outstanding rather than optional. The
 * button does not name the Workout it goes to: a routine file may call it
 * anything, and "Review D2 / GPP (deload)" is a worse promise than "next".
 *
 * It is blue, and white nowhere: every exercise above it is a raised white card,
 * so a sixth white dome at the bottom of the stack reads as one more of them.
 * Instrument Blue is already this system's navigation hue — the active nav item
 * and the focus ring are both blue — and moving between Workouts is navigation,
 * not another edit. The washed face says the same thing the colour does: this
 * row is about the list, not in it.
 */
function WorkoutHandoff({ position, total, hasNext, onNext }: WorkoutHandoffProps) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      <p className="type-lot text-planned-ink">
        workout {position} of {total}
      </p>

      {hasNext ? (
        <Button onClick={onNext} size="block" type="button" variant="nav">
          Review next Workout
          <ArrowRight aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        </Button>
      ) : (
        <p className="rounded-control bg-planned-wash px-4 py-3 type-body-sm text-planned-ink">
          That is every Workout in this Routine. Anything you missed is still up in the
          strip above.
        </p>
      )}
    </div>
  );
}

interface ExerciseRowProps {
  readonly exercise: RoutineFileExercise;
  readonly exerciseRef: ExerciseRef;
  readonly position: number;
  readonly open: boolean;
  readonly defaultUnit: Unit;
  readonly issues: IssueIndex;
  readonly onToggle: (ref: ExerciseRef | null) => void;
  readonly onEdit: (ref: ExerciseRef, patch: Partial<RoutineFileExercise>) => void;
  readonly onDelete: (ref: ExerciseRef) => void;
}

function ExerciseRow({
  exercise,
  exerciseRef,
  position,
  open,
  defaultUnit,
  issues,
  onToggle,
  onEdit,
  onDelete,
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
    <Card asChild className={cn(flagged && 'border-missed')} panel>
      <article>
      <div className="flex min-h-12 w-full items-center gap-3">
        <Summary defaultUnit={defaultUnit} exercise={exercise} position={position} />
        {flagged && (
          <span className={chip('missed')}>
            <TriangleAlert aria-hidden="true" size={12} strokeWidth={ICON_STROKE} />
            fix
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`Options for ${exercise.name}`} size="icon" variant="secondary">
              <EllipsisVertical aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onToggle(expanded ? null : exerciseRef)}>
              <Pencil aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
              {expanded ? 'Close editor' : 'Edit'}
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={() => setConfirmingDelete(true)}>
              <Trash2 aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {confirmingDelete && (
        <div className={cn(RULED, 'arrive flex-row flex-wrap items-center gap-2')}>
          <p className="type-body-sm text-ink-2">Remove {exercise.name} from this Workout?</p>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={() => setConfirmingDelete(false)} size="compact" variant="quiet">
              Keep it
            </Button>
            <Button
              aria-label={`Confirm removing ${exercise.name}`}
              onClick={() => onDelete(exerciseRef)}
              size="compact"
              variant="danger"
            >
              <Trash2 aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
              Remove it
            </Button>
          </div>
        </div>
      )}

      {expanded && (
        <div className={RULED} id={`${fieldId(base)}-editor`}>
          <div className="flex flex-col gap-3">
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
            id={fieldId(`${base}.progression.type`)}
            onUseManual={() => patch({ progression: { type: 'manual' } })}
          />

        </div>
      )}
      </article>
    </Card>
  );
}

interface SummaryProps {
  readonly exercise: RoutineFileExercise;
  readonly position: number;
  readonly defaultUnit: Unit;
}

/**
 * What the row says when it is closed: the exercise, as the programme states it.
 *
 * The progression sits between the name and the targets because that is what it
 * is — not a target for today but the rule that decides the next one, so it
 * reads as provenance under the title rather than as another number in the row.
 */
function Summary({ exercise, position, defaultUnit }: SummaryProps) {
  return (
    <>
      <span className="type-measure-sm text-ink-3">{position}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="type-title truncate">{exercise.name}</span>
        <span className="type-lot text-ink-3">{progressionLine(exercise)}</span>
        <span className="type-measure-sm text-ink-3">
          {programmingLine(exercise, defaultUnit)}
        </span>
      </span>
    </>
  );
}

interface ProgressionRowProps {
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
function ProgressionRow({ error, id, onUseManual }: ProgressionRowProps) {
  if (error === null) return null; // the summary already states the rule

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="type-caption order-last w-full text-missed-ink" id={`${id}-error`}>
        {error}
      </p>
      <span className={LABEL}>progression</span>
      <Button
        aria-describedby={`${id}-error`}
        id={id}
        onClick={onUseManual}
        size="compact"
        variant="secondary"
      >
        Use manual progression
      </Button>
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
