/**
 * One Routine, read-only (§11.2, §31 Screen 5).
 *
 * It shows the programme as it was accepted: Workouts in rotation order, their
 * suggested days, and every Planned Exercise with its targets. Nothing here is
 * editable — a Routine is immutable once accepted (AGENTS.MD), and the
 * suggested days shown are the advisory ones read at import, not the calendar,
 * which is the user's and lives on its own screen.
 */

import { Link, useParams } from 'react-router';
import { Card } from '@/components/ui/card';
import { toId, type RoutineId, type WorkoutId } from '@/domain/ids';
import type { PlannedExercise, Weekday } from '@/domain/types';
import {
  useExerciseNames,
  usePlacements,
  usePlannedExercises,
  useRoutine,
  useWorkouts,
} from '@/features/data/queries';
import { plural, programmingLine, weekdayName } from '@/features/ui/format';
import {
  LABEL,
  ROW,
  ROW_LIST,
  WELL,
  chip,
} from '@/features/ui/styles';

export function RoutineDetailScreen() {
  const params = useParams();
  const routineId = params.routineId === undefined ? null : toId<RoutineId>(params.routineId);
  const routine = useRoutine(routineId);
  const workouts = useWorkouts(routineId) ?? [];
  const placements = usePlacements(routineId) ?? [];

  if (routine === undefined) return null; // still reading

  if (routine === null) {
    return (
      <section className={WELL}>
        <p className="type-title">No such routine</p>
        <p className="type-body-sm text-ink-2">
          It may have been deleted. Everything you have imported is on the routines
          screen.
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
          {plural(routine.weeks, 'week')} · {plural(workouts.length, 'workout')} ·{' '}
          {plural(placements.length, 'session')} placed
        </p>
      </header>

      {workouts.map((workout) => (
        <WorkoutCard key={workout.id} name={workout.name} suggestedDays={workout.suggestedDays} workoutId={workout.id} />
      ))}
    </>
  );
}

interface WorkoutCardProps {
  readonly workoutId: WorkoutId;
  readonly name: string;
  readonly suggestedDays: readonly Weekday[];
}

function WorkoutCard({ workoutId, name, suggestedDays }: WorkoutCardProps) {
  const exercises = usePlannedExercises(workoutId) ?? [];
  const names = useExerciseNames(exercises.map((exercise) => exercise.exerciseId));

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

      {exercises.length === 0 ? (
        <p className="type-body-sm text-ink-2">This Workout has no exercises.</p>
      ) : (
        <div className={ROW_LIST}>
          {exercises.map((exercise, index) => (
            <ExerciseRow
              exercise={exercise}
              key={exercise.id}
              name={names?.get(exercise.exerciseId) ?? '…'}
              position={index + 1}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

interface ExerciseRowProps {
  readonly exercise: PlannedExercise;
  readonly name: string;
  readonly position: number;
}

function ExerciseRow({ exercise, name, position }: ExerciseRowProps) {
  return (
    <article className={ROW}>
      <div className="flex items-start gap-3">
        <span className="type-measure-sm text-ink-3">{position}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* The name is the way into what this exercise has actually done
              (§11.10) — the programming beside it is only what was asked for. */}
          <Link
            className="type-title underline decoration-rule underline-offset-4"
            to={`/exercises/${exercise.exerciseId}`}
          >
            {name}
          </Link>
          <span className="type-measure-sm text-ink-3">{programmingLine(exercise)}</span>
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
