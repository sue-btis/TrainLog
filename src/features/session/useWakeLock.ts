/**
 * Screen Wake Lock while a session is open (§11.6).
 *
 * "Donde no esté disponible, se degrada en silencio" — so every failure path
 * here is a shrug. The API is absent on iOS Safari below 16.4 and the request
 * is rejected outright when the tab is not visible or the device is in low
 * power mode; none of that is a problem the lifter can act on, so none of it
 * produces a message.
 *
 * The lock is dropped by the browser whenever the page is hidden, which is why
 * releasing it is not enough on its own — coming back from a locked phone has
 * to ask again, or the screen would stay awake only until the first time it
 * slept.
 */

import { useEffect } from 'react';

export function useWakeLock(active: boolean): void {
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
