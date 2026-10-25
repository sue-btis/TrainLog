import { describe, expect, it } from 'vitest';
import { backupIsDue } from '@/domain/backup/due';

const DAY = 86_400_000;

describe('backupIsDue', () => {
  it('is due when no backup was ever taken', () => {
    expect(backupIsDue(null, 0)).toBe(true);
  });

  it('is not due within the week, and is due from the seventh day', () => {
    expect(backupIsDue(0, 6 * DAY + DAY - 1)).toBe(false);
    expect(backupIsDue(0, 7 * DAY)).toBe(true);
  });
});
