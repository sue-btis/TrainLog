/**
 * Gym Mode (§21) — the screen a lifter actually trains on.
 *
 * It renders its own frame and sits outside `AppShell` on purpose: there is no
 * bottom navigation here. §21 says nothing that does not contribute to the
 * current set may compete with it visually, and a strip of tabs offering to
 * leave is exactly that. The way out is finishing, or the back arrow.
 *
 * One exercise at a time. The pager moves between them; everything else on
 * screen belongs to the one in front of you.
 *
 * Every write goes straight to IndexedDB as it happens (NFR-03) — there is no
 * session draft held in React. What the screen holds is what dies with it: which
 * exercise is showing, and the numbers not yet committed to a set.
 */

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
import type { CompletedSet, ExerciseSession } from '@/domain/types';
import type { Unit } from '@/domain/units';
import { ExercisePicker } from '@/features/session/ExercisePicker';
import { ExerciseReorder } from '@/features/session/ExerciseReorder';
import { ExerciseView } from '@/features/session/ExerciseView';
import { PreviousPanel } from '@/features/session/PreviousPanel';
import { RestTimer } from '@/features/session/RestTimer';
import type { SetValues } from '@/features/session/SetLogger';
import { useWakeLock } from '@/features/session/useWakeLock';
import {
  useDefaultUnit,
  useExerciseNames,
  useInProgressSession,
  useSessionDetail,
} from '@/features/data/queries';
import { TopBar } from '@/features/shell/TopBar';
import { plural } from '@/features/ui/format';
import { COLUMN, ICON_STROKE, LABEL, RULED, SCREEN, WELL } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function SessionScreen() {
  const navigate = useNavigate();
  const session = useInProgressSession();
  const detail = useSessionDetail(session?.id ?? null);
  const defaultUnit = useDefaultUnit();

  const entries = detail?.exercises ?? [];
  const names = useExerciseNames(entries.map((entry) => entry.exerciseSession.exerciseId));

  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /** The rest a lifter dismissed, remembered by the set that started it. */
  const [skippedRest, setSkippedRest] = useState<Timestamp | null>(null);
  const [picking, setPicking] = useState(false);
  const [reordering, setReordering] = useState(false);
  /**
   * The exercise that was on screen when the reorder panel opened.
   *
   * The pager holds a *position*, and reordering is precisely the act of
   * changing which exercise a position names. Without this, moving the exercise
   * you are in the middle of would drop you back onto whichever one inherited
   * its slot — with the logger pointed at an exercise you did not choose.
   */
  const [returnTo, setReturnTo] = useState<ExerciseSessionId | null>(null);
  /** Finishing with work left undone asks once; this is the armed state (§37). */
  const [confirmFinish, setConfirmFinish] = useState(false);

  // §11.6 — the screen stays awake for as long as a session is open.
  useWakeLock(session !== undefined);

  // Rest belongs to the Session, not to the exercise on screen: the last set
  // logged anywhere starts it, and paging to another exercise mid-rest does not
  // abandon it. Its duration is the planned rest of the exercise it came from.
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

  async function log(values: SetValues, unit: Unit, setNumber: number) {
    if (entry === undefined) return;
    await run(() =>
      saveLoggedSet(
        logSet({
          exerciseSession: entry.exerciseSession,
          setNumber,
          weight: values.weight,
          unit,
          reps: values.reps,
          rir: values.rir,
          completedAt: Date.now(),
        }),
      ),
    );
  }

  /**
   * R-4 — a correction to a set already logged. The values are the domain's;
   * this only stores them, and `weightKg` is re-derived there rather than here.
   */
  async function editLoggedSet(set: CompletedSet, values: SetValues, unit: Unit) {
    await run(() =>
      saveEditedSet(
        editSet({ set, weight: values.weight, unit, reps: values.reps, rir: values.rir }),
      ),
    );
  }

  /**
   * R-4 — removing a set. The domain decides what the survivors and the
   * exercise's status become; the repository writes all of it in one
   * transaction, so the renumbering can never be visible without the deletion
   * that caused it.
   */
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

  /**
   * FR-14 — an exercise the lifter chose not to do. `skipped` is not `pending`,
   * so skipping does not make the Session partial (DEC-009). It stays visible
   * in the pager: what was skipped is part of what happened.
   */
  function skip() {
    if (entry === undefined) return;
    void run(() => saveExerciseSession(skipExercise(entry.exerciseSession)));
  }

  /**
   * FR-14 — moving an exercise to a position within the Session. The
   * renumbering is the domain's; only ExerciseSessions are written, never the
   * template behind them.
   *
   * The pager is not adjusted per move — the panel shows the whole session, so
   * there is nothing on screen to keep up with. It is realigned once on the way
   * out, in `leaveReorder`, onto the exercise the lifter came in on.
   */
  function move(id: ExerciseSessionId, toPosition: number) {
    const current = entries.map((it) => it.exerciseSession);
    const moved = moveExerciseSession(current, id, toPosition);

    // The domain hands back the same list when the move changes nothing — to
    // its own position, or for an id it does not hold. Identity is the signal,
    // and it is what keeps a no-op from becoming a write.
    if (moved === current) return;

    void run(() => saveExerciseSessions(moved));
  }

  /** Opens the reorder panel, remembering the exercise to come back to. */
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

  /**
   * FR-15 — an exercise with no plan behind it. It goes on the end, carries no
   * targets and gets no suggestion (§11.9); a substitution is this plus a skip.
   */
  function addUnplanned(exerciseId: ExerciseId) {
    if (session === undefined) return;
    setPicking(false);
    void run(async () => {
      await addExerciseSession(
        startUnplannedExercise({ sessionId: session.id, exerciseId, order: entries.length }),
      );
      setIndex(entries.length);
    });
  }

  /**
   * R-12 — finishing. The status is derived from the exercises, not chosen
   * here: `completed` when none is still pending, `partial` otherwise (§36).
   * With work left undone it asks once first, naming what that will record.
   */
  function finish() {
    if (session === undefined) return;
    const exerciseSessions = entries.map((it) => it.exerciseSession);
    const pending = exerciseSessions.filter((it) => it.status === 'pending').length;

    if (pending > 0 && !confirmFinish) {
      setConfirmFinish(true);
      return;
    }

    void run(async () => {
      await saveFinishedSession(
        finishSession(session, exerciseSessions, Date.now()),
        exerciseSessions,
      );
      await navigate('/today');
    });
  }

  const pending = entries.filter((it) => it.exerciseSession.status === 'pending').length;

  // Loading, and the case §35 does not cover: arriving here with nothing open.
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
        entry === undefined ? undefined : (
          <SessionMenu
            canReorder={entries.length > 1}
            onAdd={() => setPicking(true)}
            onReorder={enterReorder}
            onSkip={skip}
          />
        )
      }
    >
      {entry === undefined ? (
        <section className={WELL}>
          <p className="type-title">This Workout has no exercises</p>
          <p className="type-body-sm text-ink-2">
            There is nothing to log. Finishing it records that the session happened.
          </p>
        </section>
      ) : (
        <>
          <Pager at={at} count={entries.length} onGo={setIndex} />

          {/* Keyed on the exercise: paging remounts the logger, so the numbers
              belong to the exercise in front of you and never trail from the
              one before it. */}
          {rest !== null && (
            <RestTimer
              key={rest.since}
              onSkip={() => setSkippedRest(rest.since)}
              seconds={rest.seconds}
              since={rest.since}
            />
          )}

          <ExerciseView
            busy={busy}
            isLast={at >= entries.length - 1}
            key={entry.exerciseSession.id}
            onAdvance={() => (at >= entries.length - 1 ? finish() : setIndex(at + 1))}
            onDeleteSet={deleteLoggedSet}
            onEditSet={editLoggedSet}
            defaultUnit={defaultUnit ?? DEFAULT_UNIT}
            exerciseSession={entry.exerciseSession}
            name={names?.get(entry.exerciseSession.exerciseId) ?? '…'}
            onLog={log}
            sets={entry.sets}
          />
        </>
      )}

      {failure !== null && (
        <p className="type-measure text-missed-ink" role="alert">
          {failure}
        </p>
      )}

      <Finish
        busy={busy}
        armed={confirmFinish}
        onCancel={() => setConfirmFinish(false)}
        onFinish={finish}
        pending={pending}
      />

      {/* Last time's numbers are reference, not the set in front of you — they
          sit under the finish control rather than between the heading and the
          logger (§21). */}
      {entry !== undefined && <PreviousPanel exerciseSession={entry.exerciseSession} />}
    </Frame>
  );
}

