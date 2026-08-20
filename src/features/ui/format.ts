/**
 * How the screens render values a lifter reads at arm's length.
 *
 * Presentation only — every one of these is a pure string function over data
 * the domain already decided. Dates are formatted through `Intl` with the
 * browser's own locale, which needs no dictionary and no network.
 */

import { parseLocalDate, type LocalDate } from '@/domain/dates';
import type { PlannedExercise, Weekday } from '@/domain/types';

/** `4–6`, or `4` when both ends agree. */
export function range(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

/** `4×4–6 · RIR 1–2 · 210s · kg` — the programme as it was written down. */
export function programmingLine(exercise: PlannedExercise): string {
  const parts = [`${exercise.sets}×${range(exercise.minReps, exercise.maxReps)}`];
  if (exercise.minRir !== null && exercise.maxRir !== null) {
    parts.push(`RIR ${range(exercise.minRir, exercise.maxRir)}`);
  }
  if (exercise.restSeconds !== null) parts.push(`${exercise.restSeconds}s`);
  parts.push(exercise.unit);
  return parts.join(' · ');
}

/** `Wed, 19 Aug` */
export function shortDate(date: LocalDate): string {
  return parseLocalDate(date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** `Wednesday, 19 August` — the day named in full, for a screen heading. */
export function longDate(date: LocalDate): string {
  return parseLocalDate(date).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** `August 2026` */
export function monthName(date: LocalDate): string {
  return parseLocalDate(date).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/** `Monday` — a suggested day as the file named it, capitalised for reading. */
export function weekdayName(day: Weekday): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** `4 weeks`, `1 week` — a count with the right noun. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
