import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Plus, RotateCcw, X } from 'lucide-react';
import type { Timestamp } from '@/domain/dates';
import { restRemaining } from '@/domain/session';
import { ICON_STROKE, LABEL, PRESS, TIMER_RAIL, TIMER_SHELL, TIMER_TRACK } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

const DEFAULT_BUMP = 30;

const EXIT_MS = 360;

const GRACE_MS = 2_000;

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
  }
}

interface RestTimerProps {
  readonly since: Timestamp;
  /** The exercise's planned rest, in seconds. */
  readonly seconds: number;
  readonly vibrate: boolean;
  readonly sound: boolean;
  readonly onSkip: () => void;
  readonly exerciseName: string | null;
}

export function RestTimer({ since, seconds, vibrate, sound, onSkip, exerciseName }: RestTimerProps) {
  const [added, setAdded] = useState(0);
  const [pausedAt, setPausedAt] = useState<Timestamp | null>(null);
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

  const dismiss = useRef(onSkip);
  useEffect(() => {
    dismiss.current = onSkip;
  }, [onSkip]);

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

  useEffect(() => {
    if (remaining > 0 || buzzed.current) return;
    buzzed.current = true;
    if (vibrate) navigator.vibrate?.([220, 120, 220]);
    if (sound) beep();
  }, [remaining, vibrate, sound]);

  useEffect(() => {
    if (remaining > 0 || leaving) return undefined;
    const grace = window.setTimeout(() => setLeaving(true), GRACE_MS);
    return () => window.clearTimeout(grace);
  }, [remaining, leaving]);

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

      <span aria-hidden="true" className="timer-liquid">
        <span className="timer-lobe timer-lobe-a bg-live-ink" />
        <span className="timer-lobe timer-lobe-b bg-live-ink" />
        <span className="timer-lobe timer-lobe-c bg-live-ink" />
        <span className="timer-drop timer-drop-a bg-live-ink" />
        <span className="timer-drop timer-drop-b bg-live-ink" />
        <span className="timer-drop timer-drop-c bg-live-ink" />
      </span>

      <div className={cn(TIMER_TRACK, 'timer-rail-in')}>
        <div
          // Half strength while held, so a rail that has stopped shortening
          // reads as held rather than as a rail that stopped working.
          className={cn(TIMER_RAIL, paused && 'opacity-50')}
          data-rail="rest"
          style={{ transform: `scaleX(${total === 0 ? 0 : remaining / total})` }}
        />
      </div>

      <div
        className="timer-content mx-auto flex w-full max-w-lg items-center gap-1 px-4 pt-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <span aria-live="off" className="type-readout">
            {minutes}:{String(remaining % 60).padStart(2, '0')}
          </span>
          <span className={cn(LABEL, 'truncate text-on-fill/80')}>
            {paused ? 'paused' : remaining === 0 ? 'rest is up' : 'rest'}
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