/**
 * R-12 — ending the session, and the one place it says what that will record.
 *
 * With exercises still pending it arms first, in Errata Red and flat, naming
 * the consequence in the label the way DESIGN.md's destructive-armed pattern
 * asks. It is not destructive — nothing is lost — but `partial` is a fact about
 * a lifter's history, and recording one by accident is worth one tap to avoid.
 */
function Finish({
  busy,
  armed,
  pending,
  onFinish,
  onCancel,
}: {
  readonly busy: boolean;
  readonly armed: boolean;
  readonly pending: number;
  readonly onFinish: () => void;
  readonly onCancel: () => void;
}) {
  if (!armed) {
    return (
      <div className={RULED}>
        <Button disabled={busy} onClick={onFinish} size="block" type="button" variant="secondary">
          <CheckCircle2 aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
          Finish session
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(RULED, 'gap-3')}>
      <p className="type-body-sm text-ink-2">
        {plural(pending, 'exercise')} still untouched. Finishing now records this session
        as partial — it stays in your history and is left out of progression.
      </p>
      <Button disabled={busy} onClick={onFinish} size="block" type="button" variant="danger">
        Finish it as partial
      </Button>
      <Button disabled={busy} onClick={onCancel} size="block" type="button" variant="quiet">
        Keep training
      </Button>
    </div>
  );
}

