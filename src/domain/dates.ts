/**
 * Dates (REQ-013, AC-014).
 *
 * Two representations, deliberately distinct:
 *
 * - `LocalDate` — a calendar day as `YYYY-MM-DD` in the user's local time.
 *   A Placement lives on a day, not at an instant, so it must not drift across
 *   a day boundary with the machine's timezone offset.
 * - `Timestamp` — an instant, as epoch milliseconds (`createdAt`, `startedAt`,
 *   `completedAt`, `CompletedSet.completedAt`).
 *
 * No function here reads the system clock. Every one takes its date as a
 * parameter, which is what makes the scheduling domain testable (DEC-008).
 */

/** A calendar day, `YYYY-MM-DD`, interpreted in local time. */
export type LocalDate = string & { readonly __brand: 'LocalDate' };

/** An instant, epoch milliseconds. */
export type Timestamp = number;

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value: number, length: number): string =>
  String(value).padStart(length, '0');

/** True when `value` has the `YYYY-MM-DD` shape and names a real calendar day. */
export function isLocalDate(value: string): value is LocalDate {
  if (!LOCAL_DATE_PATTERN.test(value)) return false;
  return formatLocalDate(parseLocalDate(value as LocalDate)) === value;
}

/**
 * Tags a `YYYY-MM-DD` string as a `LocalDate`.
 * Throws when the string is not one, so a bad value cannot reach storage.
 */
export function toLocalDate(value: string): LocalDate {
  if (!isLocalDate(value)) {
    throw new Error(`Not a YYYY-MM-DD local date: ${value}`);
  }
  return value;
}

/** The local calendar day a `Date` falls on. Never uses UTC components. */
export function formatLocalDate(date: Date): LocalDate {
  const text = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
  return text as LocalDate;
}

/** Local midnight of a `LocalDate`. Round-trips through `formatLocalDate`. */
export function parseLocalDate(date: LocalDate): Date {
  const [year, month, day] = date.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** The calendar day `days` after `date` (negative moves backwards). */
export function addDays(date: LocalDate, days: number): LocalDate {
  const shifted = parseLocalDate(date);
  shifted.setDate(shifted.getDate() + days);
  return formatLocalDate(shifted);
}

/**
 * The Monday of the week containing `date`. Week 1 of a Routine begins here
 * (DEC-008). Sunday belongs to the week that started six days earlier.
 */
export function mondayOfWeek(date: LocalDate): LocalDate {
  const dayOfWeek = parseLocalDate(date).getDay(); // 0 = Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addDays(date, -daysSinceMonday);
}
