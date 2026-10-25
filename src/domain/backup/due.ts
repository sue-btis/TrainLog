import { daysSince, type Timestamp } from '@/domain/dates';

/** How old a backup may get before the finish screen asks for a new one. */
export const BACKUP_REMINDER_DAYS = 7;

export function backupIsDue(lastBackupAt: Timestamp | null, now: Timestamp): boolean {
  return lastBackupAt === null || daysSince(lastBackupAt, now) >= BACKUP_REMINDER_DAYS;
}
