import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

/** Never reloads on its own: a deploy must not interrupt a session in progress. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      className="fixed inset-x-4 top-4 z-50 flex items-center justify-between gap-3 rounded-lg border bg-white p-3 shadow-lg"
      role="status"
    >
      <p className="type-body-sm text-ink-2">New version available.</p>
      <Button onClick={() => void updateServiceWorker(true)} size="compact" type="button" variant="primary">
        Reload
      </Button>
    </div>
  );
}
