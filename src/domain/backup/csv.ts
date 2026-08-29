import type { LocalDate } from '@/domain/dates';
import type { Measurement } from '@/domain/measurement';
import type { DistanceUnit, Unit } from '@/domain/units';

export interface CsvRow {
  readonly date: LocalDate;
  readonly exercise: string;
  readonly set: number;
  readonly weight: number;
  readonly unit: Unit;
  readonly reps: number | null;
  readonly rir: number;
  readonly measurement: Measurement;
  readonly durationSeconds: number | null;
  readonly distance: number | null;
  readonly distanceUnit: DistanceUnit | null;
}

export const CSV_HEADER =
  'date,exercise,set,weight,unit,reps,rir,measurement,duration_s,distance,distance_unit';

function escape(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value) || value.trim() !== value;
  return needsQuotes ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(rows: readonly CsvRow[]): string {
  const lines = rows.map((row) =>
    [
      row.date,
      escape(row.exercise),
      row.set,
      row.weight,
      row.unit,
      // A field the row's type does not carry is written empty, never as a
      // zero: an absent rep count is not a set of no reps.
      row.reps ?? '',
      row.rir,
      row.measurement,
      row.durationSeconds ?? '',
      row.distance ?? '',
      row.distanceUnit ?? '',
    ].join(','),
  );

  return [CSV_HEADER, ...lines].join('\n');
}
