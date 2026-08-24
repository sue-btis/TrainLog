/**
 * Asking the browser not to throw a lifter's training away.
 *
 * There is no account and no server, so IndexedDB is the only copy of every
 * Session this app has ever recorded. By default an origin is *best-effort*:
 * under storage pressure the browser evicts it, and MDN is explicit that
 * eviction takes "all of its data, not parts of it" — sessions, sets and the
 * service-worker cache go together. `navigator.storage.persist()` is what moves
 * the origin out of that bucket, and LRU eviction "skips over origins that have
 * been granted data persistence".
 *
 * It is the cheapest safety this app can buy, and it was not being asked for.
 *
 * Nothing here throws and nothing here blocks. A browser without the
 * StorageManager API, or one that refuses, leaves the app working exactly as it
 * did — the point is to take the protection where it is on offer, not to make
 * the app conditional on it.
 *
 * **Persistence is not the whole story on iOS.** WebKit deletes IndexedDB and
 * service-worker registrations after seven days of Safari use without
 * interacting with the site, and a home-screen web app is the documented way
 * out. That is an install prompt, not an API call, and it lives in the UI.
 */

export type StorageDurability =
  /** Granted: this origin is exempt from eviction under storage pressure. */
  | { readonly state: 'persisted' }
  /** The API exists and the browser said no — engagement usually earns it later. */
  | { readonly state: 'best-effort' }
  /** No StorageManager. Nothing to ask, nothing to report as refused. */
  | { readonly state: 'unsupported' };

/**
 * Ask once, and report what the browser decided.
 *
 * `persisted()` first: a granted origin must not be asked again, because in
 * some browsers a repeat `persist()` is what surfaces a permission prompt.
 * Chromium grants silently on engagement heuristics — bookmarked, installed,
 * high site-engagement — so calling this at a moment the lifter has actually
 * invested something is what makes a grant likely rather than a coin flip.
 */
export async function ensurePersistentStorage(): Promise<StorageDurability> {
  const storage = navigator.storage as StorageManager | undefined;
  if (storage === undefined || typeof storage.persist !== 'function') {
    return { state: 'unsupported' };
  }

  try {
    if (await storage.persisted()) return { state: 'persisted' };
    return { state: (await storage.persist()) ? 'persisted' : 'best-effort' };
  } catch {
    // A refused or unavailable permission is not an error a lifter can act on.
    return { state: 'best-effort' };
  }
}

/** What the browser currently says, without asking for anything. */
export async function readStorageDurability(): Promise<StorageDurability> {
  const storage = navigator.storage as StorageManager | undefined;
  if (storage === undefined || typeof storage.persisted !== 'function') {
    return { state: 'unsupported' };
  }
  try {
    return { state: (await storage.persisted()) ? 'persisted' : 'best-effort' };
  } catch {
    return { state: 'best-effort' };
  }
}

/** Whether the app is running from the home screen rather than a browser tab. */
export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari predates the display-mode media query for home-screen apps.
    ('standalone' in navigator && navigator.standalone === true)
  );
}
