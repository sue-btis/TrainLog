import { useState } from 'react';
import { LoaderCircle, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { backupIsDue } from '@/domain/backup';
import { daysSince } from '@/domain/dates';
import { useSettings } from '@/features/data/queries';
import { BACKUP_SAVED, saveBackup } from '@/features/settings/saveBackup';
import { ICON_STROKE, WELL } from '@/features/ui/styles';
import { useAsyncAction } from '@/features/ui/useAsyncAction';
import { plural } from '@/features/ui/format';

/** Asks for a backup right after training, when the newest one is a week old or missing. */
export function BackupReminder() {
  const settings = useSettings();
  // Read once: the reminder is about the moment the screen opened, not a clock.
  const [now] = useState(Date.now);
  const [saved, setSaved] = useState<string | null>(null);
  const { busy, failure, run } = useAsyncAction();

  if (settings === undefined) return null;
  if (saved !== null) {
    return (
      <section className={WELL}>
        <p className="type-body-sm text-ink-2">{saved}</p>
      </section>
    );
  }

  const last = settings.lastBackupAt ?? null;
  if (!backupIsDue(last, now)) return null;

  return (
    <section aria-label="Backup reminder" className={WELL}>
      <p className="type-title">
        {last === null
          ? 'Nothing outside this phone holds your training'
          : `Last backup ${plural(daysSince(last, now), 'day')} ago`}
      </p>
      <p className="type-body-sm text-ink-2">
        Save one now and pick where it goes — your Drive, Files, or an email to yourself.
      </p>
      <Button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const outcome = await saveBackup();
            if (outcome !== 'cancelled') setSaved(BACKUP_SAVED[outcome]);
          })
        }
        size="block"
        type="button"
        variant="secondary"
      >
        {busy ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" size={18} strokeWidth={ICON_STROKE} />
        ) : (
          <Share aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
        )}
        {busy ? 'Saving…' : 'Save backup'}
      </Button>
      {failure !== null && (
        <p className="type-body-sm text-missed-ink" role="alert">
          {failure}
        </p>
      )}
    </section>
  );
}
