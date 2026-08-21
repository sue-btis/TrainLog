/**
 * Backup, restore and CSV export (§17, §18, §19).
 *
 * Everything here is pure. The document is a value, validating it is a function
 * over a string, and the CSV is a function over rows. Reading and writing
 * tables belongs to `src/db/repositories/backup.ts`; choosing a file and
 * offering a download belongs to `src/features/more`.
 *
 * ```ts
 * const result = parseBackup(text);      // rejects, or hands back a document
 * if (!result.ok) return result.errors;  // nothing is written on a failure
 * await restoreBackup(result.document);  // db layer, one transaction
 * ```
 *
 * `BACKUP_VERSION` is the compatibility lever: §18 refuses a document newer
 * than the build rather than reading it partially.
 */

export {
  BACKUP_VERSION,
  RESTORED_TABLES,
  type BackupDocument,
  type RestoredTable,
} from '@/domain/backup/document';

export {
  formatPath,
  parseBackup,
  type FieldPath,
  type ParseBackupResult,
  type StructuralError,
} from '@/domain/backup/schema';
