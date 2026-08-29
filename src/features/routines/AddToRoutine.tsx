import { useMemo, useState } from 'react';
import { CalendarPlus, Dumbbell, Plus, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addPlannedExercise, addWorkoutToRoutine } from '@/db';
import { CATALOG, normalizeExerciseName } from '@/domain/catalog';
import { formatLocalDate, type LocalDate } from '@/domain/dates';
import { toId, type RoutineId, type WorkoutId } from '@/domain/ids';
import {
  plannedExerciseDraftFile,
  plannedExerciseDraftRefusals,
  validateRoutineFile,
  type PlannedExerciseDraft,
} from '@/domain/routine-file';
import type { RoutineFile } from '@/domain/routine-file';
import { targetUnitOf, targetsReps } from '@/domain/measurement';
import { claimantsOfDay, generatePlacements, remainingWeeks } from '@/domain/scheduling';
import type { Exercise, ProgressionRule, Unit, Weekday, Workout } from '@/domain/types';
import { useUserExercises } from '@/features/data/queries';
import { NumberField, SelectField, TextField } from '@/features/ui/fields';
import { describeIssue } from '@/features/import/issues';
import { weekdayName } from '@/features/ui/format';
import { ExerciseOptions } from '@/features/ui/ExerciseOptions';
import { SuggestedDays } from '@/features/ui/SuggestedDays';
import { ICON_STROKE, WELL, alert, chip } from '@/features/ui/styles';
import { useAsyncAction } from '@/features/ui/useAsyncAction';
import { cn } from '@/lib/utils';

const UNITS = [
  { value: 'kg' as Unit, label: 'kg' },
  { value: 'lb' as Unit, label: 'lb' },
];

const PREVIEW_ID = toId<WorkoutId>('preview');

interface AddWorkoutFormProps {
  readonly routineId: RoutineId;
  readonly routineWeeks: number;
  readonly routineCreatedAt: number;
  readonly siblings: readonly Workout[];
  readonly today: LocalDate;
}

