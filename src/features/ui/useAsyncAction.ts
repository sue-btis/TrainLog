import { useCallback, useState } from 'react';

export interface AsyncAction {
  /** Whether a run is in flight. Controls take it as `disabled`. */
  readonly busy: boolean;
  /** The message of the last rejection, cleared when the next run starts. */
  readonly failure: string | null;
  readonly run: (action: () => Promise<unknown>) => Promise<void>;
}

export function useAsyncAction(): AsyncAction {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

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
