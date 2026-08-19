/**
 * REQ-077 / AC-079 — the default unit is written and read through the
 * repository layer, and survives a fresh database handle.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import { DEFAULT_UNIT, getDefaultUnit, getSettings, setDefaultUnit } from '@/db/repositories/settings';

beforeEach(resetDatabase);

describe('settings', () => {
  it('reports the default before anything is written', async () => {
    expect(await getSettings()).toEqual({ id: 'settings', defaultUnit: DEFAULT_UNIT });
    expect(await db.settings.count()).toBe(0);
  });

  // AC-079
  it('reads the written default unit back after a reopen', async () => {
    await setDefaultUnit('lb');

    db.close();
    await db.open();

    expect(await getDefaultUnit()).toBe('lb');
    expect(await getSettings()).toEqual({ id: 'settings', defaultUnit: 'lb' });
  });

  it('stays a single row when written repeatedly', async () => {
    await setDefaultUnit('lb');
    await setDefaultUnit('kg');

    expect(await db.settings.count()).toBe(1);
    expect(await getDefaultUnit()).toBe('kg');
  });
});
