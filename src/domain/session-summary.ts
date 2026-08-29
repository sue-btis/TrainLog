import { compareProgress, exerciseSeries, recordSetOf } from '@/domain/history';
import type { ExerciseId } from '@/domain/ids';
import {
  progressAxisOf,
  volumeFamilyOf,
  type Axis,
  type Measurement,
} from '@/domain/measurement';
import type { SessionHistory } from '@/domain/progression';
import type { CompletedSet } from '@/domain/types';

export interface SessionRecord {
  readonly exerciseId: ExerciseId;
  /** The set that did it — what the lifter actually performed. */
  readonly set: CompletedSet;
  readonly measurement: Measurement;
  readonly axis: Axis;
  readonly value: number;
  /** The value this beat, or `null` where nothing earlier held sets. */
  readonly previousValue: number | null;
}

export interface SessionSummary {
  readonly setsLogged: number;
  readonly volumeKg: number;
  /** Reps done on the bodyweight-rep types. Its own unit, its own number. */
  readonly volumeReps: number;
  /** Seconds held or worked on the duration types. */
  readonly volumeSeconds: number;
  /** Metres covered on the distance types. */
  readonly volumeMetres: number;
  /** Wall-clock minutes, or `null` while the Session is still open. */
  readonly minutes: number | null;
  /**
   * Foster's session load — mean RPE × minutes, in arbitrary units. `null` on
   * the same terms as `minutes`, and also for a Session holding no set. The one
   * figure here that compares across kinds of work; see `effortOf`.
   */
  readonly effort: number | null;
  readonly performed: number;
  readonly skipped: number;
  readonly pending: number;
  /** Newest-beaten first, so the rarest fact leads the screen. */
  readonly records: readonly SessionRecord[];
}

/**
 * `detail` is the Session being summarized. `historyByExercise` holds each of
 * its exercises' full history — including this Session, because that is what
 * `exerciseSeries` needs in order to place this Session's point among the
 * others and decide whether it is a record.
 *
 * An exercise missing from the map yields no record rather than throwing: a
 * read still in flight must render an incomplete summary, never a wrong one.
 */
export function summarizeSession(
  detail: SessionHistory,
  historyByExercise: ReadonlyMap<ExerciseId, readonly SessionHistory[]>,
): SessionSummary {
  const sets = detail.exercises.flatMap((exercise) => exercise.sets);
  const { session } = detail;

  // Hoisted rather than left inline in the return: `effort` multiplies by this
  // exact number, and deriving the duration twice would let the two figures
  // round apart.
  const minutes =
    session.completedAt === null
      ? null
      : Math.max(1, Math.round((session.completedAt - session.startedAt) / 60_000));

  const records: SessionRecord[] = [];
  for (const exercise of detail.exercises) {
    const { exerciseId } = exercise.exerciseSession;
    const history = historyByExercise.get(exerciseId);
    if (history === undefined || exercise.sets.length === 0) continue;

    const series = exerciseSeries(history);
    const index = series.findIndex((point) => point.startedAt === session.startedAt);
    const point = index === -1 ? undefined : series[index];
    if (point === undefined || !point.isRecord || point.progressValue === null) continue;

    const { measurement } = exercise.exerciseSession;

    records.push({
      exerciseId,
      set: recordSetOf(exercise.sets, measurement),
      measurement,
      axis: progressAxisOf(measurement),
      value: point.progressValue,
      // `isRecord` is false for the first point, so a record always has one before it.
      previousValue: series
        .slice(0, index)
        .reduce<number | null>(
          (best, earlier) =>
            compareProgress(earlier.progressValue, best, measurement) > 0
              ? earlier.progressValue
              : best,
          null,
        ),
    });
  }

  const volume = accumulate(detail);

  return {
    setsLogged: sets.length,
    volumeKg: volume.kg_reps,
    volumeReps: volume.reps,
    volumeSeconds: volume.seconds,
    volumeMetres: volume.metres,
    minutes,
    effort: effortOf(sets, minutes),
    performed: countStatus(detail, 'performed'),
    skipped: countStatus(detail, 'skipped'),
    pending: countStatus(detail, 'pending'),
    // Biggest margin over what it beat leads the screen. Ranking by the raw
    // value would put a 5 km run above a 200 kg squat, and would sort the
    // inverted axes backwards on top of it.
    records: records.sort((a, b) => marginOf(b) - marginOf(a)),
  };
}

function accumulate(detail: SessionHistory): Record<
  'kg_reps' | 'reps' | 'seconds' | 'metres',
  number
> {
  const totals = { kg_reps: 0, reps: 0, seconds: 0, metres: 0 };

  for (const exercise of detail.exercises) {
    const family = volumeFamilyOf(exercise.exerciseSession.measurement);
    for (const set of exercise.sets) {
      switch (family) {
        case 'kg_reps':
          // A set carrying no rep count contributes nothing rather than NaN
          totals.kg_reps += set.weightKg * (set.reps ?? 0);
          break;
        case 'reps':
          totals.reps += set.reps ?? 0;
          break;
        case 'seconds':
          totals.seconds += set.durationSeconds ?? 0;
          break;
        case 'metres':
          totals.metres += set.distanceM ?? 0;
          break;
      }
    }
  }
  return totals;
}

/**
 * How far a record beat the mark before it, as a fraction of that mark, so
 * that records on four different axes can be ranked against each other at
 * all. A first-ever mark has no margin and sorts last.
 */
function marginOf(record: SessionRecord): number {
  const { previousValue } = record;
  if (previousValue === null || previousValue === 0) return 0;
  return Math.abs(record.value - previousValue) / Math.abs(previousValue);
}

const RPE_AT_FAILURE = 10;

function effortOf(sets: readonly CompletedSet[], minutes: number | null): number | null {
  if (minutes === null || sets.length === 0) return null;

  const meanRpe =
    sets.reduce((total, set) => total + Math.max(0, RPE_AT_FAILURE - set.rir), 0) / sets.length;
  return Math.round(meanRpe * minutes);
}

function countStatus(detail: SessionHistory, status: 'performed' | 'skipped' | 'pending'): number {
  return detail.exercises.filter((exercise) => exercise.exerciseSession.status === status).length;
}
