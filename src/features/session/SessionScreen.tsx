import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  MoreVertical,
  Plus,
  Trash2,
  SkipForward,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DEFAULT_UNIT,
  addExerciseSession,
  deleteCompletedSet,
  discardSession,
  saveEditedSet,
  saveExerciseSession,
  saveExerciseSessions,
  saveFinishedSession,
  saveLoggedSet,
} from '@/db';
import type { ExerciseId, ExerciseSessionId } from '@/domain/ids';
import {
  editSet,
  finishSession,
  logSet,
  moveExerciseSession,
  removeSet,
  skipExercise,
  startUnplannedExercise,
} from '@/domain/session';
import type { Timestamp } from '@/domain/dates';
import type { CompletedSet, Exercise, ExerciseSession } from '@/domain/types';
import { ExercisePicker } from '@/features/session/ExercisePicker';
import { ExerciseReorder } from '@/features/session/ExerciseReorder';
import { ExerciseView } from '@/features/session/ExerciseView';
import { PreviousPanel } from '@/features/session/PreviousPanel';
import { RestTimer } from '@/features/session/RestTimer';
import { valuesFor, type SetValues } from '@/features/session/SetLogger';
import { useWakeLock } from '@/features/session/useWakeLock';
import {
  useSettings,
  useExerciseNames,
  useInProgressSession,
  useSessionDetail,
} from '@/features/data/queries';
import { TopBar } from '@/features/shell/TopBar';
import { plural } from '@/features/ui/format';
import { COLUMN, ICON_STROKE, LABEL, SCREEN, WELL } from '@/features/ui/styles';
import { ensurePersistentStorage } from '@/pwa/persistence';
import { cn } from '@/lib/utils';

