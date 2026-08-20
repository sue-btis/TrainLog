/**
 * Today (§11.4) — the screen the app opens on.
 *
 * The suggestion resolves exactly as §11.4 states: a Placement for today names
 * the Workout; with none, the next Workout in the file's rotation after the
 * last one performed. Both are domain decisions already made and tested; this
 * screen only asks.
 *
 * A day without a Placement is not a blocked day, so the Workout selector is
 * always there. And the suggestion is a suggestion — nothing here writes.
 *
 * There is no `Start workout` yet: the execution screen is the next change, and
 * a button that cannot start anything would be a worse answer than its absence.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { Activity, FileUp, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatLocalDate } from '@/domain/dates';
import type { WorkoutId } from '@/domain/ids';
import { estimateDuration, nextWorkoutInRotation } from '@/domain/scheduling';
import type { Session, Workout } from '@/domain/types';
import {
  useActiveRoutine,
  useExerciseNames,
  useInProgressSession,
  useLastPerformedWorkout,
  usePlacementsBetween,
  usePlannedExercises,
  useSessionsByRoutine,
  useWorkouts,
} from '@/features/data/queries';
import { longDate, plural, programmingLine, shortDate } from '@/features/ui/format';
import {
  ICON_STROKE,
  LABEL,
  ROW,
  ROW_LIST,
  WELL,
  alert,
  chip,
} from '@/features/ui/styles';

export function TodayScreen() {
  const today = formatLocalDate(new Date());
  const routine = useActiveRoutine();
  const routineId = routine?.id ?? null;

  const workouts = useWorkouts(routineId) ?? [];
  const todaysPlacements = usePlacementsBetween(today, today) ?? [];
  const lastPerformed = useLastPerformedWorkout(routineId) ?? null;
  const open = useInProgressSession();
  const sessions = useSessionsByRoutine(routineId) ?? [];

  const [picked, setPicked] = useState<WorkoutId | null>(null);
  const suggested = suggestWorkout(workouts, todaysPlacements.map((p) => p.workoutId), lastPerformed);
  const shown = workouts.find((workout) => workout.id === picked) ?? suggested;
  const placed = todaysPlacements.some((placement) => placement.workoutId === shown?.id);

  return (
    <>
      {open !== undefined && (
        <div className={alert('planned')}>
          <Activity aria-hidden="true" className="mt-0.5 shrink-0" size={18} strokeWidth={ICON_STROKE} />
          <div className="flex flex-col gap-1">
            <p className="type-title">A session is still open</p>
            <p className="type-body-sm">
              Started {shortDate(formatLocalDate(new Date(open.startedAt)))}. Until the
              training screen exists, it can be finished from the harness.
            </p>
            <Link className="type-body-sm underline underline-offset-4" to="/harness">
                Open the harness
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <p className="type-lede text-ink-2">{longDate(today)}</p>
        {routine !== undefined && <p className="type-lot text-ink-3">{routine.name}</p>}
      </div>

      {routine === undefined ? (
        <NoRoutine />
      ) : shown === null ? (
        <section className={WELL}>
          <p className="type-title">{routine.name} has no Workouts</p>
          <p className="type-body-sm text-ink-2">
            Import a routine file that declares at least one Workout.
          </p>
        </section>
      ) : (
        <>
          <h2 className="type-display">{shown.name}</h2>
          <p className="type-measure text-ink-3">
            {placed ? 'planned for today' : 'next in rotation'}
          </p>

          {/* Radix owns the strip: arrow keys move between Workouts, and what
              is shown below is the panel of the one that is selected. */}
          <Tabs onValueChange={(value) => setPicked(value as WorkoutId)} value={shown.id}>
            {workouts.length > 1 && (
              <TabsList aria-label="Workouts">
                {workouts.map((workout) => (
                  <TabsTrigger key={workout.id} value={workout.id}>
                    {workout.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            )}

            <TabsContent value={shown.id}>
              <WorkoutCard workout={shown} />
              <LastSession sessions={sessions} workoutId={shown.id} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </>
  );
}

function NoRoutine() {
  return (
    <section className={WELL}>
      <FileUp aria-hidden="true" className="text-ink-3" size={24} strokeWidth={ICON_STROKE} />
      <p className="type-title">No active routine</p>
      <p className="type-body-sm text-ink-2">
        TrainLog runs the programme you give it. Import a routine file and today will know
        what to train.
      </p>
      <Button asChild size="block" variant="primary">
        <Link to="/import">
          Import a routine
        </Link>
      </Button>
    </section>
  );
}

function WorkoutCard({ workout }: { readonly workout: Workout }) {
  const exercises = usePlannedExercises(workout.id) ?? [];
  const names = useExerciseNames(exercises.map((exercise) => exercise.exerciseId));

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <span className={chip('planned')}>{plural(exercises.length, 'exercise')}</span>
        {exercises.length > 0 && (
          <span className={chip('neutral')}>
            <Timer aria-hidden="true" size={12} strokeWidth={ICON_STROKE} />~
            {estimateDuration(exercises)} min
          </span>
        )}
      </div>

      {exercises.length === 0 ? (
        <p className="type-body-sm text-ink-2">This Workout has no exercises.</p>
      ) : (
        <div className={ROW_LIST}>
          {exercises.map((exercise, index) => (
            <article className={ROW} key={exercise.id}>
              <div className="flex items-start gap-3">
                <span className="type-measure-sm text-ink-3">{index + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="type-title">{names?.get(exercise.exerciseId) ?? '…'}</span>
                  <span className="type-measure-sm text-ink-3">{programmingLine(exercise)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

/** The last time this Workout was trained — §11.4's "última sesión". */
function LastSession({
  sessions,
  workoutId,
}: {
  readonly sessions: readonly Session[];
  readonly workoutId: WorkoutId;
}) {
  // `listSessionsByRoutine` returns newest first, so the first match is the last one.
  const last = sessions.find((session) => session.workoutId === workoutId);

  return (
    <section className={WELL}>
      <span className={LABEL}>last time</span>
      {last === undefined ? (
        <p className="type-body-sm text-ink-2">
          You have not trained this Workout yet. Its first session will show up here.
        </p>
      ) : (
        <p className="type-body-sm text-ink">
          {shortDate(formatLocalDate(new Date(last.startedAt)))} · {last.status.replace('_', ' ')}
        </p>
      )}
    </section>
  );
}

/**
 * §11.4's resolution, in one place: a Placement for today names the Workout,
 * otherwise the rotation advances from the last one performed.
 */
function suggestWorkout(
  workouts: readonly Workout[],
  placedToday: readonly WorkoutId[],
  lastPerformed: WorkoutId | null,
): Workout | null {
  const planned = workouts.find((workout) => placedToday.includes(workout.id));
  return planned ?? nextWorkoutInRotation(workouts, lastPerformed);
}
