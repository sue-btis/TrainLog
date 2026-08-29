import { db } from '@/db/database';
import type { ResolvedSettings, Settings, Timestamp, Unit } from '@/domain/types';

const SETTINGS_ID = 'settings' as const;

export const DEFAULT_UNIT: Unit = 'kg';

export const DEFAULT_SETTINGS: ResolvedSettings = {
  id: SETTINGS_ID,
  defaultUnit: DEFAULT_UNIT,
  defaultRir: null,
  timerVibration: true,
  timerSound: false,
  keepScreenAwake: true,
  lastBackupAt: null,
  bodyweightKg: null,
};

/** Merge defaults per field so rows from older versions remain compatible. */
function resolve(stored: Settings | undefined): ResolvedSettings {
  return { ...DEFAULT_SETTINGS, ...stored, id: SETTINGS_ID };
}

export async function getSettings(): Promise<ResolvedSettings> {
  return resolve(await db.settings.get(SETTINGS_ID));
}

export async function getDefaultUnit(): Promise<Unit> {
  return (await getSettings()).defaultUnit;
}

/**
 * Writes one setting, leaving the others as they are.
 *
 * Read and write sit in one transaction so the row that is written is the row
 * that was read — two controls pressed in the same breath cannot each save over
 * the other's field.
 */
async function setSetting<K extends keyof ResolvedSettings>(
  key: K,
  value: ResolvedSettings[K],
): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = resolve(await db.settings.get(SETTINGS_ID));
    await db.settings.put({ ...current, [key]: value });
  });
}

export async function setDefaultUnit(defaultUnit: Unit): Promise<void> {
  await setSetting('defaultUnit', defaultUnit);
}

export async function setDefaultRir(defaultRir: number | null): Promise<void> {
  await setSetting('defaultRir', defaultRir);
}

export async function setTimerVibration(on: boolean): Promise<void> {
  await setSetting('timerVibration', on);
}

export async function setTimerSound(on: boolean): Promise<void> {
  await setSetting('timerSound', on);
}

export async function setKeepScreenAwake(on: boolean): Promise<void> {
  await setSetting('keepScreenAwake', on);
}

/** `null` clears the current bodyweight without changing past Sessions. */
export async function setBodyweightKg(bodyweightKg: number | null): Promise<void> {
  await setSetting('bodyweightKg', bodyweightKg);
}

export async function setLastBackupAt(at: Timestamp): Promise<void> {
  await setSetting('lastBackupAt', at);
}
