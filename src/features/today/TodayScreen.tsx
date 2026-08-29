import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Activity, CalendarX, CheckCircle2, FileUp, LoaderCircle, Play, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createStartedWorkout } from '@/db';
import { addDays, formatLocalDate } from '@/domain/dates';
import type { ExerciseId, WorkoutId } from '@/domain/ids';
import { estimateDuration, isMissed, nextWorkoutInRotation } from '@/domain/scheduling';
import { startWorkout } from '@/domain/session';
import { movesBodyweight, type Measurement } from '@/domain/measurement';
import type { PlannedExercise, Session, Workout } from '@/domain/types';
import {
  useActiveRoutine,
  useExerciseMeasurements,
  useExerciseNames,
  useInProgressSession,
  useLastPerformedWorkout,
  usePlacementsBetween,
  usePlannedExercises,
  useSessionsByRoutine,
  useSettings,
  useWorkouts,
} from '@/features/data/queries';
import { ImportRoutineButton } from '@/features/import/ImportRoutineButton';
import { Reading } from '@/features/ui/Reading';
import { useAsyncAction } from '@/features/ui/useAsyncAction';
import {
  longDate,
  plural,
  programmingLine,
  sessionStatusLabel,
  shortDate,
} from '@/features/ui/format';
import {
  BUTTON_BASE,
  BUTTON_SIZE,
  BUTTON_VARIANT,
  FOCUS_RING,
  ICON_STROKE,
  LABEL,
  PRESS,
  ROW,
  ROW_LIST,
  WELL,
  alert,
  chip,
} from '@/features/ui/styles';
import { cn } from '@/lib/utils';

const MISSED_WINDOW_DAYS = 28;

