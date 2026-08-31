import { describe, expect, it } from 'vitest';
import { toKg, toMetres, type DistanceUnit, type Unit } from '@/domain/units';

describe('toKg', () => {
  const cases: ReadonlyArray<{ weight: number; unit: Unit; expected: number }> = [
    { weight: 100, unit: 'lb', expected: 45.359 },
    { weight: 75, unit: 'kg', expected: 75 },
    { weight: 0, unit: 'kg', expected: 0 },
    { weight: 2.5, unit: 'kg', expected: 2.5 },
    { weight: 77.5, unit: 'kg', expected: 77.5 },
    { weight: 20.00049, unit: 'kg', expected: 20 },
    { weight: 20.0005, unit: 'kg', expected: 20.001 },
    { weight: 20.9999, unit: 'kg', expected: 21 },
    { weight: 0, unit: 'lb', expected: 0 },
    { weight: 1, unit: 'lb', expected: 0.454 },
    { weight: 2.5, unit: 'lb', expected: 1.134 },
    { weight: 45, unit: 'lb', expected: 20.412 },
    { weight: 135, unit: 'lb', expected: 61.235 },
    { weight: 225, unit: 'lb', expected: 102.058 },
    { weight: 315, unit: 'lb', expected: 142.882 },
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

describe('toMetres (TST-112)', () => {
  const cases: ReadonlyArray<{ distance: number; unit: DistanceUnit; expected: number }> = [
    { distance: 5, unit: 'km', expected: 5000 },
    { distance: 1, unit: 'mi', expected: 1609.344 },
    { distance: 42, unit: 'm', expected: 42 },
    { distance: 0, unit: 'm', expected: 0 },
    { distance: 2.5, unit: 'm', expected: 2.5 },
    { distance: 20.00049, unit: 'm', expected: 20 },
    { distance: 20.0005, unit: 'm', expected: 20.001 },
    { distance: 20.9999, unit: 'm', expected: 21 },
    { distance: 0, unit: 'km', expected: 0 },
    { distance: 1.5, unit: 'km', expected: 1500 },
    { distance: 0.0001, unit: 'km', expected: 0.1 },
    { distance: 0, unit: 'mi', expected: 0 },
    { distance: 0.5, unit: 'mi', expected: 804.672 },
    { distance: 3, unit: 'mi', expected: 4828.032 },
  ];

  it.each(cases)('toMetres($distance, $unit) === $expected', ({ distance, unit, expected }) => {
    expect(toMetres(distance, unit)).toBe(expected);
  });

  it('TST-112: never returns more than 3 decimal places, exactly as toKg does', () => {
    for (const { distance, unit } of cases) {
      const decimals = String(toMetres(distance, unit)).split('.')[1] ?? '';
      expect(decimals.length).toBeLessThanOrEqual(3);
    }
  });

  it('TST-112: round-trips a metre value back through its own unit', () => {
    expect(toMetres(toMetres(5, 'km') / 1000, 'km')).toBe(5000);
    expect(toMetres(toMetres(1, 'mi') / 1609.344, 'mi')).toBe(1609.344);
  });
});