/** The frame gym mode wears: a bar, a column, and no navigation (§21). */
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

/**
 * Everything a lifter can do to the session that is not "log this set".
 *
 * It lives behind one control in the bar because §21 is explicit: nothing that
 * does not contribute to the current set may compete with it. Skipping,
 * reordering and adding are real and reachable in two taps; none of them earns
 * a permanent place next to the green button.
 */
function SessionMenu({
  onSkip,
  onReorder,
  onAdd,
  canReorder,
}: {
  readonly onSkip: () => void;
  readonly onReorder: () => void;
  readonly onAdd: () => void;
  readonly canReorder: boolean;
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
        <DropdownMenuItem onSelect={onSkip}>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Which exercise of how many, and the two ways to move. Position is shown as a
 * count rather than a strip of names: at arm's length "3 of 6" is legible and
 * six truncated exercise names are not. The exercise itself is named by the
 * heading directly below, so naming it here too would say it twice.
 */
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

/**
 * The rest currently running, or `null` (§11.6, R-7).
 *
 * The set that started it is the most recently completed one in the Session,
 * found by `completedAt` rather than by position, because a lifter who pages
 * back to an earlier exercise and logs an extra set there has just started a new
 * rest from that set.
 *
 * There is no rest where the exercise declares none, where it is already spent
 * past the point of being useful, or where the lifter skipped it — and `skipped`
 * names the instant rather than a flag, so the next set starts a fresh timer
 * instead of inheriting the dismissal.
 */
function pendingRest(
  entries: readonly { readonly exerciseSession: ExerciseSession; readonly sets: readonly CompletedSet[] }[],
  skipped: Timestamp | null,
): { readonly since: Timestamp; readonly seconds: number } | null {
  let latest: { since: Timestamp; seconds: number | null } | null = null;

  for (const entry of entries) {
    const planned = entry.exerciseSession.plannedExerciseId === null ? null : entry.exerciseSession;
    const seconds = planned?.plannedRestSeconds ?? null;

    for (const set of entry.sets) {
      if (latest === null || set.completedAt > latest.since) {
        latest = { since: set.completedAt, seconds };
      }
    }
  }

  // The most recent set decides, even when it declares no rest. Skipping the
  // restless ones instead would leave the previous exercise's timer running
  // after a set of something else entirely — a countdown to a rest the lifter
  // is already three minutes past.
  if (latest === null || latest.seconds === null || latest.since === skipped) return null;
  return { since: latest.since, seconds: latest.seconds };
}
