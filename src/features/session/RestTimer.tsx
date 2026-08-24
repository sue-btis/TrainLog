/**
 * The rest timer (§11.6) — the one full-bleed coloured surface in the product
 * (DESIGN.md §Rest timer).
 *
 * **It does not count.** The remaining time is `restRemaining` evaluated against
 * the clock, from the instant the set was logged; the interval below exists only
 * to make React repaint. That distinction is the whole of §35's correctness
 * requirement: lock the phone, background the PWA, let the browser suspend
 * timers for four minutes — the interval stops firing, and the number it would
 * have shown is still right the moment it fires again, because nothing was ever
 * accumulated.
 *
 * `since` is `CompletedSet.completedAt`, already on disk before this component
 * mounts, which is why a reload mid-rest rebuilds the same countdown rather than
 * restarting it.
 *
 * Pause and added time are held here and are deliberately not persisted (A-3):
 * they would need a schema change, and losing them on reload costs a lifter one
 * glance while losing the countdown itself would cost them the set.
 */

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Plus, RotateCcw, X } from 'lucide-react';
import type { Timestamp } from '@/domain/dates';
import { restRemaining } from '@/domain/session';
import { ICON_STROKE, LABEL, PRESS, TIMER_RAIL, TIMER_SHELL, TIMER_TRACK } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

/** What the add-time control offers before the lifter changes it (§11.6). */
const DEFAULT_BUMP = 30;

/**
 * How long the dock takes to drain, in step with `§ …and drains`.
 *
 * Skip does not remove the timer directly — it starts the exit and hands the
 * removal to the end of it. React unmounts on the parent's say-so and gives an
 * element no chance to animate on the way out, so the component has to own the
 * delay itself. Under `prefers-reduced-motion` there is no exit to wait for and
 * the dismissal is immediate.
 */
const EXIT_MS = 360;

/**
 * How long the spent dock stays before it drains itself, in milliseconds.
 *
 * A rest that is up does not need its dock any more — gym mode hides the
 * navigation precisely to leave the thumb zone clear, and a countdown reading
 * 0:00 for the rest of the session is the opposite of that. But it cannot
 * leave on the beep either: `Restart` at zero is "I am taking another full
 * rest" and `Add 30s` is "I am not ready", and those are the two things a
 * lifter is most likely to want in the seconds right after it. So it waits.
 *
 * Two seconds: long enough to read "rest is up" and to catch a thumb already
 * moving toward the dock, short enough that the beep and the dock leaving are
 * one event rather than two. It is deliberately not long enough to decide in —
 * a lifter who wants another rest presses Restart on the next screen's `+`, or
 * logs the set and gets a fresh one. Waiting is the countdown's job, not the
 * spent dock's.
 *
 * Touching either control still cancels the wait — both put time back on the
 * clock, `remaining` stops being zero, and the effect below tears the pending
 * dismissal down. That is what keeps them from being taken away rather than
 * the length of the wait.
 */
const GRACE_MS = 2_000;

/**
 * The rest-is-up beep (§32), synthesised rather than played.
 *
 * An audio file would be one more asset the service worker has to have cached
 * before it is any use offline, for a tone this short; an oscillator is always
 * there. The gain ramp is not decoration — cutting a tone off at full amplitude
 * clicks.
 *
 * Every failure path is a shrug, as with the wake lock: audio can be refused by
 * a policy or a silent switch, and none of that is something a lifter mid-rest
 * can act on.
 */
function beep(): void {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
    oscillator.onended = () => void context.close().catch(() => {});
  } catch {
    // No audio available. Nothing to say and nothing to fall back to.
  }
}

interface RestTimerProps {
  /** The instant the set was completed — the stored mark the rest counts from. */
  readonly since: Timestamp;
  /** The exercise's planned rest, in seconds. */
  readonly seconds: number;
  /** §32 — whether reaching zero buzzes. */
  readonly vibrate: boolean;
  /** §32 — whether reaching zero beeps. */
  readonly sound: boolean;
  readonly onSkip: () => void;
  /**
   * The exercise whose set started this rest — not the one on screen.
   *
   * Rest belongs to the Session, so paging to another exercise, or slotting an
   * accessory set into a long rest, leaves a countdown running that the heading
   * above it would otherwise appear to explain. Naming it is what makes
   * surviving those moves the right behaviour rather than a confusing one.
   */
  readonly exerciseName: string | null;
}

