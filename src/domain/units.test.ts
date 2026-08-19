import { describe, expect, it } from 'vitest';
import { toKg, type Unit } from '@/domain/units';

describe('toKg', () => {
  const cases: ReadonlyArray<{ weight: number; unit: Unit; expected: number }> = [
    // AC-013
    { weight: 100, unit: 'lb', expected: 45.359 },
    { weight: 75, unit: 'kg', expected: 75 },
    // kg passes through, rounded to the same precision
    { weight: 0, unit: 'kg', expected: 0 },
    { weight: 2.5, unit: 'kg', expected: 2.5 },
    { weight: 77.5, unit: 'kg', expected: 77.5 },
    { weight: 20.00049, unit: 'kg', expected: 20 },
    { weight: 20.0005, unit: 'kg', expected: 20.001 },
    { weight: 20.9999, unit: 'kg', expected: 21 },
    // lb converts by the exact factor 0.45359237, then rounds
    { weight: 0, unit: 'lb', expected: 0 },
    { weight: 1, unit: 'lb', expected: 0.454 }, // 0.45359237
    { weight: 2.5, unit: 'lb', expected: 1.134 }, // 1.133980925
    { weight: 45, unit: 'lb', expected: 20.412 }, // 20.4116566...
    { weight: 135, unit: 'lb', expected: 61.235 }, // 61.23496995
    { weight: 225, unit: 'lb', expected: 102.058 }, // 102.05828325
    { weight: 315, unit: 'lb', expected: 142.882 }, // 142.88159655
  ];

  it.each(cases)('toKg($weight, $unit) === $expected', ({ weight, unit, expected }) => {
    expect(toKg(weight, unit)).toBe(expected);
  });

  it('never returns more than 3 decimal places', () => {
    for (const { weight, unit } of cases) {
      const decimals = String(toKg(weight, unit)).split('.')[1] ?? '';
      expect(decimals.length).toBeLessThanOrEqual(3);
    }
  });
});
