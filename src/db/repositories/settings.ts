/**
 * Settings (REQ-077, §32).
 *
 * A single row keyed `'settings'`, holding defaults and nothing else. The unit
 * here is only the default applied when a routine file omits one; each Exercise
 * keeps its own (§12, §11.7).
 *
 * **Reads default per field, not per row.** Every install that predates the
 * four later settings has a row on disk carrying `defaultUnit` alone. Treating
 * "a row exists" as "the row is complete" would hand the screens `undefined`
 * for the three booleans — and `undefined` is falsy, so the rest timer would
 * stop buzzing and the screen would stop being held awake for every lifter who
 * has ever chosen a unit. `resolve` is what stops that, and it writes nothing:
 * an old row stays an old row until the lifter changes something.
 *
 * **Writes one field, never the row.** `update` rather than `put`, because a
 * `put` of a freshly-built object is exactly how saving the unit would silently
 * reset the other four.
 */

import { db } from '@/db/database';
import type { ResolvedSettings, Settings, Unit } from '@/domain/types';

const SETTINGS_ID = 'settings' as const;

/** The default the app starts with before the user ever chooses one. */
export const DEFAULT_UNIT: Unit = 'kg';

/**
 * What each setting is before anyone touches it.
 *
 * The three booleans are today's behaviour written down: the timer already
 * buzzes and the screen is already held awake, and nobody's gym mode may change
 * because a settings screen appeared. Sound is the one genuinely new thing, so
 * it starts off.
 */
export const DEFAULT_SETTINGS: ResolvedSettings = {
  id: SETTINGS_ID,
  defaultUnit: DEFAULT_UNIT,
  defaultRir: null,
  timerVibration: true,
  timerSound: false,
  keepScreenAwake: true,
};

/** Fills in whatever the stored row does not carry. Never writes. */
function resolve(stored: Settings | undefined): ResolvedSettings {
  return { ...DEFAULT_SETTINGS, ...stored, id: SETTINGS_ID };
}

/** The settings row, complete, whatever the database holds. */
export async function getSettings(): Promise<ResolvedSettings> {
  return resolve(await db.settings.get(SETTINGS_ID));
}

/** The default unit, for `routineFileToDomain` (REQ-034). */
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
