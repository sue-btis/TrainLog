/**
 * One write, and whether it has finished.
 *
 * Modelled on `SessionScreen`'s own `run`, which was the only copy of this in
 * the app. Every other screen fired its writes with a bare `void` and rendered
 * nothing while they ran, so a backup export over a full database, a restore
 * that replaces every table, and a control that had simply done nothing were
 * the same picture. A rejected promise was the same picture too — nothing
 * caught it.
 *
 * `busy` is the point. A control reads it to disable itself, which is what
 * makes the second press of a write still in flight impossible rather than
 * merely unlikely: `Start workout` pressed twice used to write one Session and
 * then report REQ-058 against the one it had just written.
 *
 * One flag per screen rather than one per action, deliberately — while a
 * restore is running, an export is not a thing a lifter should be able to start.
 */

import { useCallback, useState } from 'react';

export interface AsyncAction {
  /** Whether a run is in flight. Controls take it as `disabled`. */
  readonly busy: boolean;
  /** The message of the last rejection, cleared when the next run starts. */
  readonly failure: string | null;
  /** Stable across renders, so an effect that starts a write can depend on it. */
  readonly run: (action: () => Promise<unknown>) => Promise<void>;
}

export function useAsyncAction(): AsyncAction {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Both setters are stable, so the empty dependency list is the whole truth —
  // and a stable `run` is what lets `ImportWizard` start its read from a
  // mount effect without the effect re-running on every render.
  const run = useCallback(async (action: () => Promise<unknown>): Promise<void> => {
    setFailure(null);
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, failure, run };
}
