import { CATEGORIES } from '@/domain/catalog';
import type { ExerciseId } from '@/domain/ids';

/** Sets of one exercise, planned or logged, with the category its Exercise declares. */
export interface VolumeEntry {
  readonly exerciseId: ExerciseId;
  readonly name: string;
  readonly category: string | null;
  readonly sets: number;
}

export interface VolumeRow {
  readonly planned: number;
  readonly performed: number;
}

export interface MuscleVolume extends VolumeRow {
  readonly category: string;
}

export interface UncategorizedVolume extends VolumeRow {
  readonly exerciseId: ExerciseId;
  readonly name: string;
}

export interface WeeklyVolume {
  readonly muscles: readonly MuscleVolume[];
  /** Exercises whose category the catalog does not know, kept apart so they cannot inflate a muscle. */
  readonly uncategorized: readonly UncategorizedVolume[];
}

export function weeklyVolume(
  planned: readonly VolumeEntry[],
  performed: readonly VolumeEntry[],
): WeeklyVolume {
  const known = new Set(CATEGORIES);
  const muscles = new Map<string, { planned: number; performed: number }>();
  const other = new Map<ExerciseId, { name: string; planned: number; performed: number }>();

  const add = (entry: VolumeEntry, side: 'planned' | 'performed') => {
    if (entry.category !== null && known.has(entry.category)) {
      const row = muscles.get(entry.category) ?? { planned: 0, performed: 0 };
      row[side] += entry.sets;
      muscles.set(entry.category, row);
      return;
    }
    const row = other.get(entry.exerciseId) ?? { name: entry.name, planned: 0, performed: 0 };
    row[side] += entry.sets;
    other.set(entry.exerciseId, row);
  };

  for (const entry of planned) add(entry, 'planned');
  for (const entry of performed) add(entry, 'performed');

  return {
    muscles: CATEGORIES.filter((category) => muscles.has(category)).map((category) => ({
      category,
      ...muscles.get(category)!,
    })),
    uncategorized: [...other].map(([exerciseId, row]) => ({ exerciseId, ...row })),
  };
}
