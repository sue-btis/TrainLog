export type StorageDurability =
  | { readonly state: 'persisted' }
  | { readonly state: 'best-effort' }
  | { readonly state: 'unsupported' };

export async function ensurePersistentStorage(): Promise<StorageDurability> {
  // This hint is best-effort; capability or permission failures must not block training.
  const storage = navigator.storage as StorageManager | undefined;
  if (storage === undefined || typeof storage.persist !== 'function') {
    return { state: 'unsupported' };
  }

  try {
    if (await storage.persisted()) return { state: 'persisted' };
    return { state: (await storage.persist()) ? 'persisted' : 'best-effort' };
  } catch {
    return { state: 'best-effort' };
  }
}
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

export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari predates the display-mode media query for home-screen apps.
    ('standalone' in navigator && navigator.standalone === true)
  );
}