export function RestTimer({ since, seconds, vibrate, sound, onSkip, exerciseName }: RestTimerProps) {
  const [added, setAdded] = useState(0);
  const [pausedAt, setPausedAt] = useState<Timestamp | null>(null);
  /**
   * When the lifter pressed restart. It shifts the instant the rest counts
   * from, and it is held here rather than written down for the same reason
   * pause is: `since` is the set's own `completedAt`, and a set's timestamp is
   * a fact about the training, not a thing a timer control may rewrite.
   */
  const [restartedAt, setRestartedAt] = useState<Timestamp | null>(null);
  const [now, setNow] = useState(Date.now);
  /** How much the add-time control adds, and the draft while it is typed into. */
  const [bump, setBump] = useState(DEFAULT_BUMP);
  const [bumpDraft, setBumpDraft] = useState<string | null>(null);
  const buzzed = useRef(false);
  /**
   * Whether the dock is draining. Two things start it — Skip, and the rest
   * running out — and one effect finishes it, so both ways out look the same
   * and neither has to know about the other.
   */
  const [leaving, setLeaving] = useState(false);

  // Held in a ref because the removal effect must key on `leaving` alone. This
  // component re-renders every second, and an effect that also depended on the
  // callback's identity would restart its own timeout on every tick — a
  // dismissal that reschedules itself forever and never fires.
  const dismiss = useRef(onSkip);
  useEffect(() => {
    dismiss.current = onSkip;
  }, [onSkip]);

  // Each tick *re-reads* the clock rather than adding a second to the last
  // value. That is what survives a suspended timer: the interval may fire late,
  // early, or not at all, and the next value it produces is still the truth.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const remaining = restRemaining({
    since: restartedAt ?? since,
    seconds,
    now,
    added,
    pausedAt: pausedAt ?? undefined,
  });

  // Vibration and sound, each behind its §32 setting. Notifications stay
  // outside the MVP (§11.6).
  //
  // `buzzed` is what makes this fire once per rest rather than on every tick
  // that finds the clock already past zero — and it is also why the settings
  // can sit in the dependencies safely: changing one after the rest is up
  // re-runs the effect, finds the flag set, and says nothing.
  useEffect(() => {
    if (remaining > 0 || buzzed.current) return;
    buzzed.current = true;
    if (vibrate) navigator.vibrate?.([220, 120, 220]);
    if (sound) beep();
  }, [remaining, vibrate, sound]);

  // A spent rest sees itself out. Adding time or restarting puts the clock back
  // above zero, which re-runs this and clears the pending exit — which is why
  // the controls survive the wait rather than being taken away with the dock.
  useEffect(() => {
    if (remaining > 0 || leaving) return undefined;
    const grace = window.setTimeout(() => setLeaving(true), GRACE_MS);
    return () => window.clearTimeout(grace);
  }, [remaining, leaving]);

  // The one place the dock is actually removed, for both ways out. React
  // unmounts on the parent's say-so and gives an element no chance to animate
  // on the way out, so the removal is held back until the drain has run. Under
  // `prefers-reduced-motion` there is no drain to wait for. The cleanup also
  // covers being replaced mid-drain by a new rest: the dismissal would fire
  // against a `since` that is no longer current, which `pendingRest` ignores,
  // but a timer outliving its component stays harmless only until it doesn't.
  useEffect(() => {
    if (!leaving) return undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const id = window.setTimeout(() => dismiss.current(), reduced ? 0 : EXIT_MS);
    return () => window.clearTimeout(id);
  }, [leaving]);

  const total = seconds + added;
  const minutes = Math.floor(remaining / 60);
  const paused = pausedAt !== null;



  function commitBump() {
    if (bumpDraft === null) return;
    const parsed = Number(bumpDraft.trim());
    // A zero bump is a control that does nothing, so the floor is one second.
    if (Number.isFinite(parsed) && parsed >= 1) setBump(Math.round(parsed));
    setBumpDraft(null);
  }

  return (
    <section
      aria-label="Rest timer"
      className={cn(TIMER_SHELL, leaving ? 'timer-leaving' : 'timer-arrive')}
    >
      <TimerGoo />

      {/* The amber the dock arrives as. Three overlapping lobes rather than one
          rectangle: the goo fuses them into a single surface whose top edge
          undulates while they rise and levels as they land, which is where the
          squash and the settle come from — a full-width rectangle can only
          translate. Three droplets are thrown ahead of it and swallowed.

          They draw the fill for as long as they run and the dock's own
          `bg-live-ink` waits underneath; once they are flat and above the top
          edge the two trade places, and by then both are the same rectangle. */}
      <span aria-hidden="true" className="timer-liquid">
        <span className="timer-lobe timer-lobe-a bg-live-ink" />
        <span className="timer-lobe timer-lobe-b bg-live-ink" />
        <span className="timer-lobe timer-lobe-c bg-live-ink" />
        <span className="timer-drop timer-drop-a bg-live-ink" />
        <span className="timer-drop timer-drop-b bg-live-ink" />
        <span className="timer-drop timer-drop-c bg-live-ink" />
      </span>

      {/* The rail *scales*; it does not resize. DESIGN.md forbids animating
          width, and a transform is what the GPU can carry for three minutes
          without waking the main thread. It rides the dock's top edge, the one
          border the lifter can see — along the bottom it would sit under the
          home indicator. */}
      <div className={cn(TIMER_TRACK, 'timer-rail-in')}>
        <div
          className={TIMER_RAIL}
          // Named so the reduced-motion block can spare it: the rail is the
          // remaining time drawn as a length, not decoration.
          data-rail="rest"
          style={{ transform: `scaleX(${total === 0 ? 0 : remaining / total})` }}
        />
      </div>

      {/* One band: the clock reads left, every control falls under the thumb on
          the right. The clock is `type-readout` rather than the full `type-clock`
          — a dock this tall is glanced at from a rack, not read across a room,
          and 56px type would cost the set being logged the space the dock was
          moved here to give back. */}
      <div
        className="timer-content mx-auto flex w-full max-w-lg items-center gap-1 px-4 pt-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <span aria-live="off" className="type-readout">
            {minutes}:{String(remaining % 60).padStart(2, '0')}
          </span>
          <span className={cn(LABEL, 'truncate text-on-fill/80')}>
            {remaining === 0 ? 'rest is up' : 'rest'}
            {exerciseName !== null && <span className="text-on-fill/60"> · {exerciseName}</span>}
          </span>
        </div>

        <Control label={paused ? 'Resume rest' : 'Pause rest'} onClick={() => setPausedAt(paused ? null : Date.now())}>
          {paused ? (
            <Play aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          ) : (
            <Pause aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          )}
        </Control>
        <Control
          label="Restart rest"
          onClick={() => {
            setAdded(0);
            setPausedAt(null);
            setRestartedAt(Date.now());
            buzzed.current = false;
          }}
        >
          <RotateCcw aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
        </Control>
        <Control label="Skip rest" onClick={() => setLeaving(true)}>
          <X aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
        </Control>

        {/* How much to add stays the lifter's rather than becoming a fixed ±15:
            a heavy single might want three minutes, and a fixed bump makes that
            six presses. The word "seconds" lives in the accessible name because
            the dock has no width to spell it. */}
        <input
          aria-label="Seconds to add"
          className={cn(
            'w-11 shrink-0 rounded-field bg-on-fill/15 px-1 py-1.5 text-center type-body-sm text-on-fill',
            'outline-none focus-visible:ring-2 focus-visible:ring-on-fill',
          )}
          inputMode="numeric"
          onBlur={commitBump}
          onChange={(event) => setBumpDraft(event.target.value)}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          value={bumpDraft ?? String(bump)}
        />
        <Control
          label={`Add ${bump} seconds to the rest`}
          onClick={() => {
            setAdded((value) => value + bump);
            buzzed.current = false;
          }}
        >
          <Plus aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
        </Control>
      </div>
    </section>
  );
}

/**
 * The gooey filter for the dock. Same recipe as the rest of the system's: blur
 * the shapes together, then ramp the alpha back to a hard edge so a droplet
 * fuses into the rising surface instead of fading into it.
 *
 * `stdDeviation` is 5 rather than the 3–4 used elsewhere because this surface
 * is the width of the screen: at the smaller radius the droplets meet it in a
 * seam rather than a merge, and the seams between the three lobes stay
 * readable as seams instead of fusing. The region has to cover lobes that are
 * both taller and wider than the dock they are declared inside — the outer two
 * deliberately overhang its left and right edges.
 */
function TimerGoo() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute size-0" focusable="false">
      <defs>
        <filter height="200%" id="timer-goo" width="140%" x="-20%" y="-80%">
          <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="5" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
          />
        </filter>
      </defs>
    </svg>
  );
}

/** A control on the coloured dock: white on amber, so it takes its own face. */
function Control({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-cell',
        'bg-on-fill/15 text-on-fill hover:bg-on-fill/25',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-fill',
        PRESS,
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
