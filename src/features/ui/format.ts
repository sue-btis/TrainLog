/**
 * How the screens render values a lifter reads at arm's length.
 *
 * Presentation only — every one of these is a pure string function over data
 * the domain already decided. Dates are formatted through `Intl` with the
 * browser's own locale, which needs no dictionary and no network.
 */

import { parseLocalDate, type LocalDate } from '@/domain/dates';
import type {
  CompletedSet,
  ExerciseSessionStatus,
  PlannedExercise,
  PlannedExerciseSession,
  SessionStatus,
  Weekday,
} from '@/domain/types';

/** `4–6`, or `4` when both ends agree. Internal: the two lines below read it. */
function range(min: number, max: number): string {
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

/**
 * `4×4–6 · RIR 1–2 · rest 210s` — the targets an exercise was performed
 * against, read off the ExerciseSession's own snapshot and never off the
 * PlannedExercise behind it (ADR 0002).
 *
 * The same line in gym mode and in session history, from one function, so the
 * screen showing what you are about to do and the screen showing what you did
 * cannot drift into two notations for the same fact.
 */
export function snapshotLine(planned: PlannedExerciseSession): string {
  const parts = [`${planned.plannedSets}×${range(planned.plannedMinReps, planned.plannedMaxReps)}`];
  if (planned.plannedMinRir !== null && planned.plannedMaxRir !== null) {
    parts.push(`RIR ${range(planned.plannedMinRir, planned.plannedMaxRir)}`);
  }
  if (planned.plannedRestSeconds !== null) parts.push(`rest ${planned.plannedRestSeconds}s`);
  return parts.join(' · ');
}

/**
 * The same snapshot as three labelled figures rather than one line — what gym
 * mode draws above the domes.
 *
 * `snapshotLine` is kept and untouched: session history reads a sentence, and
 * AC-6 pins its notation. This is the same facts for a screen that reads them
 * one at a time, between sets, with a barbell in the other hand.
 *
 * An em dash where the programme said nothing. `snapshotLine` drops those parts
 * instead, because a sentence can be shorter; a row of three cannot lose its
 * middle column without the two beside it moving.
 */
export function snapshotFigures(
  planned: PlannedExerciseSession,
): readonly { readonly label: string; readonly value: string }[] {
  return [
    {
      label: 'sets × reps',
      value: `${planned.plannedSets} × ${range(planned.plannedMinReps, planned.plannedMaxReps)}`,
    },
    {
      label: 'RIR',
      value:
        planned.plannedMinRir === null || planned.plannedMaxRir === null
          ? '—'
          : range(planned.plannedMinRir, planned.plannedMaxRir),
    },
    {
      label: 'rest',
      value: planned.plannedRestSeconds === null ? '—' : `${planned.plannedRestSeconds}s`,
    },
  ];
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

/**
 * What a Session's status is called on screen (CONTEXT.md).
 *
 * Six screens used to render the stored value, four of them through
 * `status.replace('_', ' ')` — so the one word Today showed about the session a
 * lifter had just finished was the lowercase enum `partial`. These are database
 * values; the glossary governs what the lifter reads, and it does not contain
 * them. Written once so the six cannot drift into six vocabularies.
 */
export function sessionStatusLabel(status: SessionStatus): string {
  switch (status) {
    case 'in_progress':
      return 'still open';
    case 'partial':
      return 'work left undone';
    case 'completed':
      return 'completed';
  }
}

/** The same, for one exercise within a Session. */
export function exerciseStatusLabel(status: ExerciseSessionStatus): string {
  switch (status) {
    case 'pending':
      return 'not started';
    case 'performed':
      return 'done';
    case 'skipped':
      return 'skipped';
  }
}

/** `52.5 kg` — a load on its own, without the reps it was done for. */
export function load(set: CompletedSet | null): string {
  return set === null ? '—' : `${set.weight} ${set.unit}`;
}

/** `77.5 × 5` — §11.10's own notation for a set. */
export function setLine(set: CompletedSet | null): string {
  return set === null ? '—' : `${set.weight} × ${set.reps}`;
}
