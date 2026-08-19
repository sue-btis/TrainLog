/**
 * Settings (REQ-077, §32).
 *
 * A single row keyed `'settings'`. The unit here is only the default applied
 * when a routine file omits one; each Exercise keeps its own (§12, §11.7).
 */

import { db } from '@/db/database';
import type { Settings, Unit } from '@/domain/types';

const SETTINGS_ID = 'settings' as const;

/** The default the app starts with before the user ever chooses one. */
export const DEFAULT_UNIT: Unit = 'kg';

/** The settings row, or the defaults when nothing has been written yet. */
export async function getSettings(): Promise<Settings> {
  return (await db.settings.get(SETTINGS_ID)) ?? { id: SETTINGS_ID, defaultUnit: DEFAULT_UNIT };
}

/** The default unit, for `routineFileToDomain` (REQ-034). */
export async function getDefaultUnit(): Promise<Unit> {
  return (await getSettings()).defaultUnit;
}

export async function setDefaultUnit(defaultUnit: Unit): Promise<void> {
  await db.settings.put({ id: SETTINGS_ID, defaultUnit });
}
