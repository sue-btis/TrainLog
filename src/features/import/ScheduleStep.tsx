import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { parseLocalDate, type LocalDate } from '@/domain/dates';
import { toId, type RoutineId, type WorkoutId } from '@/domain/ids';
import type { RoutineFile, SemanticIssue } from '@/domain/routine-file';
import { generatePlacements } from '@/domain/scheduling';
import type { Routine, Weekday, Workout } from '@/domain/types';
import { describeIssue, fieldId, workoutPath } from '@/features/import/issues';
import { MAX_WEEKS, MIN_WEEKS } from '@/features/import/state';
import { SuggestedDays } from '@/features/ui/SuggestedDays';
import { FIELD_BASE, ICON_STROKE, LABEL, WELL, chip } from '@/features/ui/styles';

interface ScheduleStepProps {
  readonly file: RoutineFile;
  readonly issues: readonly SemanticIssue[];
  readonly today: LocalDate;
  readonly startDate: LocalDate;
  readonly onStartDate: (date: LocalDate) => void;
  /** The Routine this import will archive, if one is running. */
  readonly activeRoutine: Routine | null;
  readonly removeRemaining: boolean;
  readonly onRemoveRemaining: (remove: boolean) => void;
  readonly onWeeksBy: (delta: number) => void;
  readonly onToggleDay: (workoutIndex: number, day: Weekday) => void;
}

export function ScheduleStep({
  file,
  issues,
  today,
  startDate,
  onStartDate,
  activeRoutine,
  removeRemaining,
  onRemoveRemaining,
  onWeeksBy,
  onToggleDay,
}: ScheduleStepProps) {
  const weeks = file.routine.weeks;
  const placements = previewPlacements(file, startDate);
  const first = placements[0]?.date;
  const last = placements[placements.length - 1]?.date;

  const suggested = file.routine.workouts.some((workout) => workout.suggested_days.length > 0);

  return (
    <>
      <p className="type-lede text-ink-2">
        {suggested
          ? 'These are the days this routine suggests. Change them if your week looks different.'
          : 'Choose the days each Workout should fall on. You can move them on the calendar afterwards.'}
      </p>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <span className={LABEL}>weeks</span>
          <div className="flex items-center gap-3">
            <Button
              aria-label="One week fewer"
              disabled={weeks <= MIN_WEEKS}
              onClick={() => onWeeksBy(-1)}
              size="icon"
              type="button"
              variant="secondary"
            >
              <Minus aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
            </Button>
            <output
              aria-label={`${weeks} weeks`}
              className="min-w-14 rounded-field bg-well px-3 py-2 text-center type-readout"
            >
              {weeks}
            </output>
            <Button
              aria-label="One week more"
              disabled={weeks >= MAX_WEEKS}
              onClick={() => onWeeksBy(1)}
              size="icon"
              type="button"
              variant="secondary"
            >
              <Plus aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>start date</span>
          <input
            className={FIELD_BASE}
            min={today}
            onChange={(event) => onStartDate(event.target.value as LocalDate)}
            type="date"
            value={startDate}
          />
        </label>
        <p className="type-caption text-ink-3">
          The first day sessions can fall on. The weeks count from here.
        </p>
      </Card>

      {activeRoutine !== null && (
        <Card>
          <p className="type-body-sm text-ink">
            <strong>{activeRoutine.name}</strong> is your active Routine. Accepting this one
            will archive it; its history stays.
          </p>
          <label className="flex min-h-11 items-start gap-3">
            <input
              checked={removeRemaining}
              className="mt-1 size-5 shrink-0"
              onChange={(event) => onRemoveRemaining(event.target.checked)}
              type="checkbox"
            />
            <span className="type-body-sm text-ink">
              Remove its remaining sessions from the calendar (from today, {longDate(today)}).
              Days you already trained are kept.
            </span>
          </label>
        </Card>
      )}

      {file.routine.workouts.map((workout, index) => {
        const clash = issues.find(
          (issue) =>
            issue.code === 'suggested_day_shared' &&
            issue.paths.some((path) => path[1] === 'workouts' && path[2] === index),
        );
        const claimedElsewhere = new Set(
          file.routine.workouts.flatMap((other, otherIndex) =>
            otherIndex === index ? [] : other.suggested_days,
          ),
        );
        const errorId = `${fieldId(workoutPath(index))}-days-error`;

        return (
          <Card asChild className="focus-visible:outline-none" key={`${workout.name}-${index}`}>
            <section id={fieldId(workoutPath(index))} tabIndex={-1}>
            <div className="flex flex-col gap-1">
              <h2 className="type-title">{workout.name}</h2>
              <p className="type-measure-sm text-ink-3">
                {workout.exercises.length}{' '}
                {workout.exercises.length === 1 ? 'exercise' : 'exercises'}
              </p>
            </div>

            <SuggestedDays
              conflicted={(day) => claimedElsewhere.has(day)}
              describedBy={clash === undefined ? undefined : errorId}
              label={`Suggested days for ${workout.name}`}
              onToggle={(day) => onToggleDay(index, day)}
              selected={workout.suggested_days}
            />

            {clash !== undefined && (
              <p className="type-caption text-missed-ink" id={errorId}>
                {describeIssue(clash, undefined)}
              </p>
            )}

            {workout.suggested_days.length === 0 && (
              <p className="type-caption text-ink-3">
                No day chosen. This Workout lands on no date — you can still put it on
                the calendar yourself later.
              </p>
            )}
            </section>
          </Card>
        );
      })}

      <section className={WELL}>
        <span className={LABEL}>what this generates</span>
        {placements.length === 0 ? (
          <p className="type-body-sm text-ink-2">
            No sessions yet. Choose at least one day above, and they appear here.
          </p>
        ) : (
          <>
            <p className="type-readout">
              {placements.length} {placements.length === 1 ? 'session' : 'sessions'}
            </p>
            <p className="type-measure-sm text-ink-3">
              {first !== undefined && last !== undefined
                ? `${longDate(first)} → ${longDate(last)}`
                : ''}
            </p>
            <p className="type-caption text-ink-2">
              Days are placed from the start date, {weeks} {weeks === 1 ? 'week' : 'weeks'} of
              seven days each.
            </p>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <span className={chip('planned')}>
            {weeks} {weeks === 1 ? 'week' : 'weeks'}
          </span>
          <span className={chip('neutral')}>
            {file.routine.workouts.length}{' '}
            {file.routine.workouts.length === 1 ? 'workout' : 'workouts'}
          </span>
        </div>
      </section>
    </>
  );
}

function previewPlacements(file: RoutineFile, startDate: LocalDate) {
  const workouts: Workout[] = file.routine.workouts.map((workout, index) => ({
    id: toId<WorkoutId>(`preview-${index}`),
    routineId: toId<RoutineId>('preview'),
    name: workout.name,
    suggestedDays: workout.suggested_days,
    order: index,
  }));

  return generatePlacements({ workouts, weeks: file.routine.weeks, anchorDate: startDate });
}
function longDate(date: LocalDate): string {
  return parseLocalDate(date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
