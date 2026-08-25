/**
 * REQ-077 / AC-079 — settings are written and read through the repository
 * layer and survive a fresh database handle.
 *
 * Two of these tests exist because of how the row grew rather than what it
 * holds. `defaultUnit` shipped alone, so every install that predates the other
 * four settings has a partial row on disk: reading it must complete it (AC-1a)
 * without rewriting it (AC-1b), and writing one field must not take the other
 * four with it (AC-2a). Both failures are silent — the first switches gym mode
 * off for existing lifters, the second quietly forgets what they just chose.
 */

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
  // AC-1c
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
      // Never backed up is the state every install starts in, and the one the
      // settings screen has to be able to say out loud.
      lastBackupAt: null,
      // Never weighed in. Null, never zero — a zero would be a claim about a
      // lifter rather than an absence (AM-1, superseding AC-112).
      bodyweightKg: null,
    });
  });

  // AC-1a / AC-1b — the row every existing install carries.
  it('completes a row written before the other settings existed, and leaves it alone', async () => {
    await db.settings.put({ id: 'settings', defaultUnit: 'lb' });

    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, defaultUnit: 'lb' });
    expect(await db.settings.get('settings')).toEqual({ id: 'settings', defaultUnit: 'lb' });
    expect(await db.settings.count()).toBe(1);
  });

  // AC-079
  it('reads the written default unit back after a reopen', async () => {
    await setDefaultUnit('lb');

    db.close();
    await db.open();

    expect(await getDefaultUnit()).toBe('lb');
  });

  // AC-2a — the whole reason the writer is not a `put` of a fresh object.
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

  // AC-2b
  it('stays a single row when written repeatedly', async () => {
    await setDefaultUnit('lb');
    await setDefaultUnit('kg');
    await setTimerSound(true);

    expect(await db.settings.count()).toBe(1);
    expect(await getDefaultUnit()).toBe('kg');
  });

  // AM-1 (superseding REQ-108/AC-112) — Settings is the one home of a stated
  // bodyweight, and clearing it means "not stated", never zero.
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