export function SessionScreen() {
  const navigate = useNavigate();
  const session = useInProgressSession();
  const detail = useSessionDetail(session?.id ?? null);
  const settings = useSettings();

  const entries = detail?.exercises ?? [];
  const names = useExerciseNames(entries.map((entry) => entry.exerciseSession.exerciseId));

  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /** The rest a lifter dismissed, remembered by the set that started it. */
  const [skippedRest, setSkippedRest] = useState<Timestamp | null>(null);
  const [picking, setPicking] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [returnTo, setReturnTo] = useState<ExerciseSessionId | null>(null);

  useWakeLock(session !== undefined && (settings?.keepScreenAwake ?? true));

  const rest = pendingRest(entries, skippedRest);

  // The list shrinks only when a Session ends, and `index` is clamped rather
  // than corrected, so paging can never land past the end.
  const at = Math.min(index, Math.max(0, entries.length - 1));
  const entry = entries[at];

  async function run(action: () => Promise<unknown>) {
    setFailure(null);
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function log(values: SetValues, setNumber: number) {
    if (entry === undefined) return;
    await run(() =>
      saveLoggedSet(
        logSet({
          exerciseSession: entry.exerciseSession,
          setNumber,
          unit: values.unit,
          rir: values.rir,
          ...valuesFor(entry.exerciseSession.measurement, values),
          completedAt: Date.now(),
        }),
      ),
    );
  }

  async function editLoggedSet(set: CompletedSet, values: SetValues) {
    const owner = entries.find((it) => it.exerciseSession.id === set.exerciseSessionId);
    if (owner === undefined) return;
    await run(() =>
      saveEditedSet(
        editSet({
          set,
          unit: values.unit,
          rir: values.rir,
          ...valuesFor(owner.exerciseSession.measurement, values),
        }),
      ),
    );
  }

  async function deleteLoggedSet(set: CompletedSet) {
    const owner = entries.find((it) => it.exerciseSession.id === set.exerciseSessionId);
    if (owner === undefined) return;

    const removal = removeSet({
      exerciseSession: owner.exerciseSession,
      sets: owner.sets,
      setId: set.id,
    });
    await run(() => deleteCompletedSet({ removed: set.id, ...removal }));
  }

  function skip() {
    if (entry === undefined) return;
    void run(() => saveExerciseSession(skipExercise(entry.exerciseSession)));
  }

  function move(id: ExerciseSessionId, toPosition: number) {
    const current = entries.map((it) => it.exerciseSession);
    const moved = moveExerciseSession(current, id, toPosition);

    if (moved === current) return;

    void run(() => saveExerciseSessions(moved));
  }

  function enterReorder() {
    setReturnTo(entry?.exerciseSession.id ?? null);
    setReordering(true);
  }

  /** Leaves it on that same exercise, wherever the lifter moved it to. */
  function leaveReorder() {
    const back = entries.findIndex((it) => it.exerciseSession.id === returnTo);
    if (back !== -1) setIndex(back);
    setReordering(false);
  }

  function addUnplanned(exercise: Exercise) {
    if (session === undefined) return;
    setPicking(false);
    void run(async () => {
      await addExerciseSession(
        startUnplannedExercise({
          sessionId: session.id,
          exerciseId: exercise.id,
          measurement: exercise.measurement,
          order: entries.length,
        }),
      );
      setIndex(entries.length);
    });
  }

  function finish() {
    if (session === undefined) return;
    const exerciseSessions = entries.map((it) => it.exerciseSession);

    void run(async () => {
      await saveFinishedSession(
        finishSession(session, exerciseSessions, Date.now()),
        exerciseSessions,
      );
      await navigate(`/sessions/${session.id}?finished=1`, { replace: true });

      void ensurePersistentStorage();
    });
  }

  function discard() {
    if (session === undefined) return;
    void run(async () => {
      await discardSession(session.id);
      await navigate('/today', { replace: true });
    });
  }

  const pending = entries.filter((it) => it.exerciseSession.status === 'pending').length;
  /** Nothing logged anywhere is what makes a Session discardable rather than partial. */
  const logged = entries.reduce((count, it) => count + it.sets.length, 0);

  if (session === undefined) {
    return (
      <Frame>
        <section className={WELL}>
          <p className="type-title">No session is open</p>
          <p className="type-body-sm text-ink-2">
            A session starts from Today, on the Workout you are training.
          </p>
          <Button onClick={() => void navigate('/today')} size="block" type="button" variant="primary">
            Go to Today
          </Button>
        </section>
      </Frame>
    );
  }

  if (picking) {
    return (
      <Frame>
        <ExercisePicker busy={busy} onCancel={() => setPicking(false)} onPick={addUnplanned} />
      </Frame>
    );
  }

  if (reordering) {
    return (
      <Frame>
        <ExerciseReorder
          busy={busy}
          exerciseSessions={entries.map((it) => it.exerciseSession)}
          names={names}
          onDone={leaveReorder}
          onMove={move}
        />
      </Frame>
    );
  }

  return (
    <Frame
      action={
        <SessionMenu
          logged={logged}
          canReorder={entries.length > 1}
          canSkip={entry !== undefined}
          onAdd={() => setPicking(true)}
          onDiscard={discard}
          onFinish={finish}
          onReorder={enterReorder}
          onSkip={skip}
          pending={pending}
        />
      }
    >

      {entry === undefined ? (
        <section className={WELL}>
          <p className="type-title">This Workout has no exercises</p>
          <p className="type-body-sm text-ink-2">
            There is nothing to log. Finish or discard it from the session menu, above.
          </p>
        </section>
      ) : (
        <>
          <Pager at={at} count={entries.length} onGo={setIndex} />

          {rest !== null && (
            <RestTimer
              exerciseName={names?.get(rest.exerciseId) ?? null}
              key={rest.since}
              onSkip={() => setSkippedRest(rest.since)}
              seconds={rest.seconds}
              since={rest.since}
              sound={settings?.timerSound ?? false}
              vibrate={settings?.timerVibration ?? true}
            />
          )}

          <ExerciseView
            busy={busy}
            isLast={at >= entries.length - 1}
            key={entry.exerciseSession.id}
            onAdvance={() => (at >= entries.length - 1 ? finish() : setIndex(at + 1))}
            onDeleteSet={deleteLoggedSet}
            onEditSet={editLoggedSet}
            defaultRir={settings?.defaultRir ?? null}
            defaultUnit={settings?.defaultUnit ?? DEFAULT_UNIT}
            exerciseSession={entry.exerciseSession}
            name={names?.get(entry.exerciseSession.exerciseId) ?? '…'}
            onLog={log}
            sets={entry.sets}
          />
        </>
      )}

      {failure !== null && (
        <p className="arrive type-measure text-missed-ink" role="alert">
          {failure}
        </p>
      )}

      {entry !== undefined && <PreviousPanel exerciseSession={entry.exerciseSession} />}
    </Frame>
  );
}

function Frame({
  action,
  children,
}: {
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    <main className={SCREEN}>
      <TopBar
        action={action}
        back={{ to: '/today' }}
        backLabel="Back to Today"
        icon={Dumbbell}
        title="Training"
      />
      <div className={cn(COLUMN, 'pb-24')}>{children}</div>
    </main>
  );
}

function SessionMenu({
  onSkip,
  onReorder,
  onAdd,
  onFinish,
  onDiscard,
  canReorder,
  canSkip,
  logged,
  pending,
}: {
  readonly onSkip: () => void;
  readonly onReorder: () => void;
  readonly onAdd: () => void;
  readonly onFinish: () => void;
  readonly onDiscard: () => void;
  readonly canReorder: boolean;
  readonly canSkip: boolean;
  readonly logged: number;
  readonly pending: number;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Session options" size="icon" type="button" variant="ghost">
          <MoreVertical aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>This exercise</DropdownMenuLabel>
        <DropdownMenuItem disabled={!canSkip} onSelect={onSkip}>
          <SkipForward aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          Skip this exercise
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>This session</DropdownMenuLabel>
        <DropdownMenuItem disabled={!canReorder} onSelect={onReorder}>
          <ArrowUpDown aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          Reorder exercises
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onAdd}>
          <Plus aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          Add an exercise
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Finish session</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onFinish}>
          <CheckCircle2 aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          {pending > 0 ? 'Finish as partial' : 'Finish and record it'}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={logged === 0 ? 'text-missed-ink' : undefined}
          disabled={logged > 0}
          onSelect={onDiscard}
        >
          <Trash2 aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          {logged === 0 ? 'Discard, nothing logged' : `Discard — ${plural(logged, 'set')} logged`}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Pager({
  at,
  count,
  onGo,
}: {
  readonly at: number;
  readonly count: number;
  readonly onGo: (index: number) => void;
}) {
  return (
    <nav aria-label="Exercises" className="flex items-center justify-between gap-3">
      <Button
        aria-label={`Previous exercise${at > 0 ? '' : ' (none)'}`}
        disabled={at === 0}
        onClick={() => onGo(at - 1)}
        size="icon"
        type="button"
        variant="nav"
      >
        <ChevronLeft aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
      </Button>

      <span className={LABEL}>
        exercise {at + 1} of {count}
      </span>

      <Button
        aria-label={`Next exercise${at < count - 1 ? '' : ' (none)'}`}
        disabled={at >= count - 1}
        onClick={() => onGo(at + 1)}
        size="icon"
        type="button"
        variant="nav"
      >
        <ChevronRight aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
      </Button>
    </nav>
  );
}

function pendingRest(
  entries: readonly { readonly exerciseSession: ExerciseSession; readonly sets: readonly CompletedSet[] }[],
  skipped: Timestamp | null,
): { readonly since: Timestamp; readonly seconds: number; readonly exerciseId: ExerciseId } | null {
  let latest: { since: Timestamp; seconds: number; exerciseId: ExerciseId } | null = null;

  for (const entry of entries) {
    const planned = entry.exerciseSession.plannedExerciseId === null ? null : entry.exerciseSession;
    const seconds = planned?.plannedRestSeconds ?? null;

    if (seconds === null) continue;

    for (const set of entry.sets) {
      if (latest === null || set.completedAt > latest.since) {
        latest = { since: set.completedAt, seconds, exerciseId: entry.exerciseSession.exerciseId };
      }
    }
    }
  if (latest === null || latest.since === skipped) return null;
  return latest;
}
