import { describe, expect, it } from 'vitest';
import { niceDomain } from '@/features/progress/ExerciseChart';

describe('niceDomain', () => {
  it('fits a slow climb instead of anchoring the axis at zero', () => {
    expect(niceDomain([75, 75, 77.5, 77.5, 80, 80, 82.5])).toEqual({
      lo: 70,
      hi: 85,
      ticks: [70, 75, 80, 85],
    });
  });

  it('gives a flat series a range to draw in', () => {
    const { lo, hi } = niceDomain([10, 10, 10]);
    expect(lo).toBeLessThan(10);
    expect(hi).toBeGreaterThan(10);
  });

  it('never dips below zero for a series that cannot go negative', () => {
    expect(niceDomain([1, 2, 3]).lo).toBe(0);
  });
});
