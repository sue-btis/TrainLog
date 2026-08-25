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
import { Link, useNavigate } from 'react-router';
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
import { movesBodyweight } from '@/domain/measurement';
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
  // One read for all of gym mode's settings (§32). Absent only while it is in
  // flight, and the fallbacks below are the shipped behaviour, so a lifter
  // never sees a frame of the timer or the logger acting on someone else's
  // preferences.
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
  /**
   * The exercise that was on screen when the reorder panel opened.
   *
   * The pager holds a *position*, and reordering is precisely the act of
   * changing which exercise a position names. Without this, moving the exercise
   * you are in the middle of would drop you back onto whichever one inherited
   * its slot — with the logger pointed at an exercise you did not choose.
   */
  const [returnTo, setReturnTo] = useState<ExerciseSessionId | null>(null);

  // §11.6 — the screen stays awake for as long as a session is open, unless the
  // lifter has turned that off (§32). Passing the setting through `active` is
  // enough: the hook re-runs on change and its cleanup releases the sentinel,
  // so turning it off mid-session lets the screen sleep again.
  useWakeLock(session !== undefined && (settings?.keepScreenAwake ?? true));

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

  async function log(values: SetValues, setNumber: number) {
    if (entry === undefined) return;
    // The projection to the domain's nulls is `valuesFor`'s, reading the
    // measurement's own shape table — this screen states no per-type fact of
    // its own (REQ-102, REQ-106).
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

  /**
   * R-4 — a correction to a set already logged. The values are the domain's;
   * this only stores them, and `weightKg` is re-derived there rather than here.
   */
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

  /**
   * R-12 — finishing. The status is derived from the exercises, not chosen
   * here: `completed` when none is still pending, `partial` otherwise (§36).
   * The menu names which of the two this will record, so there is nothing left
   * to confirm once it is chosen.
   */
  function finish() {
    if (session === undefined) return;
    const exerciseSessions = entries.map((it) => it.exerciseSession);

    void run(async () => {
      await saveFinishedSession(
        finishSession(session, exerciseSessions, Date.now()),
        exerciseSessions,
      );
      // To the record, not to Today. Finishing used to land on a screen that
      // looked exactly as it had an hour earlier, still offering to start the
      // Workout it had just recorded — the one moment repeated after every
      // training session, and the only one that said nothing.
      //
      // `replace`, because gym mode is over: this Session's record takes its
      // place in the history stack, so Back leaves the session behind rather
      // than returning to a screen that no longer has one open.
      await navigate(`/sessions/${session.id}?finished=1`, { replace: true });

      // A recorded Session is the least replaceable thing this app holds — it
      // cannot be re-derived from anything. Ask the browser not to evict it.
      void ensurePersistentStorage();
    });
  }

  /**
   * §35 — the way out of a Session started by mistake. It is not the opposite
   * of finishing: finishing records that something happened, this says nothing
   * did. Only offered while the Session holds no set at all, so it can never
   * cost a lifter work; the repository refuses it otherwise.
   *
   * Back to Today, replacing gym mode in the stack: the Session it belonged to
   * no longer exists, so there is nothing behind this screen to return to.
   */
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
      {/* REQ-108 — bodyweight is stated once, in settings, and the Session
          records whatever it said when it started. Gym mode only speaks up
          when a movement in front of the lifter is measured against a
          bodyweight the app has never been told. */}
      {(settings?.bodyweightKg ?? null) === null &&
        entries.some((it) => movesBodyweight(it.exerciseSession.measurement)) && (
          <p className={cn(WELL, 'type-body-sm text-missed-ink')} role="status">
            This workout has movements measured against your bodyweight, and the app
            has never been told yours.{' '}
            <Link className="underline" to="/settings">
              Set it in settings
            </Link>
            .
          </p>
        )}

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

          {/* Keyed on the exercise: paging remounts the logger, so the numbers
              belong to the exercise in front of you and never trail from the
              one before it. */}
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

      {/* Last time's numbers are reference, not the set in front of you — they
          sit under the finish control rather than between the heading and the
          logger (§21). */}
      {entry !== undefined && <PreviousPanel exerciseSession={entry.exerciseSession} />}
    </Frame>
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
/**
 * The whole-session actions, and the one exercise-level action that is not a
 * button on screen (§21).
 *
 * Ending the session lives here rather than in the column: gym mode's screen is
 * for the set in front of you, and a permanent "Finish session" under it is an
 * offer to leave standing next to the work.
 *
 * Its two endings are named for what each records, so choosing one is the whole
 * decision — there is no second screen asking again. `Finish as partial` says
 * what the derived status will be (DEC-009) rather than hiding it behind a
 * neutral word. `Discard` is live only while the Session holds no set at all,
 * which is what makes it safe to take at one tap: there is nothing to lose.
 * With sets on the record it stays in place, disabled and counting them — the
 * reason it cannot be taken is the thing a lifter would otherwise be about to
 * throw away, and an item that vanishes says nothing at all.
 */
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
): { readonly since: Timestamp; readonly seconds: number; readonly exerciseId: ExerciseId } | null {
  let latest: { since: Timestamp; seconds: number; exerciseId: ExerciseId } | null = null;

  for (const entry of entries) {
    const planned = entry.exerciseSession.plannedExerciseId === null ? null : entry.exerciseSession;
    const seconds = planned?.plannedRestSeconds ?? null;

    // A set that declares no rest starts none — and, just as importantly, ends
    // none either. Letting it decide is what used to delete a running rest: the
    // lifter slots a light accessory set into a three-minute squat rest, the
    // accessory declares no rest, and the countdown they were pacing by
    // vanished with nothing said and no way back.
    //
    // The objection this replaces was that the surviving timer would belong to
    // a different exercise than the one on screen. It does, and that was always
    // true of a rest paged away from — so the timer names its exercise instead
    // of being thrown away for it.
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
