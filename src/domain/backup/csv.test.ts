/**
 * CSV export (AC-8).
 *
 * The serializer is pure text handling, so the interesting cases are the ones
 * that break a column count: a name with a comma in it, a quote, a newline.
 * A CSV that silently shifts every later column is worse than one that fails.
 */

import { describe, expect, it } from 'vitest';
import { CSV_HEADER, toCsv, type CsvRow } from '@/domain/backup/csv';
import { toLocalDate } from '@/domain/dates';

function aRow(overrides: Partial<CsvRow> = {}): CsvRow {
  return {
    date: toLocalDate('2026-08-18'),
    exercise: 'Front Squat',
    set: 1,
    weight: 75,
    unit: 'kg',
    reps: 6,
    rir: 2,
    ...overrides,
  };
}

/** The lines of the produced file, header included. */
function lines(rows: readonly CsvRow[]): string[] {
  return toCsv(rows).split('\n');
}

describe('toCsv', () => {
  // AC-8a — DEC-B: the §19 columns plus `unit`.
  it('writes the header', () => {
    expect(CSV_HEADER).toBe('date,exercise,set,weight,unit,reps,rir');
    expect(lines([])[0]).toBe(CSV_HEADER);
  });

  // AC-8f
  it('writes the header alone for no rows', () => {
    expect(toCsv([])).toBe(CSV_HEADER);
  });

  it('writes one line per set, in the order given', () => {
    const rows = [aRow({ set: 1 }), aRow({ set: 2, reps: 5 })];
    expect(lines(rows)).toEqual([
      CSV_HEADER,
      '2026-08-18,Front Squat,1,75,kg,6,2',
      '2026-08-18,Front Squat,2,75,kg,5,2',
    ]);
  });

  // AC-8d — DEC-B: what the lifter entered, never the converted value.
  it('writes the weight as entered, with its own unit', () => {
    expect(lines([aRow({ weight: 165, unit: 'lb' })])[1]).toBe(
      '2026-08-18,Front Squat,1,165,lb,6,2',
    );
  });

  it('writes a fractional weight without rounding it', () => {
    expect(lines([aRow({ weight: 72.5 })])[1]).toContain(',72.5,');
  });

  it('writes a zero RIR rather than treating it as absent', () => {
    // 0 RIR is failure, the most informative value in the column.
    expect(lines([aRow({ rir: 0 })])[1]).toBe('2026-08-18,Front Squat,1,75,kg,6,0');
  });

  // AC-8e — the column count must survive any exercise name.
  it('quotes a name containing a comma', () => {
    expect(lines([aRow({ exercise: 'Squat, Front' })])[1]).toBe(
      '2026-08-18,"Squat, Front",1,75,kg,6,2',
    );
  });

  it('doubles a quote inside a name and wraps it', () => {
    expect(lines([aRow({ exercise: 'The "Good" Morning' })])[1]).toBe(
      '2026-08-18,"The ""Good"" Morning",1,75,kg,6,2',
    );
  });

  it('quotes a name containing a newline', () => {
    const row = lines([aRow({ exercise: 'Front\nSquat' })]);
    // The newline stays inside the quoted field: a reader counts quotes, not
    // lines, so splitting on \n here is the test being deliberately naive.
    expect(row[1]).toBe('2026-08-18,"Front');
    expect(row[2]).toBe('Squat",1,75,kg,6,2');
  });

  it('quotes a name with a leading or trailing space', () => {
    expect(lines([aRow({ exercise: ' Front Squat ' })])[1]).toContain('" Front Squat "');
  });

  it('leaves an ordinary name unquoted', () => {
    expect(lines([aRow()])[1]).toContain(',Front Squat,');
  });
});
