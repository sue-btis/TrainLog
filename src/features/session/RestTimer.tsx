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

/** What `+` adds, and what §11.6 calls "sumar tiempo manualmente". */
const BUMP_SECONDS = 30;

interface RestTimerProps {
  /** The instant the set was completed — the stored mark the rest counts from. */
  readonly since: Timestamp;
  /** The exercise's planned rest, in seconds. */
  readonly seconds: number;
  readonly onSkip: () => void;
}

export function RestTimer({ since, seconds, onSkip }: RestTimerProps) {
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
  const buzzed = useRef(false);

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

  // Vibration only: §11.6 puts notifications outside the MVP, and the sound it
  // also mentions needs the §32 setting that gates it, which does not exist yet.
  useEffect(() => {
    if (remaining > 0 || buzzed.current) return;
    buzzed.current = true;
    navigator.vibrate?.([220, 120, 220]);
  }, [remaining]);

  const total = seconds + added;
  const minutes = Math.floor(remaining / 60);
  const paused = pausedAt !== null;

  return (
    <section aria-label="Rest timer" className={TIMER_SHELL}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className={cn(LABEL, 'text-on-fill/90')}>{remaining === 0 ? 'rest is up' : 'rest'}</span>
          <span aria-live="off" className="type-clock">
            {minutes}:{String(remaining % 60).padStart(2, '0')}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Control label={paused ? 'Resume rest' : 'Pause rest'} onClick={() => setPausedAt(paused ? null : Date.now())}>
              {paused ? (
                <Play aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
              ) : (
                <Pause aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
              )}
            </Control>
            <Control
              label={`Add ${BUMP_SECONDS} seconds`}
              onClick={() => {
                setAdded((value) => value + BUMP_SECONDS);
                buzzed.current = false;
              }}
            >
              <Plus aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            </Control>
          </div>
          <div className="flex gap-2">
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
            <Control label="Skip rest" onClick={onSkip}>
              <X aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            </Control>
          </div>
        </div>
      </div>

      {/* The rail *scales*; it does not resize. DESIGN.md forbids animating
          width, and a transform is what the GPU can carry for three minutes
          without waking the main thread. */}
      <div className={TIMER_TRACK}>
        <div
          className={TIMER_RAIL}
          style={{ transform: `scaleX(${total === 0 ? 0 : remaining / total})` }}
        />
      </div>
    </section>
  );
}

/** A control on the coloured shell: white on amber, so it takes its own face. */
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
        'inline-flex size-11 items-center justify-center rounded-cell',
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
