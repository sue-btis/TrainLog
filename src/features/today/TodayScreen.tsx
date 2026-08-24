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
 * `Start workout` is the one thing here that writes, and it writes the whole
 * session at once: the Session plus a snapshot of every planned exercise, in one
 * transaction (R-2). With a session already open it becomes `Resume session`,
 * because §35 recovers a session and never abandons one silently.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Activity, CalendarX, CheckCircle2, FileUp, LoaderCircle, Play, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createStartedWorkout } from '@/db';
import { addDays, formatLocalDate } from '@/domain/dates';
import type { WorkoutId } from '@/domain/ids';
import { estimateDuration, isMissed, nextWorkoutInRotation } from '@/domain/scheduling';
import { startWorkout } from '@/domain/session';
import type { PlannedExercise, Session, Workout } from '@/domain/types';
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

/** How far back Today looks for a planned day that went untrained. */
const MISSED_WINDOW_DAYS = 28;

export function TodayScreen() {
  const navigate = useNavigate();
  const today = formatLocalDate(new Date());
  const routine = useActiveRoutine();
  const routineId = routine?.id ?? null;

  const workouts = useWorkouts(routineId) ?? [];
  const todaysPlacements = usePlacementsBetween(today, today) ?? [];
  // Four weeks back, only so Today can say a planned day went untrained. The
  // calendar owns the full record; this is the one line that stops a missed day
  // from being invisible unless a lifter goes looking for it.
  const recentPlacements = usePlacementsBetween(addDays(today, -MISSED_WINDOW_DAYS), today) ?? [];
  const lastPerformed = useLastPerformedWorkout(routineId) ?? null;
  const open = useInProgressSession();
  const sessions = useSessionsByRoutine(routineId) ?? [];

  const [picked, setPicked] = useState<WorkoutId | null>(null);
  const { busy, failure, run } = useAsyncAction();
  const suggested = suggestWorkout(workouts, todaysPlacements.map((p) => p.workoutId), lastPerformed);
  const shown = workouts.find((workout) => workout.id === picked) ?? suggested;
  const placed = todaysPlacements.some((placement) => placement.workoutId === shown?.id);

  // A Session for this Workout, finished, today. Today used to offer "Start
  // workout" regardless — on the app's most-visited screen, for a Workout it
  // had already recorded an hour earlier, which is how a duplicate Session gets
  // made. An open Session is not this: `open` already has its own banner.
  const recordedToday =
    shown === null
      ? undefined
      : sessions.find(
          (session) =>
            session.workoutId === shown.id &&
            session.status !== 'in_progress' &&
            formatLocalDate(new Date(session.startedAt)) === today,
        );

  // Derived, never stored (ADR 0001) — the same `isMissed` the calendar reads.
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

      {/* `useActiveRoutine` answers `undefined` while it reads and `null` when
          there is nothing to read. One branch covering both is why the app
          used to open on "No active routine" for lifters who had one. */}
      {routine === undefined ? (
        <Reading>today</Reading>
      ) : routine === null ? (
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
              <WorkoutCard
                busy={busy}
                onStart={(exercises) =>
                  // R-2 — the Session and every snapshotted exercise are written
                  // in one transaction, so `/session` cannot arrive before the
                  // rows it reads exist. A refusal (REQ-058: another session is
                  // already open) surfaces through `failure` rather than being
                  // swallowed into a screen that silently did nothing.
                  void run(async () => {
                    await createStartedWorkout(
                      startWorkout({
                        routineId: routine.id,
                        workoutId: shown.id,
                        planned: exercises,
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
        Import a routine file and today will know what to train.
      </p>
      <ImportRoutineButton>Import a routine</ImportRoutineButton>
    </section>
  );
}

interface WorkoutCardProps {
  readonly workout: Workout;
  /** Whether a Session is already open — then the action is to resume, not start. */
  readonly open: boolean;
  /** A finished Session for this Workout, today, if there is one (§11.4). */
  readonly recordedToday: Session | undefined;
  /** Whether the start is already in flight — the control it belongs to says so. */
  readonly busy: boolean;
  readonly onStart: (exercises: readonly PlannedExercise[]) => void;
}

function WorkoutCard({ workout, open, recordedToday, busy, onStart }: WorkoutCardProps) {
  // The same distinction the screen above makes, one card down: `undefined` is
  // the read, `[]` is a Workout that really holds nothing. Collapsed into one,
  // this card opened on "0 exercises · This Workout has no exercises" for the
  // Workout it was about to list.
  const planned = usePlannedExercises(workout.id);
  const exercises = planned ?? [];
  const names = useExerciseNames(exercises.map((exercise) => exercise.exerciseId));

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

      {/* The bare sentence rather than `Reading`: that component brings a
          `WELL` with it, and a well inside a card is the nested surface
          DESIGN.md forbids (see `styles.ts`). */}
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
                  <span className="type-measure-sm text-ink-3">{programmingLine(exercise)}</span>
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
            onClick={() => onStart(exercises)}
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
          onClick={() => onStart(exercises)}
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
          {shortDate(formatLocalDate(new Date(last.startedAt)))} · {sessionStatusLabel(last.status)}
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
