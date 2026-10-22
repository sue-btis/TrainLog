import { exportBackup, restoreBackup } from '@/db';
import { RESTORED_TABLES, type BackupDocument } from '@/domain/backup';
import { formatLocalDate } from '@/domain/dates';
import { download } from '@/features/settings/download';

/**
 * Downloads the current data before replacing it, so a wrong file never costs
 * a lifter their history. If the download throws, nothing is restored. A fresh
 * phone has nothing to lose, so it gets no file.
 */
export async function restoreWithSafetyBackup(document: BackupDocument): Promise<void> {
  const now = Date.now();
  const current = await exportBackup(now);

  if (RESTORED_TABLES.some((table) => current[table].length > 0)) {
    download(
      `trainlog-before-restore-${formatLocalDate(new Date(now))}.json`,
      JSON.stringify(current),
      'application/json',
    );
  }

  await restoreBackup(document);
}
