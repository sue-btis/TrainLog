/**
 * The two additive verbs a Routine already running accepts (REQ-400…414).
 *
 * DEC-B amends "Routines are immutable once accepted" rather than revoking it:
 * a Workout may be added, and a Planned Exercise may be added to one, and
 * nothing already stored is renamed, reordered, retargeted or removed. What
 * makes that safe is ADR 0002 — a Session snapshots its planned targets when an
 * exercise starts, so no past training is read back through these rows.
 *
 * Both forms live on the **active** Routine only. An archived Routine's detail
 * screen stays read-only, because the calendar reads Placements across every
 * Routine and one generated into an archived Routine would appear as work the
 * lifter never scheduled. The writers enforce it too (REQ-414): this is the
 * affordance, not the rule.
 */

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

/** A fabricated Workout id, for previewing Placements before one exists. */
const PREVIEW_ID = toId<WorkoutId>('preview');

interface AddWorkoutFormProps {
  readonly routineId: RoutineId;
  readonly routineWeeks: number;
  readonly routineCreatedAt: number;
  readonly siblings: readonly Workout[];
  readonly today: LocalDate;
}

/**
 * Adding a Workout, with the consequences stated before the save (REQ-402…406).
 *
 * The preview is `generatePlacements` over `remainingWeeks` — the same two pure
 * functions the writer runs, on the same inputs. It is deliberately not the
 * same *call*: the writer needs a stored Workout row and mints a real
 * `PlacementId` per Placement, so this fabricates an id and runs the pair
 * separately, exactly as the import wizard's own step-2 preview does. If the
 * in-transaction read disagrees, the write proceeds and the confirmation
 * reports what was actually written (REQ-404).
 */
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

  // REQ-403 asks the preview to name the reason it is empty, and there are
  // three — not two. The third is the one the old pair got wrong: in the last
  // week of a block, a day that has already gone by places nothing, and saying
  // "no day is selected" while that day sits lit in `aria-pressed` just above
  // reads as a bug in the form rather than an answer.
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
        // The functional form for the reason `state.ts` gives about `weeksBy`:
        // computing the next set from the render's own `days` loses a tap when
        // two land before React has re-rendered between them.
        onToggle={(day) =>
          setDays((chosen) =>
            chosen.includes(day) ? chosen.filter((d) => d !== day) : [...chosen, day],
          )
        }
        selected={days}
        showLabel
      />

      {/* REQ-405, REQ-406 — a warning, never a refusal, and it owes the lifter
          the full consequence: not just "Push already has Monday" but what that
          costs every remaining week if they leave it. */}
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

      {/* REQ-403, REQ-404 — what the save will actually do, before it does it. */}
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
  // The non-rep target range (REQ-138), in the axis's canonical unit — which is
  // `targetUnitOf`'s to say, not this file's. Only one of the two pairs is ever
  // read, decided by the chosen Exercise's measurement and never by which of
  // them happens to hold a number (REQ-139), so both can carry a starting
  // value: a range the lifter will overtype, not a claim about the movement.
  minTarget: 30,
  maxTarget: 60,
  minRir: null as number | null,
  maxRir: null as number | null,
  restSeconds: 120 as number | null,
};

/**
 * The synthetic file `validateRoutineFile` reads, with the target range in
 * place of the rep range for a type that states no reps (REQ-139).
 *
 * `plannedExerciseDraftFile` writes a rep range and only a rep range, and it
 * lives in `domain/`, which this form does not write. So the one node that
 * differs is replaced on the way out rather than a second synthetic file being
 * built beside it — the rest of the draft, and every rule the validator applies
 * to it, stays the one the wizard shares. Declaring `version: 2` because a
 * target range is what version 2 added; dropping `reps` because an exercise
 * states one range or the other, never both.
 */
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

/**
 * Adding a Planned Exercise to a Workout that is already stored (REQ-407…410).
 *
 * The Exercise must already exist — catalog or the lifter's own. This flow
 * creates none, which is what keeps it clear of §26 entirely: there is no name
 * to match here, only an id that was already resolved, so there is no matching
 * to get wrong.
 *
 * The entered targets are checked by `validateRoutineFile` through
 * `plannedExerciseDraftFile`, not by a second set of rules written for this
 * form. Progression is a closed choice over the two the engine implements, so
 * `progression_unrecognized` is unreachable without a validator at all.
 */
export function AddPlannedExerciseForm({
  workoutId,
  workoutName,
  defaultUnit,
}: AddPlannedExerciseFormProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Exercise | null>(null);
  const [targets, setTargets] = useState(INITIAL_TARGETS);
  // Only the lifter's own pick is state. Seeding it from `defaultUnit` froze
  // whatever the first render happened to see, and `useSettings` resolves a
  // tick later than this form mounts — so a lifter who trains in pounds got a
  // form in kilos, every time, with no way to tell it was a default and not
  // their setting.
  const [pickedUnit, setPickedUnit] = useState<Unit | null>(null);
  const unit = pickedUnit ?? defaultUnit;
  const [increment, setIncrement] = useState<number | null>(null);
  // What the last save actually added. Its sibling `AddWorkoutForm` has always
  // reported; this form closed in silence and left the lifter to notice a new
  // row above it, which is feedback only if they happen to be looking there.
  const [added, setAdded] = useState<string | null>(null);
  const { busy, failure, run } = useAsyncAction();

  const userExercises = useUserExercises();

  const candidates = useMemo(() => {
    const needle = normalizeExerciseName(query);
    // The lifter's own exercises first. Catalog-first with a cut at forty put
    // all 96 catalog entries ahead of them, so an exercise created minutes ago
    // was unreachable by scrolling — under a caption telling you to go create
    // one. `ExercisePicker` already settled this ordering.
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

  // Which pair of targets this movement is programmed in (REQ-139). Read off
  // the chosen Exercise's declared measurement — the only thing that decides
  // it — and answered for no Exercise at all only because the fields below are
  // not on screen until one is bound.
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

  // Issues come back rooted at the synthetic file, so a form field finds its own
  // by the path's trailing segment rather than by the Workout indices between.
  //
  // The message goes through `describeIssue`, the same as the wizard's fields:
  // `issue.message` names the file path a lifter on this screen never saw, and
  // stops at the problem — the sentence that says what to do about it is the
  // half that matters under a field.
  const errorFor = (segment: string): string | null => {
    const issue = issues.find((entry) => entry.paths.some((path) => path[path.length - 1] === segment));
    return issue === undefined
      ? null
      : describeIssue(issue, file?.routine.workouts[0]?.exercises[0]);
  };

  // The two shapes the validator's closed code union cannot state, and that the
  // wizard's path cannot produce either — a half RIR range and an increment
  // that does not increase (F-1, F-2).
  const refusals = plannedExerciseDraftRefusals(draft);
  const refused = refusals.rir !== null || refusals.increment !== null;

  // Cancel used to leave `query`, `targets` and `increment` behind, so
  // reopening preloaded a half-finished attempt the lifter had walked away
  // from. Closing forgets it, the same way saving does.
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
        // Exactly one pair is written, and the measurement decides which
        // (REQ-139, AC-164, AC-165). The other is `null` — not zero, and not
        // the number the unused fields still hold in state.
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
            {/* The range this movement is programmed in, and only that one
                (REQ-134, AC-155): a plank collects no rep range, because it has
                none to collect. The caption comes from `targetUnitOf`, so the
                unit a duration or a distance target is stated in is said in
                `measurement.ts` and nowhere else (REQ-102). A distance is
                entered in its canonical metres — the value stored — rather than
                in kilometres over a conversion this form would then be the
                second place to state. */}
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
