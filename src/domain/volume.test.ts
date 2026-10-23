import { describe, expect, it } from 'vitest';
import { toId, type ExerciseId } from '@/domain/ids';
import { weeklyVolume, type VolumeEntry } from '@/domain/volume';

function entry(id: string, category: string | null, sets: number): VolumeEntry {
  return { exerciseId: toId<ExerciseId>(id), name: id, category, sets };
}

describe('weeklyVolume', () => {
  it('sums planned sets per category across Placements', () => {
    const bench = entry('dumbbell-bench-press', 'chest', 3);

    expect(weeklyVolume([bench, bench], []).muscles).toEqual([
      { category: 'chest', planned: 6, performed: 0 },
    ]);
  });

  it('counts logged sets under their category whether or not they were planned', () => {
    const volume = weeklyVolume(
      [entry('dumbbell-bench-press', 'chest', 3)],
      [entry('dumbbell-bench-press', 'chest', 2), entry('hammer-curl', 'biceps', 3)],
    );

    expect(volume.muscles).toEqual([
      { category: 'chest', planned: 3, performed: 2 },
      { category: 'biceps', planned: 0, performed: 3 },
    ]);
  });

  it('keeps unknown and missing categories apart, by exercise', () => {
    const volume = weeklyVolume(
      [entry('pogo-jumps', 'pantorrilla', 2), entry('windmill', null, 2)],
      [entry('pogo-jumps', 'pantorrilla', 2)],
    );

    expect(volume.muscles).toEqual([]);
    expect(volume.uncategorized).toEqual([
      { exerciseId: 'pogo-jumps', name: 'pogo-jumps', planned: 2, performed: 2 },
      { exerciseId: 'windmill', name: 'windmill', planned: 2, performed: 0 },
    ]);
  });

  it('orders muscles as the catalog does and omits the empty ones', () => {
    const volume = weeklyVolume(
      [entry('hammer-curl', 'biceps', 3), entry('front-squat', 'quadriceps', 4)],
      [],
    );

    expect(volume.muscles.map((row) => row.category)).toEqual(['quadriceps', 'biceps']);
  });
});
