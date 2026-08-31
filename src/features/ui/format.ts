import { parseLocalDate, type LocalDate } from '@/domain/dates';
import {
  MEASUREMENTS,
  shapeOf,
  targetUnitOf,
  targetsReps,
  type Measurement,
} from '@/domain/measurement';
import type {
  CompletedSet,
  ExerciseSessionStatus,
  PlannedExercise,
  PlannedExerciseSession,
  SessionStatus,
  Weekday,
} from '@/domain/types';

/** Displays a closed range, or an em dash when no range was stated. */
function range(min: number | null, max: number | null): string {
  if (min === null || max === null) return '—';
  return min === max ? String(min) : `${min}–${max}`;
}

function targetRange(
  measurement: Measurement,
  reps: readonly [number | null, number | null],
  target: readonly [number | null, number | null],
): string {
  // The measurement selects the target axis; do not choose by whichever pair is non-null.
  const onReps = targetsReps(measurement);
  const [min, max] = onReps ? reps : target;
  const text = range(min, max);
  if (onReps || min === null || max === null) return text;
  return `${text}${targetUnitOf(measurement) === 'seconds' ? 's' : ' m'}`;
}

/** `4×4–6 · RIR 1–2 · 210s · kg` — the programme as it was written down. */
export function programmingLine(exercise: PlannedExercise, measurement: Measurement): string {
  const parts = [
    `${exercise.sets}×${targetRange(
      measurement,
      [exercise.minReps, exercise.maxReps],
      [exercise.minTarget, exercise.maxTarget],
    )}`,
  ];
  if (exercise.minRir !== null && exercise.maxRir !== null) {
    parts.push(`RIR ${range(exercise.minRir, exercise.maxRir)}`);
  }
  if (exercise.restSeconds !== null) parts.push(`${exercise.restSeconds}s`);
  parts.push(exercise.unit);
  return parts.join(' · ');
}

export function snapshotLine(planned: PlannedExerciseSession): string {
  // Read targets from the Session snapshot so template edits cannot rewrite history.
  const parts = [
    `${planned.plannedSets}×${targetRange(
      planned.measurement,
      [planned.plannedMinReps, planned.plannedMaxReps],
      [planned.plannedMinTarget, planned.plannedMaxTarget],
    )}`,
  ];
  if (planned.plannedMinRir !== null && planned.plannedMaxRir !== null) {
    parts.push(`RIR ${range(planned.plannedMinRir, planned.plannedMaxRir)}`);
  }
  if (planned.plannedRestSeconds !== null) parts.push(`rest ${planned.plannedRestSeconds}s`);
  return parts.join(' · ');
}

export function snapshotFigures(
  planned: PlannedExerciseSession,
): readonly { readonly label: string; readonly value: string }[] {
  return [
    {
      label: targetsReps(planned.measurement)
        ? 'sets × reps'
        : `sets × ${targetUnitOf(planned.measurement)}`,
      value: `${planned.plannedSets} × ${targetRange(
        planned.measurement,
        [planned.plannedMinReps, planned.plannedMaxReps],
        [planned.plannedMinTarget, planned.plannedMaxTarget],
      )}`,
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

const MEASUREMENT_LABELS: Record<Measurement, string> = {
  weight_reps: 'Weight × reps',
  bodyweight_reps: 'Bodyweight reps',
  weighted_bodyweight: 'Weighted bodyweight',
  assisted_bodyweight: 'Assisted bodyweight',
  duration: 'Time',
  duration_weight: 'Time + weight',
  distance_duration: 'Distance + time',
  weight_distance: 'Weight + distance',
  distance: 'Distance',
};

/** How a movement is measured, in the lifter's words rather than the union's. */
export function measurementLabel(measurement: Measurement): string {
  return MEASUREMENT_LABELS[measurement];
}

export const MEASUREMENT_OPTIONS: readonly {
  readonly value: Measurement;
  readonly label: string;
}[] = MEASUREMENTS.map((measurement) => ({
  value: measurement,
  label: MEASUREMENT_LABELS[measurement],
}));

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

export function seconds(total: number): string {
  if (total < 60) return `${total}s`;
  const pad = (value: number): string => String(value).padStart(2, '0');
  const minutes = Math.floor(total / 60) % 60;
  const rest = Math.round(total % 60);
  const hours = Math.floor(total / 3_600);
  return hours === 0 ? `${minutes}:${pad(rest)}` : `${hours}:${pad(minutes)}:${pad(rest)}`;
}

export function setLine(
  set: CompletedSet | null,
  measurement: Measurement,
  showUnit = false,
): string {
  if (set === null) return '—';
  const { fields, weightMeaning } = shapeOf(measurement);
  const weightText = showUnit ? `${set.weight} ${set.unit}` : String(set.weight);
  // Assistance is shown as what it is — weight taken off — so that a smaller
  // number reads as the better set rather than the lighter one.
  const signed = weightMeaning === 'assisted' ? `−${weightText}` : weightText;

  // Keep weight × reps compact; other measurement shapes need their fields
  // named so the value cannot be mistaken for reps or load.
  if (fields.includes('weight') && fields.includes('reps')) {
    return `${signed} × ${set.reps ?? '—'}`;
  }
  const parts: string[] = [];
  for (const field of fields) {
    switch (field) {
      case 'weight':
        parts.push(signed);
        break;
      case 'reps':
        parts.push(`${set.reps ?? '—'} reps`);
        break;
      case 'durationSeconds':
        parts.push(set.durationSeconds === null ? '—' : seconds(set.durationSeconds));
        break;
      case 'distance':
        parts.push(
          set.distance === null ? '—' : `${set.distance} ${set.distanceUnit ?? 'm'}`,
        );
        break;
    }
  }
  return parts.join(' · ');
}
