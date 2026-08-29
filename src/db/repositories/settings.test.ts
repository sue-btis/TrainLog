import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '@/db/database';
import {
  DEFAULT_SETTINGS,
  DEFAULT_UNIT,
  getDefaultUnit,
  getSettings,
  setBodyweightKg,
  setDefaultRir,
  setDefaultUnit,
  setKeepScreenAwake,
  setTimerSound,
  setTimerVibration,
} from '@/db/repositories/settings';

beforeEach(resetDatabase);

describe('settings', () => {
  it('reports the defaults before anything is written', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await db.settings.count()).toBe(0);
  });

  it('starts from the behaviour that already shipped: buzzing, awake, silent', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      id: 'settings',
      defaultUnit: DEFAULT_UNIT,
      defaultRir: null,
      timerVibration: true,
      timerSound: false,
      keepScreenAwake: true,
      lastBackupAt: null,
      // Null means no weigh-in; zero would be a claim about the lifter.
      bodyweightKg: null,
    });
  });

  it('completes a row written before the other settings existed, and leaves it alone', async () => {
    await db.settings.put({ id: 'settings', defaultUnit: 'lb' });

    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, defaultUnit: 'lb' });
    expect(await db.settings.get('settings')).toEqual({ id: 'settings', defaultUnit: 'lb' });
    expect(await db.settings.count()).toBe(1);
  });

  it('reads the written default unit back after a reopen', async () => {
    await setDefaultUnit('lb');

    db.close();
    await db.open();

    expect(await getDefaultUnit()).toBe('lb');
  });

  it('keeps every other setting when one is written', async () => {
    await setDefaultUnit('lb');
    await setTimerVibration(false);
    await setDefaultRir(2);
    await setTimerSound(true);
    await setKeepScreenAwake(false);
    await setBodyweightKg(82.5);

    db.close();
    await db.open();

    expect(await getSettings()).toEqual({
      id: 'settings',
      defaultUnit: 'lb',
      defaultRir: 2,
      timerVibration: false,
      timerSound: true,
      keepScreenAwake: false,
      lastBackupAt: null,
      bodyweightKg: 82.5,
    });
  });

  it('stays a single row when written repeatedly', async () => {
    await setDefaultUnit('lb');
    await setDefaultUnit('kg');
    await setTimerSound(true);

    expect(await db.settings.count()).toBe(1);
    expect(await getDefaultUnit()).toBe('kg');
  });

  // Clearing bodyweight means "not stated", never zero.
  it('clears a bodyweight to null rather than zero', async () => {
    await setBodyweightKg(82.5);
    await setBodyweightKg(null);

    expect((await getSettings()).bodyweightKg).toBeNull();
  });

  it('stores no RIR opinion as null rather than zero', async () => {
    await setDefaultRir(2);
    await setDefaultRir(null);

    expect((await getSettings()).defaultRir).toBeNull();
  });
});