export function AddWorkoutForm({
  routineId,
  routineWeeks,
  routineCreatedAt,
  siblings,
  today,
}: AddWorkoutFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [days, setDays] = useState<readonly Weekday[]>([]);
  const [written, setWritten] = useState<number | null>(null);
  const { busy, failure, run } = useAsyncAction();

  const weeks = remainingWeeks(
    routineWeeks,
    formatLocalDate(new Date(routineCreatedAt)),
    today,
  );

  const preview = useMemo(
    () =>
      generatePlacements({
        workouts: [{ id: PREVIEW_ID, routineId, name, suggestedDays: days, order: 0 }],
        weeks,
        anchorDate: today,
      }),
    [routineId, name, days, weeks, today],
  );

  const collisions = days
    .map((day) => ({ day, claimants: claimantsOfDay(siblings, day) }))
    .filter((entry) => entry.claimants.length > 0);

  const emptyReason =
    weeks === 0
      ? 'This block has no weeks left, so no sessions will be placed.'
      : days.length === 0
        ? 'No day is selected, so no sessions will be placed.'
        : `Every ${days.length === 1 ? 'occurrence' : 'remaining occurrence'} of ${days
            .map(weekdayName)
            .join(' and ')} has already gone by in this block, so no sessions will be placed.`;

  function save() {
    void run(async () => {
      const added = await addWorkoutToRoutine(routineId, {
        name,
        suggestedDays: days,
        today,
      });
      setWritten(added.placementCount);
      setName('');
      setDays([]);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        {written !== null && (
          <p className="type-body-sm text-planned-ink">
            Workout added, with {written === 0 ? 'no' : written} session
            {written === 1 ? '' : 's'} placed.
          </p>
        )}
        <Button
          onClick={() => {
            // Or the last confirmation outlives what it confirmed, still
            // sitting above the form the next time it is opened.
            setWritten(null);
            setOpen(true);
          }}
          size="block"
          type="button"
          variant="secondary"
        >
          <CalendarPlus aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          Add a Workout
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(WELL, 'arrive')}>
      <TextField
        autoFocus
        id="add-workout-name"
        label="workout name"
        onCommit={setName}
        placeholder="Pull"
        value={name}
      />

      <SuggestedDays
        conflicted={(day) => claimantsOfDay(siblings, day).length > 0}
        label="suggested days"
        onToggle={(day) =>
          setDays((chosen) =>
            chosen.includes(day) ? chosen.filter((d) => d !== day) : [...chosen, day],
          )
        }
        selected={days}
        showLabel
      />

      {collisions.map(({ day, claimants }) => (
        <p className={alert('missed')} key={day} role="status">
          <TriangleAlert aria-hidden="true" className="mr-1.5 inline" size={14} strokeWidth={ICON_STROKE} />
          {claimants.map((w) => w.name).join(' and ')} already claim{claimants.length === 1 ? 's' : ''}{' '}
          {weekdayName(day)}. Today will suggest {claimants[0]!.name} on that day, and this
          Workout stays reachable from the Workout strip — but on every {weekdayName(day)} you
          train only one of them, so the other reads as a missed day, every week, until you move
          or delete that session on the calendar.
        </p>
      ))}

      <p className="type-body-sm text-ink-2">
        {preview.length > 0
          ? `${preview.length} session${preview.length === 1 ? '' : 's'} will be placed, ${preview[0]!.date} → ${preview[preview.length - 1]!.date}.`
          : `${emptyReason} ${STILL_ADDED}`}
      </p>

      {failure !== null && (
        <p className={alert('missed')} role="alert">
          {failure}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button disabled={busy || name.trim() === ''} onClick={save} type="button">
          {busy ? 'Adding…' : 'Add Workout'}
        </Button>
        <Button
          onClick={() => {
            setName('');
            setDays([]);
            setOpen(false);
          }}
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface AddPlannedExerciseFormProps {
  readonly workoutId: WorkoutId;
  readonly workoutName: string;
  readonly defaultUnit: Unit;
}

/** The tail every empty preview shares. */
const STILL_ADDED = 'The Workout is still added, and you can train it any day from Today.';

const INITIAL_TARGETS = {
  sets: 3,
  minReps: 8,
  maxReps: 12,
  minTarget: 30,
  maxTarget: 60,
  minRir: null as number | null,
  maxRir: null as number | null,
  restSeconds: 120 as number | null,
};

function draftFileWithTarget(file: RoutineFile, target: { min: number; max: number }): RoutineFile {
  const workout = file.routine.workouts[0]!;
  const exercise = workout.exercises[0]!;
  return {
    ...file,
    version: 2,
    routine: {
      ...file.routine,
      workouts: [{ ...workout, exercises: [{ ...exercise, reps: undefined, target }] }],
    },
  };
}

export function AddPlannedExerciseForm({
  workoutId,
  workoutName,
  defaultUnit,
}: AddPlannedExerciseFormProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Exercise | null>(null);
  const [targets, setTargets] = useState(INITIAL_TARGETS);
  const [pickedUnit, setPickedUnit] = useState<Unit | null>(null);
  const unit = pickedUnit ?? defaultUnit;
  const [increment, setIncrement] = useState<number | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const { busy, failure, run } = useAsyncAction();

  const userExercises = useUserExercises();

  const candidates = useMemo(() => {
    const needle = normalizeExerciseName(query);
    const all: readonly Exercise[] = [...(userExercises ?? []), ...CATALOG];
    // The cut itself belongs to `ExerciseOptions`, which the wizard's picker
    // shares, so the two lists cannot end at different lengths again.
    return needle === ''
      ? all
      : all.filter((exercise) => normalizeExerciseName(exercise.name).includes(needle));
  }, [query, userExercises]);

  const progression: ProgressionRule =
    increment === null ? { type: 'manual' } : { type: 'double_progression', increment };

  const draft: PlannedExerciseDraft = {
    name: chosen?.name ?? '',
    sets: targets.sets,
    minReps: targets.minReps,
    maxReps: targets.maxReps,
    minRir: targets.minRir,
    maxRir: targets.maxRir,
    restSeconds: targets.restSeconds,
    unit,
    progression,
  };

  const repsAxis = chosen === null || targetsReps(chosen.measurement);

  const file =
    chosen === null
      ? null
      : repsAxis
        ? plannedExerciseDraftFile(draft, workoutName)
        : draftFileWithTarget(plannedExerciseDraftFile(draft, workoutName), {
            min: targets.minTarget,
            max: targets.maxTarget,
          });
  const issues = file === null ? [] : validateRoutineFile(file);

  const errorFor = (segment: string): string | null => {
    const issue = issues.find((entry) => entry.paths.some((path) => path[path.length - 1] === segment));
    return issue === undefined
      ? null
      : describeIssue(issue, file?.routine.workouts[0]?.exercises[0]);
  };

  const refusals = plannedExerciseDraftRefusals(draft);
  const refused = refusals.rir !== null || refusals.increment !== null;

  function close() {
    setChosen(null);
    setQuery('');
    setTargets(INITIAL_TARGETS);
    setPickedUnit(null);
    setIncrement(null);
    setOpen(false);
  }

  function save() {
    if (chosen === null || refused) return;
    void run(async () => {
      const name = chosen.name;
      await addPlannedExercise(workoutId, {
        exerciseId: chosen.id,
        sets: targets.sets,
        minReps: repsAxis ? targets.minReps : null,
        maxReps: repsAxis ? targets.maxReps : null,
        minTarget: repsAxis ? null : targets.minTarget,
        maxTarget: repsAxis ? null : targets.maxTarget,
        minRir: targets.minRir,
        maxRir: targets.maxRir,
        restSeconds: targets.restSeconds,
        unit,
        focus: null,
        notes: [],
        progression,
      });
      setAdded(name);
      close();
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        {added !== null && (
          <p className="type-body-sm text-actual-ink" role="status">
            {added} added to {workoutName}.
          </p>
        )}
        <Button
          aria-label={`Add an exercise to ${workoutName}`}
          onClick={() => {
            setAdded(null);
            setOpen(true);
          }}
          size="block"
          type="button"
          variant="secondary"
        >
          <Plus aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          Add an exercise
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-rule pt-4">
      {chosen === null ? (
        <>
          <TextField
            autoFocus
            id={`add-planned-${workoutId}`}
            label={`add to ${workoutName}`}
            onCommit={setQuery}
            placeholder="Search the catalog and your exercises"
            value={query}
          />
          <p className="type-caption text-ink-2">
            <Dumbbell aria-hidden="true" className="mr-1.5 inline" size={13} strokeWidth={ICON_STROKE} />
            Only exercises that already exist. Create a new one on the Exercises screen first.
          </p>
          <ExerciseOptions
            onPick={setChosen}
            options={candidates.map((exercise) => ({
              key: exercise.id,
              name: exercise.name,
              value: exercise,
            }))}
          />
          {/* Without this the only ways out of an opened picker were choosing a
              an exercise or leaving the screen, unlike every sibling form here. */}
          <div>
            <Button onClick={close} type="button" variant="ghost">
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className={chip('planned')}>{chosen.name}</span>
            <Button onClick={() => setChosen(null)} size="compact" type="button" variant="quiet">
              Change
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              error={errorFor('sets')}
              id={`add-planned-sets-${workoutId}`}
              label="sets"
              onCommit={(value) => setTargets({ ...targets, sets: value ?? 0 })}
              value={targets.sets}
            />
            <NumberField
              error={errorFor('rest_seconds')}
              id={`add-planned-rest-${workoutId}`}
              label="rest (s)"
              onCommit={(value) => setTargets({ ...targets, restSeconds: value ?? null })}
              optional
              value={targets.restSeconds ?? undefined}
            />
            {repsAxis ? (
              <>
                <NumberField
                  error={errorFor('reps')}
                  id={`add-planned-min-reps-${workoutId}`}
                  label="min reps"
                  onCommit={(value) => setTargets({ ...targets, minReps: value ?? targets.minReps })}
                  value={targets.minReps}
                />
                <NumberField
                  id={`add-planned-max-reps-${workoutId}`}
                  label="max reps"
                  onCommit={(value) => setTargets({ ...targets, maxReps: value ?? targets.maxReps })}
                  value={targets.maxReps}
                />
              </>
            ) : (
              <>
                <NumberField
                  error={errorFor('target')}
                  id={`add-planned-min-target-${workoutId}`}
                  label={`min ${targetUnitOf(chosen.measurement)}`}
                  onCommit={(value) =>
                    setTargets({ ...targets, minTarget: value ?? targets.minTarget })
                  }
                  value={targets.minTarget}
                />
                <NumberField
                  id={`add-planned-max-target-${workoutId}`}
                  label={`max ${targetUnitOf(chosen.measurement)}`}
                  onCommit={(value) =>
                    setTargets({ ...targets, maxTarget: value ?? targets.maxTarget })
                  }
                  value={targets.maxTarget}
                />
              </>
            )}
            <NumberField
              error={targets.minRir === null ? refusals.rir : errorFor('rir')}
              id={`add-planned-min-rir-${workoutId}`}
              label="min RIR"
              onCommit={(value) => setTargets({ ...targets, minRir: value ?? null })}
              optional
              value={targets.minRir ?? undefined}
            />
            <NumberField
              error={targets.maxRir === null ? refusals.rir : null}
              id={`add-planned-max-rir-${workoutId}`}
              label="max RIR"
              onCommit={(value) => setTargets({ ...targets, maxRir: value ?? null })}
              optional
              value={targets.maxRir ?? undefined}
            />
            <SelectField
              id={`add-planned-unit-${workoutId}`}
              label="unit"
              onCommit={setPickedUnit}
              options={UNITS}
              value={unit}
            />
            <NumberField
              error={refusals.increment}
              id={`add-planned-increment-${workoutId}`}
              label={`increment (${unit})`}
              onCommit={(value) => setIncrement(value ?? null)}
              optional
              value={increment ?? undefined}
            />
          </div>

          <p className="type-caption text-ink-2">
            An increment makes this double progression: when every planned set reaches max reps,
            the next suggestion is this much heavier. Leave it blank for manual.
          </p>

          {failure !== null && (
            <p className={alert('missed')} role="alert">
              {failure}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button disabled={busy || issues.length > 0 || refused} onClick={save} type="button">
              {busy ? 'Adding…' : 'Add exercise'}
            </Button>
            <Button onClick={close} type="button" variant="ghost">
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
