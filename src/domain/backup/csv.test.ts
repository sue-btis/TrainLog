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
    measurement: 'weight_reps',
    durationSeconds: null,
    distance: null,
    distanceUnit: null,
    ...overrides,
  };
}

/** The lines of the produced file, header included. */
function lines(rows: readonly CsvRow[]): string[] {
  return toCsv(rows).split('\n');
}

/** The fields of one produced line, split on the commas between columns. */
function columns(row: CsvRow): string[] {
  return (lines([row])[1] ?? '').split(',');
}

describe('toCsv', () => {
  // AC-8a — DEC-B: the §19 columns plus `unit`, plus the appended four.
  it('writes the header', () => {
    expect(CSV_HEADER).toBe(
      'date,exercise,set,weight,unit,reps,rir,measurement,duration_s,distance,distance_unit',
    );
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
      '2026-08-18,Front Squat,1,75,kg,6,2,weight_reps,,,',
      '2026-08-18,Front Squat,2,75,kg,5,2,weight_reps,,,',
    ]);
  });

  // AC-8d — DEC-B: what the lifter entered, never the converted value.
  it('writes the weight as entered, with its own unit', () => {
    expect(lines([aRow({ weight: 165, unit: 'lb' })])[1]).toBe(
      '2026-08-18,Front Squat,1,165,lb,6,2,weight_reps,,,',
    );
  });

  it('writes a fractional weight without rounding it', () => {
    expect(lines([aRow({ weight: 72.5 })])[1]).toContain(',72.5,');
  });

  it('writes a zero RIR rather than treating it as absent', () => {
    // 0 RIR is failure, the most informative value in the column.
    expect(lines([aRow({ rir: 0 })])[1]).toBe(
      '2026-08-18,Front Squat,1,75,kg,6,0,weight_reps,,,',
    );
  });

  // AC-8e — the column count must survive any exercise name.
  it('quotes a name containing a comma', () => {
    expect(lines([aRow({ exercise: 'Squat, Front' })])[1]).toBe(
      '2026-08-18,"Squat, Front",1,75,kg,6,2,weight_reps,,,',
    );
  });

  it('doubles a quote inside a name and wraps it', () => {
    expect(lines([aRow({ exercise: 'The "Good" Morning' })])[1]).toBe(
      '2026-08-18,"The ""Good"" Morning",1,75,kg,6,2,weight_reps,,,',
    );
  });

  it('quotes a name containing a newline', () => {
    const row = lines([aRow({ exercise: 'Front\nSquat' })]);
    // The newline stays inside the quoted field: a reader counts quotes, not
    // lines, so splitting on \n here is the test being deliberately naive.
    expect(row[1]).toBe('2026-08-18,"Front');
    expect(row[2]).toBe('Squat",1,75,kg,6,2,weight_reps,,,');
  });

  it('quotes a name with a leading or trailing space', () => {
    expect(lines([aRow({ exercise: ' Front Squat ' })])[1]).toContain('" Front Squat "');
  });

  it('leaves an ordinary name unquoted', () => {
    expect(lines([aRow()])[1]).toContain(',Front Squat,');
  });
});

/**
 * TST-119 (REQ-129, AC-145, AC-146) — the file grew by appending only.
 *
 * A lifter's spreadsheet addresses this file by column *position*: a formula
 * over column F is a formula over reps, and inserting a column ahead of it
 * silently turns every one of those formulas into a lie. So the assertions
 * below are about indices, not about the joined line — a joined string can pass
 * while a column has moved, if two of them happen to swap.
 */
describe('TST-119 — the seven original columns keep their positions', () => {
  /** §19 plus `unit` (DEC-B): the header exactly as it was before this change. */
  const ORIGINAL_COLUMNS = ['date', 'exercise', 'set', 'weight', 'unit', 'reps', 'rir'];

  // AC-145
  it('leaves the first seven column names unchanged and in order', () => {
    expect(CSV_HEADER.split(',').slice(0, 7)).toEqual(ORIGINAL_COLUMNS);
  });

  // AC-146 — the new columns are appended, so they come after those seven.
  it('appends the new columns behind them', () => {
    expect(CSV_HEADER.split(',').slice(7)).toEqual([
      'measurement',
      'duration_s',
      'distance',
      'distance_unit',
    ]);
  });

  // AC-145 — the row, index by index, against the header index by index.
  it('writes each value at the index its header names', () => {
    const header = CSV_HEADER.split(',');
    const fields = columns(
      aRow({ weight: 100, unit: 'lb', reps: 5, rir: 1, set: 3, measurement: 'weight_reps' }),
    );

    expect(fields).toHaveLength(header.length);
    expect(fields[header.indexOf('date')]).toBe('2026-08-18');
    expect(fields[header.indexOf('exercise')]).toBe('Front Squat');
    expect(fields[header.indexOf('set')]).toBe('3');
    expect(fields[header.indexOf('weight')]).toBe('100');
    expect(fields[header.indexOf('unit')]).toBe('lb');
    expect(fields[header.indexOf('reps')]).toBe('5');
    expect(fields[header.indexOf('rir')]).toBe('1');
    expect(fields[header.indexOf('measurement')]).toBe('weight_reps');
  });

  // AC-146 — a field the row's type does not carry is empty, never a zero.
  it('leaves reps empty and fills duration_s for a duration row', () => {
    const fields = columns(
      aRow({ measurement: 'duration', weight: 0, reps: null, durationSeconds: 90 }),
    );

    expect(fields[5]).toBe('');
    expect(fields[7]).toBe('duration');
    expect(fields[8]).toBe('90');
    expect(fields[9]).toBe('');
    expect(fields[10]).toBe('');
    // `weight` is not nullable on a CompletedSet (DER-1) and so is not nullable
    // here either: a plank logged with no load carries a real 0, which is what
    // the column says. An empty cell would claim the number was never written.
    expect(fields[3]).toBe('0');
  });

  it('leaves duration_s empty and fills the distance pair for a distance row', () => {
    const fields = columns(
      aRow({
        measurement: 'distance',
        weight: 0,
        reps: null,
        distance: 2.4,
        distanceUnit: 'km',
      }),
    );

    expect(fields[5]).toBe('');
    expect(fields[7]).toBe('distance');
    expect(fields[8]).toBe('');
    expect(fields[9]).toBe('2.4');
    expect(fields[10]).toBe('km');
  });
});
