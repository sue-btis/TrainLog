import { useEffect, useRef, useState } from 'react';
import { Square, Timer } from 'lucide-react';
import type { Timestamp } from '@/domain/dates';
import { holdCuesReached, stopwatchElapsed } from '@/domain/session';
import { useSettings } from '@/features/data/queries';
import { cue } from '@/features/session/cue';
import { FOCUS_RING, ICON_STROKE, LABEL, PRESS, TIMER_RAIL } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

function phase(reached: number, target: readonly [number, number] | null): string {
  if (reached === 0) return 'holding';
  const single = target === null || target[0] === target[1];
  return reached === 1 && !single ? 'in range' : 'target reached';
}

interface HoldStopwatchProps {
  /** The programme's window in seconds, or `null` where it stated none. */
  readonly target: readonly [number, number] | null;
  readonly onStop: (seconds: number) => void;
}

export function HoldStopwatch({ target, onStop }: HoldStopwatchProps) {
  const settings = useSettings();
  const [startedAt, setStartedAt] = useState<Timestamp | null>(null);
  const [now, setNow] = useState(Date.now);
  const cued = useRef(0);

  useEffect(() => {
    if (startedAt === null) return undefined;
    // Re-read the wall clock so a suspended tab catches up instead of counting
    // interval callbacks that never ran.
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  const elapsed = startedAt === null ? 0 : stopwatchElapsed({ since: startedAt, now });
  const reached = holdCuesReached(elapsed, target);
  const vibrate = settings?.timerVibration ?? true;
  const sound = settings?.timerSound ?? false;

  useEffect(() => {
    if (startedAt === null || reached <= cued.current) return;
    cued.current = reached;
    cue({ vibrate, sound });
  }, [startedAt, reached, vibrate, sound]);

  function start() {
    cued.current = 0;
    const instant = Date.now();
    setNow(instant);
    setStartedAt(instant);
  }

  function stop() {
    onStop(stopwatchElapsed({ since: startedAt ?? Date.now(), now: Date.now() }));
    setStartedAt(null);
  }

  const running = startedAt !== null;
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const windowText = target === null ? null : target[0] === target[1] ? `${target[0]} s` : `${target[0]}–${target[1]} s`;
  // The rail fills toward the top of the window; the tick marks where it opens.
  const span = target === null ? null : target[1];
  const fill = span === null || span === 0 ? 0 : Math.min(1, elapsed / span);

  return (
    <button
      aria-label={running ? `Stop hold at ${clock}` : 'Start hold'}
      className={cn(
        'relative flex min-h-16 w-full items-center gap-3 overflow-hidden rounded-control px-4 pt-3 pb-4 text-left',
        running ? 'bg-live-ink text-on-fill shadow-lift' : 'bg-card text-ink shadow-dome hover:shadow-dome-lift',
        PRESS,
        FOCUS_RING,
      )}
      onClick={running ? stop : start}
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex size-12 shrink-0 items-center justify-center rounded-cell',
          running ? 'bg-on-fill/15' : 'bg-planned-wash text-planned-ink ring-1 ring-planned',
        )}
      >
        {running ? (
          <Square size={18} strokeWidth={ICON_STROKE} />
        ) : (
          <Timer size={20} strokeWidth={ICON_STROKE} />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        {running ? (
          <span aria-live="off" className="type-clock">
            {clock}
          </span>
        ) : (
          <span className="type-title">Start hold</span>
        )}
        <span className={cn(LABEL, 'truncate whitespace-nowrap', running && 'text-on-fill/90')}>
          {running ? `${phase(reached, target)} · tap to stop` : 'stopwatch'}
          {!running && windowText !== null && (
            <span className="text-planned-ink"> · {windowText}</span>
          )}
        </span>
      </span>

      {running && span !== null && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1.5 bg-scrim">
          <span
            className={cn(TIMER_RAIL, 'block')}
            style={{ transform: `scaleX(${fill})` }}
          />
          {target !== null && target[0] < target[1] && (
            <span
              className="absolute inset-y-0 w-0.5 bg-on-fill/80"
              style={{ left: `${(target[0] / target[1]) * 100}%` }}
            />
          )}
        </span>
      )}
    </button>
  );
}
