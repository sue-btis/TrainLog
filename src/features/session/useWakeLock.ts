import { useEffect } from 'react';

export function useWakeLock(active: boolean): void {
  // Wake Lock is optional; browsers drop it when hidden, so visibility reacquires it silently.
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let dropped = false;

    async function acquire() {
      if (dropped || document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        // Refused — low power mode, a hidden tab, a policy. Nothing to say.
      }
    }
    function onVisible() {
      if (document.visibilityState === 'visible') void acquire();
    }

    void acquire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      dropped = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
