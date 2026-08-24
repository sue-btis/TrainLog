/**
 * Routine import (§11.1).
 *
 *   select file → parse → structural check → step 1 exercises →
 *   step 2 days + weeks → accept → store routine → generate placements
 *
 * Every decision on that path already belongs to the domain: `parseRoutineFile`
 * rejects, `validateRoutineFile` flags, the edit functions correct,
 * `routineFileToDomain` and `generatePlacements` produce, and `importRoutine`
 * writes the lot in one transaction. This component owns what is left — which
 * step is showing, which row is open, and where the clock is read.
 *
 * The clock is read exactly once, in `accept`. §12 deliberately gives a routine
 * no start date, so the anchor belongs to the moment of import and to nothing
 * else (DEC-008).
 */

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays, Check, Dumbbell, FileUp, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getDefaultUnit, importRoutine, listUserExercises } from '@/db';
import { ensurePersistentStorage } from '@/pwa/persistence';
import { formatLocalDate } from '@/domain/dates';
import {
  deleteExercise,
  editExercise,
  routineFileToDomain,
  parseRoutineFile,
  validateRoutineFile,
  type ExerciseRef,
  type RoutineFileExercise,
  type SemanticIssue,
} from '@/domain/routine-file';
import { generatePlacements } from '@/domain/scheduling';
import type { Weekday } from '@/domain/types';
import { ActionBar } from '@/features/import/ActionBar';
import { takeHandedOffFile } from '@/features/import/ImportRoutineButton';
import { ExercisesStep } from '@/features/import/ExercisesStep';
import { FileStep } from '@/features/import/FileStep';
import { ScheduleStep } from '@/features/import/ScheduleStep';
import { BottomNav } from '@/features/shell/BottomNav';
import { TopBar } from '@/features/shell/TopBar';
import {
  fieldId,
  indexIssues,
  pathKey,
  stepOfIssue,
  workoutPath,
} from '@/features/import/issues';
import {
  INITIAL_STATE,
  reduceWizard,
  type AcceptedSummary,
  type WizardState,
  type WizardStep,
} from '@/features/import/state';
import {
  COLUMN,
  ICON_STROKE,
  LABEL,
  RULED,
  SCREEN,
  chip,
} from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function ImportWizard() {
  const [state, dispatch] = useReducer(reduceWizard, INITIAL_STATE);
  const [activeWorkout, setActiveWorkout] = useState(0);
  /** Raised by the Leave link, answered in the action bar (DEC: see ActionBar). */
  const [leaving, setLeaving] = useState(false);
  const [openRef, setOpenRef] = useState<ExerciseRef | null>(null);
  const column = useRef<HTMLDivElement>(null);
  /** The control an action-bar jump asked for, focused once it has rendered. */
  const pendingFocus = useRef<string | null>(null);

  const file = state.phase === 'editing' ? state.file : null;
  const issues = useMemo<readonly SemanticIssue[]>(
    () => (file === null ? [] : validateRoutineFile(file)),
    [file],
  );
  const issueIndex = useMemo(() => indexIssues(issues), [issues]);

  // A jump from the action bar lands on the control that carries the issue —
  // which only exists after the step and Workout it lives on have rendered.
  useEffect(() => {
    const id = pendingFocus.current;
    if (id === null) return;
    pendingFocus.current = null;
    const target = document.getElementById(id);
    target?.scrollIntoView({ block: 'center' });
    target?.focus({ preventScroll: true });
  });

  // The file was already chosen on the screen that sent us here, so the wizard
  // opens on the first real step rather than on one asking for it again. When
  // nothing was handed over — a reload, a bookmarked `/import` — the file step
  // renders and asks, which is what it is there for.
  useEffect(() => {
    const handed = takeHandedOffFile();
    if (handed !== null) void chooseFile(handed);
    // Once, on mount: the handover is consumed by the first read.
  }, []);

  async function chooseFile(chosen: File) {
    let text: string;
    try {
      text = await chosen.text();
    } catch (error) {
      dispatch({ type: 'unreadable', fileName: chosen.name, message: messageOf(error) });
      return;
    }

    const parsed = parseRoutineFile(text);
    if (!parsed.ok) {
      dispatch({ type: 'rejected', fileName: chosen.name, errors: parsed.errors });
      return;
    }

    setActiveWorkout(0);
    setOpenRef(null);
    dispatch({
      type: 'loaded',
      fileName: chosen.name,
      file: parsed.file,
      defaultUnit: await getDefaultUnit(),
    });
  }

  async function accept() {
    if (state.phase !== 'editing' || issues.length > 0) return;
    dispatch({ type: 'accepting' });

    try {
      const [defaultUnit, existingExercises] = await Promise.all([
        getDefaultUnit(),
        listUserExercises(),
      ]);
      const draft = routineFileToDomain(state.file, {
        defaultUnit,
        existingExercises,
        createdAt: Date.now(),
      });
      const placements = generatePlacements({
        workouts: draft.workouts,
        weeks: draft.routine.weeks,
        anchorDate: formatLocalDate(new Date()),
      });

      await importRoutine(draft, placements);

      // The database now holds something a lifter would mind losing, and an
      // accepted import is a moment of real engagement — which is what browsers
      // weigh when deciding to grant persistence. Fire and forget: the answer
      // changes nothing on this screen, and a refusal is not an import failure.
      void ensurePersistentStorage();

      dispatch({
        type: 'accepted',
        summary: {
          routineName: draft.routine.name,
          workouts: draft.workouts.length,
          exercises: draft.plannedExercises.length,
          placements: placements.length,
          first: placements[0]?.date ?? null,
          last: placements[placements.length - 1]?.date ?? null,
        },
      });
    } catch (error) {
      dispatch({ type: 'acceptFailed', message: messageOf(error) });
    }
  }

  function goToStep(step: WizardStep) {
    dispatch({ type: 'step', step });
    column.current?.scrollIntoView({ block: 'start' });
  }

  function jumpToIssue(issue: SemanticIssue) {
    const path = issue.paths[0];
    if (path === undefined) return;

    const step = stepOfIssue(issue);
    dispatch({ type: 'step', step });

    const workout = typeof path[2] === 'number' ? path[2] : 0;
    setActiveWorkout(workout);

    if (step === 2) {
      pendingFocus.current = fieldId(workoutPath(workout));
      return;
    }

    if (typeof path[4] === 'number') setOpenRef({ workout, exercise: path[4] });
    pendingFocus.current = fieldId(pathKey(path));
  }

  const edit = {
    exercise: (ref: ExerciseRef, patch: Partial<RoutineFileExercise>) =>
      file && dispatch({ type: 'edited', file: editExercise(file, ref, patch) }),
    remove: (ref: ExerciseRef) => {
      if (!file) return;
      setOpenRef(null);
      dispatch({ type: 'edited', file: deleteExercise(file, ref) });
    },
    toggleDay: (workout: number, day: Weekday) =>
      dispatch({ type: 'toggleDay', workout, day }),
    weeksBy: (delta: number) => dispatch({ type: 'weeksBy', delta }),
  };

  return (
    <main className={SCREEN}>
      {/* Editing owns the bottom, so the way out is up here. The other two
          phases keep the nav below and only need the bar to name the task. */}
      <TopBar
        back={
          state.phase === 'editing' ? { onBack: () => setLeaving(true) } : { to: '/today' }
        }
        backLabel={state.phase === 'editing' ? 'Leave this import' : 'Back to today'}
        icon={iconOf(state)}
        title={titleOf(state)}
      />

      <div className={cn(COLUMN, state.phase === 'editing' ? 'pb-48' : 'pb-32')} ref={column}>
        {state.phase === 'choosing' && (
          <FileStep
            errors={state.errors}
            fileName={state.fileName}
            onFile={chooseFile}
            unreadable={state.unreadable}
          />
        )}

        {state.phase === 'editing' && state.step === 1 && (
          <ExercisesStep
            activeWorkout={activeWorkout}
            defaultUnit={state.defaultUnit}
            file={state.file}
            issues={issueIndex}
            onActiveWorkout={setActiveWorkout}
            onDelete={edit.remove}
            onEdit={edit.exercise}
            onToggle={setOpenRef}
            openRef={openRef}
          />
        )}

        {state.phase === 'editing' && state.step === 2 && (
          <ScheduleStep
            file={state.file}
            issues={issues}
            onToggleDay={edit.toggleDay}
            onWeeksBy={edit.weeksBy}
            today={formatLocalDate(new Date())}
          />
        )}

        {state.phase === 'accepted' && (
          <Accepted onAnother={() => dispatch({ type: 'restart' })} summary={state.summary} />
        )}
      </div>

      {state.phase !== 'editing' && <BottomNav />}

      {state.phase === 'editing' && (
        <ActionBar
          accepting={state.accepting}
          confirmingCancel={leaving}
          failure={state.failure}
          issues={issues}
          onAccept={accept}
          onCancel={() => {
            setActiveWorkout(0);
            setOpenRef(null);
            setLeaving(false);
            dispatch({ type: 'restart' });
          }}
          onConfirmCancel={setLeaving}
          onJump={jumpToIssue}
          onStep={goToStep}
          step={state.step}
        />
      )}
    </main>
  );
}

