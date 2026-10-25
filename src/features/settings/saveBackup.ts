import { exportBackup, setLastBackupAt } from '@/db';
import { encryptBackupText } from '@/domain/backup';
import { formatLocalDate } from '@/domain/dates';
import { download } from '@/features/settings/download';

export type BackupOutcome = 'shared' | 'downloaded' | 'cancelled';

export const BACKUP_SAVED: Record<Exclude<BackupOutcome, 'cancelled'>, string> = {
  shared: 'Backup handed off. Make sure it landed somewhere that is not this phone.',
  downloaded: 'Backup saved. Keep it somewhere that is not this phone.',
};

/**
 * Hands the backup to the phone's share sheet, where the lifter picks where it
 * goes; the app itself sends nothing anywhere. With a password the file is
 * encrypted first. Falls back to a download where file sharing is missing or
 * refused. A cancelled share records no backup.
 */
export async function saveBackup(password?: string): Promise<BackupOutcome> {
  const at = Date.now();
  const date = formatLocalDate(new Date(at));
  const plain = JSON.stringify(await exportBackup(at));
  const name =
    password === undefined ? `trainlog-backup-${date}.json` : `trainlog-backup-${date}-encrypted.json`;
  const contents = password === undefined ? plain : await encryptBackupText(plain, password);
  const file = new File([contents], name, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] }) === true) {
    try {
      await navigator.share({ files: [file], title: 'TrainLog backup' });
      await setLastBackupAt(at);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // NotAllowedError lands here when the awaited export outlived the tap's
      // activation window; the download still gets the file off the phone.
      if (!(error instanceof DOMException && error.name === 'NotAllowedError')) throw error;
    }
  }

  download(name, contents, 'application/json');
  await setLastBackupAt(at);
  return 'downloaded';
}
