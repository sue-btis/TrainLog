import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import { exportBackup } from '@/db/repositories/backup';
import { toId } from '@/domain/ids';
import type { RoutineId } from '@/domain/ids';
import type { Routine } from '@/domain/types';
import { download } from '@/features/settings/download';
import { restoreWithSafetyBackup } from '@/features/settings/safeRestore';

vi.mock('@/features/settings/download', () => ({ download: vi.fn() }));

const existing: Routine = {
  id: toId<RoutineId>('old'),
  name: 'Old',
  weeks: 4,
  status: 'active',
  createdAt: 1,
};
const incoming: Routine = { ...existing, id: toId<RoutineId>('new'), name: 'New' };

async function routineIds(): Promise<string[]> {
  return (await db.routines.toArray()).map((routine) => routine.id);
}

beforeEach(async () => {
  vi.mocked(download).mockReset();
  await resetDatabase();
});

describe('restoreWithSafetyBackup', () => {
  it('downloads the current data before replacing it', async () => {
    await db.routines.add(existing);
    const document = { ...(await exportBackup(2)), routines: [incoming] };
    let idsAtDownload: string[] = [];
    vi.mocked(download).mockImplementation((_name, contents) => {
      idsAtDownload = (JSON.parse(contents) as { routines: Routine[] }).routines.map(
        (routine) => routine.id,
      );
    });

    await restoreWithSafetyBackup(document);

    expect(vi.mocked(download).mock.calls[0]?.[0]).toMatch(/^trainlog-before-restore-.*\.json$/);
    expect(idsAtDownload).toEqual(['old']);
    expect(await routineIds()).toEqual(['new']);
  });

  it('leaves the data untouched when the backup cannot be downloaded', async () => {
    await db.routines.add(existing);
    const document = { ...(await exportBackup(2)), routines: [incoming] };
    vi.mocked(download).mockImplementation(() => {
      throw new Error('blocked');
    });

    await expect(restoreWithSafetyBackup(document)).rejects.toThrow('blocked');

    expect(await routineIds()).toEqual(['old']);
  });

  it('skips the download when there is nothing to lose', async () => {
    const document = { ...(await exportBackup(2)), routines: [incoming] };

    await restoreWithSafetyBackup(document);

    expect(download).not.toHaveBeenCalled();
    expect(await routineIds()).toEqual(['new']);
  });
});
