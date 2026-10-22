import { exportBackup, restoreBackup } from '@/db';
import { RESTORED_TABLES, type BackupDocument } from '@/domain/backup';
import { formatLocalDate } from '@/domain/dates';
import { download } from '@/features/settings/download';

/**
 * Downloads the current data before replacing it, so a wrong file never costs
 * a lifter their history. If the download throws, nothing is restored. A fresh
 * phone has nothing to lose, so it gets no file. Returns the file's name, or
 * `null` when none was downloaded.
 */
export async function restoreWithSafetyBackup(document: BackupDocument): Promise<string | null> {
  const now = Date.now();
  const current = await exportBackup(now);

  const fileName = RESTORED_TABLES.some((table) => current[table].length > 0)
    ? `trainlog-before-restore-${formatLocalDate(new Date(now))}.json`
    : null;
  if (fileName !== null) download(fileName, JSON.stringify(current), 'application/json');

  await restoreBackup(document);
  return fileName;
}