export function TodayScreen() {
  const navigate = useNavigate();
  const today = formatLocalDate(new Date());
  const routine = useActiveRoutine();
  const routineId = routine?.id ?? null;

  const workouts = useWorkouts(routineId) ?? [];
  const todaysPlacements = usePlacementsBetween(today, today) ?? [];
  const recentPlacements = usePlacementsBetween(addDays(today, -MISSED_WINDOW_DAYS), today) ?? [];
  const lastPerformed = useLastPerformedWorkout(routineId) ?? null;
  const open = useInProgressSession();
  const sessions = useSessionsByRoutine(routineId) ?? [];

  const [picked, setPicked] = useState<WorkoutId | null>(null);
  const { busy, failure, run } = useAsyncAction();
  const suggested = suggestWorkout(workouts, todaysPlacements.map((p) => p.workoutId), lastPerformed);
  const shown = workouts.find((workout) => workout.id === picked) ?? suggested;
  const placed = todaysPlacements.some((placement) => placement.workoutId === shown?.id);

  const recordedToday =
    shown === null
      ? undefined
      : sessions.find(
          (session) =>
            session.workoutId === shown.id &&
            session.status !== 'in_progress' &&
            formatLocalDate(new Date(session.startedAt)) === today,
        );

  const missed = recentPlacements.filter((placement) => isMissed(placement, sessions, today));

  return (
    <>
      {open !== undefined && (
        <div className={alert('planned')}>
          <Activity aria-hidden="true" className="mt-0.5 shrink-0" size={18} strokeWidth={ICON_STROKE} />
          <div className="flex flex-col gap-1">
            <p className="type-title">A session is still open</p>
            <p className="type-body-sm">
              Started {shortDate(formatLocalDate(new Date(open.startedAt)))}. Pick it up
              where you left off — every set you logged is still there.
            </p>
            <Link className="type-body-sm underline underline-offset-4" to="/session">
              Resume session
            </Link>
          </div>
        </div>
      )}

      {missed.length > 0 && (
        // A whole banner that navigates, and it answered a thumb with nothing.
        <Link className={cn(alert('missed'), PRESS, FOCUS_RING)} to="/calendar">
          <CalendarX aria-hidden="true" className="mt-0.5 shrink-0" size={18} strokeWidth={ICON_STROKE} />
          <div className="flex flex-col gap-1">
            <p className="type-title">
              {plural(missed.length, 'planned day')} went untrained
            </p>
            <p className="type-body-sm">
              They are still on the calendar, where you can move them to a day you will
              train. Nothing is recorded against you for them.
            </p>
          </div>
        </Link>
      )}

      <div className="flex flex-col gap-1">
        <p className="type-lede text-ink-2">{longDate(today)}</p>
        {routine !== undefined && routine !== null && (
          <p className="type-lot text-ink-3">{routine.name}</p>
        )}
      </div>

      {failure !== null && (
        <p className="arrive type-measure text-missed-ink" role="alert">
          {failure}
        </p>
      )}

      {routine === undefined ? (
        <Reading>today</Reading>
      ) : routine === null ? (
        <NoRoutine />
      ) : shown === null ? (
        <section className={WELL}>
          <p className="type-title">{routine.name} has no Workouts</p>
          <p className="type-body-sm text-ink-2">
            Add one on this routine&rsquo;s own screen, or import a routine that declares
            at least one.
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
              <WorkoutCard
                busy={busy}
                onStart={(exercises, measurementOf) =>
                  void run(async () => {
                    await createStartedWorkout(
                      startWorkout({
                        routineId: routine.id,
                        workoutId: shown.id,
                        planned: exercises,
                        measurementOf,
                        startedAt: Date.now(),
                      }),
                    );
                    await navigate('/session');
                  })
                }
                open={open !== undefined}
                recordedToday={recordedToday}
                workout={shown}
              />
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
        Give today a programme to work from — import a routine file, or build one here.
      </p>
      <ImportRoutineButton>Import a routine</ImportRoutineButton>
      <Link
        className={cn(BUTTON_BASE, BUTTON_VARIANT.secondary, BUTTON_SIZE.block)}
        to="/import?new=1"
      >
        Start from scratch
      </Link>
    </section>
  );
}

interface WorkoutCardProps {
  readonly workout: Workout;
  readonly open: boolean;
  readonly recordedToday: Session | undefined;
  /** Whether the start is already in flight — the control it belongs to says so. */
  readonly busy: boolean;
  readonly onStart: (
    exercises: readonly PlannedExercise[],
    measurementOf: (exerciseId: ExerciseId) => Measurement,
  ) => void;
}

function WorkoutCard({ workout, open, recordedToday, busy, onStart }: WorkoutCardProps) {
  const planned = usePlannedExercises(workout.id);
  const exercises = planned ?? [];
  const names = useExerciseNames(exercises.map((exercise) => exercise.exerciseId));
  const measurements = useExerciseMeasurements(exercises.map((exercise) => exercise.exerciseId));
  const settings = useSettings();
  const measurementOf = (id: ExerciseId): Measurement =>
    measurements?.get(id) ?? 'weight_reps';

  const bodyweightUnknown =
    settings !== undefined &&
    settings.bodyweightKg === null &&
    measurements !== undefined &&
    exercises.some((exercise) => movesBodyweight(measurementOf(exercise.exerciseId)));

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        {planned !== undefined && (
          <span className={chip('planned')}>{plural(exercises.length, 'exercise')}</span>
        )}
        {exercises.length > 0 && (
          <span className={chip('neutral')}>
            <Timer aria-hidden="true" size={12} strokeWidth={ICON_STROKE} />~
            {estimateDuration(exercises)} min
          </span>
        )}
      </div>

      {bodyweightUnknown && (
        <p className="type-body-sm text-ink-2" role="status">
          This Session has exercises measured against your bodyweight, and the app
          has never been told yours.{' '}
          <Link className="underline" to="/settings">
            Set it in Settings
          </Link>
          .
        </p>
      )}

      {planned === undefined ? (
        <p className="type-body-sm text-ink-2">Reading the exercises…</p>
      ) : exercises.length === 0 ? (
        <p className="type-body-sm text-ink-2">This Workout has no exercises.</p>
      ) : (
        <div className={ROW_LIST}>
          {exercises.map((exercise, index) => (
            <article className={ROW} key={exercise.id}>
              <div className="flex items-start gap-3">
                <span className="type-measure-sm text-ink-3">{index + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="type-title">{names?.get(exercise.exerciseId) ?? '…'}</span>
                  <span className="type-measure-sm text-ink-3">{programmingLine(exercise, measurementOf(exercise.exerciseId))}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* The one control on this screen that writes. It sits at the bottom of
          the card because a lifter reads what they are about to do first. */}
      {open ? (
        <Button asChild size="block" variant="primary">
          <Link to="/session">
            <Play aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
            Resume session
          </Link>
        </Button>
      ) : recordedToday !== undefined ? (
        // Trained, and settled. The way to what happened is the primary control;
        // training it a second time in one day is legitimate but rare, so it
        // keeps a control rather than the control.
        <>
          <Button asChild size="block" variant="primary">
            <Link to={`/sessions/${recordedToday.id}`}>
              <CheckCircle2 aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
              Trained today — see the session
            </Link>
          </Button>
          <Button
            disabled={busy}
            onClick={() => onStart(exercises, measurementOf)}
            size="block"
            type="button"
            variant="quiet"
          >
            {busy ? 'Starting…' : 'Train it again'}
          </Button>
        </>
      ) : (
        <Button
          disabled={busy}
          onClick={() => onStart(exercises, measurementOf)}
          size="block"
          type="button"
          variant="primary"
        >
          {busy ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" size={20} strokeWidth={ICON_STROKE} />
          ) : (
            <Play aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
          )}
          {busy ? 'Starting…' : 'Start workout'}
        </Button>
      )}
    </Card>
  );
}

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
          {shortDate(formatLocalDate(new Date(last.startedAt)))} · {sessionStatusLabel(last.status)}
        </p>
      )}
    </section>
  );
}

function suggestWorkout(
  workouts: readonly Workout[],
  placedToday: readonly WorkoutId[],
  lastPerformed: WorkoutId | null,
): Workout | null {
  const planned = workouts.find((workout) => placedToday.includes(workout.id));
  return planned ?? nextWorkoutInRotation(workouts, lastPerformed);
}
