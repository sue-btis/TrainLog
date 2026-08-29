export type LocalDate = string & { readonly __brand: 'LocalDate' };

export type Timestamp = number;

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value: number, length: number): string =>
  String(value).padStart(length, '0');

export function isLocalDate(value: string): value is LocalDate {
  if (!LOCAL_DATE_PATTERN.test(value)) return false;
  return formatLocalDate(parseLocalDate(value as LocalDate)) === value;
}

export function toLocalDate(value: string): LocalDate {
  if (!isLocalDate(value)) {
    throw new Error(`Not a YYYY-MM-DD local date: ${value}`);
  }
  return value;
}

export function formatLocalDate(date: Date): LocalDate {
  const text = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
  return text as LocalDate;
}

export function parseLocalDate(date: LocalDate): Date {
  const [year, month, day] = date.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const shifted = parseLocalDate(date);
  shifted.setDate(shifted.getDate() + days);
  return formatLocalDate(shifted);
}

export function mondayOfWeek(date: LocalDate): LocalDate {
  const dayOfWeek = parseLocalDate(date).getDay(); // 0 = Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addDays(date, -daysSinceMonday);
}
