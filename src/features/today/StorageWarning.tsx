import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { HardDrive } from 'lucide-react';
import { ICON_STROKE, alert } from '@/features/ui/styles';
import { isInstalled, readStorageDurability, type StorageDurability } from '@/pwa/persistence';

/** Warns on Today, not only in Settings, because a browser that clears storage clears all of it at once. */
export function StorageWarning() {
  const [durability, setDurability] = useState<StorageDurability | null>(null);
  const installed = isInstalled();

  useEffect(() => {
    let live = true;
    void readStorageDurability().then((state) => {
      if (live) setDurability(state);
    });
    return () => {
      live = false;
    };
  }, []);

  if (durability === null) return null;
  if (installed && durability.state !== 'best-effort') return null;

  return (
    <div className={alert('planned')} role="status">
      <HardDrive aria-hidden="true" className="mt-0.5 shrink-0" size={18} strokeWidth={ICON_STROKE} />
      <div className="flex flex-col gap-1">
        <p className="type-title">
          {installed ? 'This browser may clear your training' : 'Add TrainLog to your home screen'}
        </p>
        <p className="type-body-sm">
          {installed
            ? 'It can drop everything at once to reclaim space. A backup kept off this phone is what protects it.'
            : 'In a browser tab, your training can be cleared after a week of not opening it. On iPhone: Share, then Add to Home Screen.'}
        </p>
        <Link className="type-body-sm underline underline-offset-4" to="/settings">
          {installed ? 'Save a backup' : 'See how it is stored'}
        </Link>
      </div>
    </div>
  );
}
