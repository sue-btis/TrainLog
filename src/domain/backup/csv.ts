/**
 * History as CSV (§19).
 *
 * One line per CompletedSet, for reading somewhere else — a spreadsheet, a
 * notebook, whatever a lifter wants to ask of their own numbers. Unlike the
 * backup document this is a one-way export: nothing imports it, so it is shaped
 * for a human and a spreadsheet rather than for restore.
 *
 * The columns are §19's, plus `unit` (DEC-B). §19's example omits it, but a
 * weight is stored as entered and the unit is fixed per Exercise (§11.7), so a
 * single file can hold rows in kilograms and rows in pounds. Sharing one
 * `weight` column between them would make the two incomparable with no way to
 * tell which is which — and converting everything to kilograms would export
 * numbers the lifter never typed. The extra column is additive for anything
 * reading the file.
 */

import type { LocalDate } from '@/domain/dates';
import type { Measurement } from '@/domain/measurement';
import type { DistanceUnit, Unit } from '@/domain/units';

/** One performed set, flattened. Assembled by `src/db`; this module only writes. */
export interface CsvRow {
  /** The Session's local calendar day, never a UTC one (REQ-013). */
  readonly date: LocalDate;
  /** The Exercise's display name, resolved from the catalog or the user table. */
  readonly exercise: string;
  readonly set: number;
  /** As entered (§11.7) — not `weightKg`. */
  readonly weight: number;
  readonly unit: Unit;
  /** The rep count, or `null` for a set of a type that collects none. */
  readonly reps: number | null;
  readonly rir: number;
  /** How the exercise is measured, from the ExerciseSession's snapshot. */
  readonly measurement: Measurement;
  readonly durationSeconds: number | null;
  /** The distance as entered, with its unit — not the derived metres. */
  readonly distance: number | null;
  readonly distanceUnit: DistanceUnit | null;
}

/**
 * The column row (DEC-B).
 *
 * Grown by **appending only**, never by inserting (DEC-N, REQ-129). Every
 * column that existed keeps the index it had, because a lifter's spreadsheet
 * formulas and pivot tables are addressed by column position and a file that
 * quietly shifts them is worse than one that refuses to open.
 */
export const CSV_HEADER =
  'date,exercise,set,weight,unit,reps,rir,measurement,duration_s,distance,distance_unit';

/**
 * Quotes a field when leaving it bare would break the column count.
 *
 * RFC 4180: a field holding a comma, a quote or a newline is wrapped in quotes
 * and its own quotes are doubled. Surrounding spaces are quoted too — they are
 * meaningful in a name and several readers trim unquoted fields.
 *
 * Only `exercise` can contain any of this. It is applied to every text field
 * anyway, because the rule belongs to the format rather than to today's set of
 * columns.
 */
function escape(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value) || value.trim() !== value;
  return needsQuotes ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * The rows as one CSV document, header first.
 *
 * Pure: no clock, no database, no ordering opinion — rows come out in the order
 * they went in, so the caller owns "newest first" or "oldest first".
 *
 * An empty history still produces the header. A file with column names and no
 * rows says "nothing logged yet"; an empty file says "something went wrong".
 */
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