/** The step names the bar carries. The wizard is one screen with four titles. */
function titleOf(state: WizardState): string {
  if (state.phase === 'choosing') return 'Import a routine';
  if (state.phase === 'accepted') return 'Imported';
  return state.step === 1 ? 'Review the exercises' : 'Days and weeks';
}

/** And its four drawings, so the bar shows the step as well as naming it. */
function iconOf(state: WizardState) {
  if (state.phase === 'choosing') return FileUp;
  if (state.phase === 'accepted') return Check;
  return state.step === 1 ? ListChecks : CalendarDays;
}

interface AcceptedProps {
  readonly summary: AcceptedSummary;
  readonly onAnother: () => void;
}

function Accepted({ summary, onAnother }: AcceptedProps) {
  return (
    <>
      <header className="flex flex-col gap-3">
        <span className={chip('actual', 'self-start')}>
          <Check aria-hidden="true" size={12} strokeWidth={ICON_STROKE} />
          imported
        </span>
        <h2 className="type-display">{summary.routineName}</h2>
        <p className="type-lede text-ink-2">
          This is now your active Routine. Any Routine you were running before has been
          archived — its history is untouched.
        </p>
      </header>

      <Card>
        <div className="flex flex-col gap-3">
          <span className={LABEL}>stored</span>
          <dl className="grid grid-cols-3 gap-3">
            <Figure label="workouts" value={String(summary.workouts)} />
            <Figure label="exercises" value={String(summary.exercises)} />
            <Figure label="sessions" value={String(summary.placements)} />
          </dl>
          <p className="type-measure-sm text-ink-3">
            {summary.first === null || summary.last === null
              ? 'No sessions were placed — no Workout suggested a day.'
              : `placed ${summary.first} → ${summary.last}`}
          </p>
        </div>

        <div className={RULED}>
          <Button onClick={onAnother} size="block" type="button" variant="primary">
            <FileUp aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
            Import another routine
          </Button>
          <Button asChild size="block" variant="ghost">
            <Link to="/today">
              <Dumbbell aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
              Go to Today
            </Link>
          </Button>
        </div>
      </Card>
    </>
  );
}

function Figure({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className={LABEL}>{label}</dt>
      <dd className="type-readout">{value}</dd>
    </div>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
