import { Link, useParams } from 'react-router';
import { Card } from '@/components/ui/card';
import { formatLocalDate } from '@/domain/dates';
import { toId, type RoutineId, type WorkoutId } from '@/domain/ids';
import type { Measurement } from '@/domain/measurement';
import type { PlannedExercise, Unit, Weekday } from '@/domain/types';
import {
  useExerciseMeasurements,
  useExerciseNames,
  usePlacements,
  usePlannedExercises,
  useRoutine,
  useSettings,
  useWorkouts,
} from '@/features/data/queries';
import { AddPlannedExerciseForm, AddWorkoutForm } from '@/features/routines/AddToRoutine';
import { plural, programmingLine, weekdayName } from '@/features/ui/format';
import {
  LABEL,
  ROW,
  ROW_LIST,
  WELL,
  chip,
} from '@/features/ui/styles';
import { Reading } from '@/features/ui/Reading';

export function RoutineDetailScreen() {
  const params = useParams();
  const routineId = params.routineId === undefined ? null : toId<RoutineId>(params.routineId);
  const routine = useRoutine(routineId);
  const routineWorkouts = useWorkouts(routineId);
  const routinePlacements = usePlacements(routineId);
  const counted = routineWorkouts !== undefined && routinePlacements !== undefined;
  const defaultUnit: Unit = useSettings()?.defaultUnit ?? 'kg';

  const workouts = routineWorkouts ?? [];
  const placements = routinePlacements ?? [];

  // Still reading. `null` below is the Routine that is not there; this is the
  // one that has not arrived, and a blank screen said neither.
  if (routine === undefined) return <Reading>this routine</Reading>;

  if (routine === null) {
    return (
      <section className={WELL}>
        <p className="type-title">No such routine</p>
        <p className="type-body-sm text-ink-2">
          It may have been deleted. Every routine you have, imported or built, is on the
          routines screen.
        </p>
      </section>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-3">
        <span className={chip(routine.status === 'active' ? 'actual' : 'neutral', 'self-start')}>
          {routine.status}
        </span>
        <h2 className="type-display">{routine.name}</h2>
        <p className="type-measure-sm text-ink-3">
          {plural(routine.weeks, 'week')}
          {counted &&
            ` · ${plural(workouts.length, 'workout')} · ${plural(placements.length, 'session')} placed`}
        </p>
      </header>

      {workouts.map((workout) => (
        <WorkoutCard
          active={routine.status === 'active'}
          defaultUnit={defaultUnit}
          key={workout.id}
          name={workout.name}
          suggestedDays={workout.suggestedDays}
          workoutId={workout.id}
        />
      ))}

      {routine.status === 'active' && (
        <AddWorkoutForm
          routineCreatedAt={routine.createdAt}
          routineId={routine.id}
          routineWeeks={routine.weeks}
          siblings={workouts}
          today={formatLocalDate(new Date())}
        />
      )}
    </>
  );
}

interface WorkoutCardProps {
  readonly workoutId: WorkoutId;
  readonly name: string;
  readonly suggestedDays: readonly Weekday[];
  readonly active: boolean;
  readonly defaultUnit: Unit;
}

function WorkoutCard({ workoutId, name, suggestedDays, active, defaultUnit }: WorkoutCardProps) {
  const planned = usePlannedExercises(workoutId);
  const exercises = planned ?? [];
  const names = useExerciseNames(exercises.map((exercise) => exercise.exerciseId));
  const measurements = useExerciseMeasurements(exercises.map((it) => it.exerciseId));

  return (
    <Card>
      <div className="flex flex-col gap-2">
        <h2 className="type-title">{name}</h2>
        <p className={LABEL}>
          {suggestedDays.length === 0
            ? 'no suggested day'
            : suggestedDays.map(weekdayName).join(' · ')}
        </p>
      </div>

      {planned === undefined ? (
        <p className="type-body-sm text-ink-2">Reading the exercises…</p>
      ) : exercises.length === 0 ? (
        <p className="type-body-sm text-ink-2">This Workout has no exercises.</p>
      ) : (
        <div className={ROW_LIST}>
          {exercises.map((exercise, index) => (
            <ExerciseRow
              exercise={exercise}
              key={exercise.id}
              measurement={measurements?.get(exercise.exerciseId) ?? 'weight_reps'}
              name={names?.get(exercise.exerciseId) ?? '…'}
              position={index + 1}
            />
          ))}
        </div>
      )}

      {active && (
        <AddPlannedExerciseForm
          defaultUnit={defaultUnit}
          workoutId={workoutId}
          workoutName={name}
        />
      )}
    </Card>
  );
}

interface ExerciseRowProps {
  readonly exercise: PlannedExercise;
  readonly measurement: Measurement;
  readonly name: string;
  readonly position: number;
}

function ExerciseRow({ exercise, measurement, name, position }: ExerciseRowProps) {
  return (
    <article className={ROW}>
      <div className="flex items-start gap-3">
        <span className="type-measure-sm text-ink-3">{position}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            className="type-title underline decoration-rule underline-offset-4"
            to={`/exercises/${exercise.exerciseId}`}
          >
            {name}
          </Link>
          <span className="type-measure-sm text-ink-3">
            {programmingLine(exercise, measurement)}
          </span>
          {exercise.focus !== null && (
            <span className="type-caption text-ink-2">{exercise.focus}</span>
          )}
        </div>
      </div>

      {exercise.notes.length > 0 && (
        <ul className="flex flex-col gap-1">
          {exercise.notes.map((note, index) => (
            <li className="type-caption text-ink-2" key={index}>
              {note}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
