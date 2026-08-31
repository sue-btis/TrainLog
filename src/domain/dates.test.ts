import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatLocalDate,
  isLocalDate,
  mondayOfWeek,
  parseLocalDate,
  toLocalDate,
} from '@/domain/dates';

describe('local dates', () => {
  it('formats a Date as its local calendar day, not its UTC day (AC-014)', () => {
    // 23:30 local on the 18th is the 19th in UTC for any negative offset.
    expect(formatLocalDate(new Date(2026, 7, 18, 23, 30))).toBe('2026-08-18');
    // 00:30 local on the 18th is the 17th in UTC for any positive offset.
    expect(formatLocalDate(new Date(2026, 7, 18, 0, 30))).toBe('2026-08-18');
  });

  it('round-trips a local date through parse and format', () => {
    for (const value of ['2026-01-01', '2026-02-28', '2024-02-29', '2026-08-19', '2026-12-31']) {
      const date = toLocalDate(value);
      expect(formatLocalDate(parseLocalDate(date))).toBe(value);
    }
  });

  it('parses to local midnight', () => {
    const date = parseLocalDate(toLocalDate('2026-08-19'));
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 7, 19]);
    expect([date.getHours(), date.getMinutes(), date.getSeconds()]).toEqual([0, 0, 0]);
  });

  it('rejects anything that is not a real YYYY-MM-DD day', () => {
    for (const value of ['2026-8-19', '19-08-2026', '2026-08-19T00:00:00Z', '2026-13-01', '2026-02-30', '']) {
      expect(isLocalDate(value)).toBe(false);
      expect(() => toLocalDate(value)).toThrow();
    }
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays(toLocalDate('2026-08-30'), 3)).toBe('2026-09-02');
    expect(addDays(toLocalDate('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(toLocalDate('2024-02-28'), 1)).toBe('2024-02-29');
    expect(addDays(toLocalDate('2026-01-01'), -1)).toBe('2025-12-31');
    expect(addDays(toLocalDate('2026-08-19'), 0)).toBe('2026-08-19');
  });
});

describe('mondayOfWeek', () => {
  it('returns the date itself for a Monday', () => {
    expect(mondayOfWeek(toLocalDate('2026-08-17'))).toBe('2026-08-17');
  });

  it('returns the same Monday for every day of that week', () => {
    // 2026-08-17 is a Monday; 2026-08-23 is the Sunday that closes its week.
    const week = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'];
    for (const day of week) {
      expect(mondayOfWeek(toLocalDate(day))).toBe('2026-08-17');
    }
  });

  it('crosses a week boundary: Sunday belongs to the week that began six days earlier', () => {
    expect(mondayOfWeek(toLocalDate('2026-08-23'))).toBe('2026-08-17');
    expect(mondayOfWeek(toLocalDate('2026-08-24'))).toBe('2026-08-24');
  });

  it('crosses a month boundary', () => {
    // 2026-09-02 is a Wednesday; its Monday is in August.
    expect(mondayOfWeek(toLocalDate('2026-09-02'))).toBe('2026-08-31');
  });

  it('crosses a year boundary', () => {
    // 2027-01-01 is a Friday; its Monday is 2026-12-28.
    expect(mondayOfWeek(toLocalDate('2027-01-01'))).toBe('2026-12-28');
  });
});
