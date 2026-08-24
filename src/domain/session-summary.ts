/**
 * What a Session amounted to, read once at the end of it.
 *
 * Finishing a Session used to record it and navigate away without a word, which
 * made the most repeated moment in the product the only one that says nothing.
 * This is the arithmetic behind the screen that replaces that silence: pure,
 * derived, stored nowhere — the same contract progression holds.
 *
 * Nothing here is a new measure. `volumeKg` is the `Σ weightKg × reps` of
 * `ExercisePoint`, and a record is `ExercisePoint.isRecord` read for this
 * Session's own point rather than recomputed. Two definitions of "a record"
 * would eventually disagree, and the one on the chart is the one a lifter has
 * already been reading.
 */

import { estimateOneRepMaxKg, exerciseSeries } from '@/domain/history';
import type { ExerciseId } from '@/domain/ids';
import type { SessionHistory } from '@/domain/progression';
import type { CompletedSet } from '@/domain/types';

/** An exercise whose estimated 1RM in this Session beat every session before it. */
export interface SessionRecord {
  readonly exerciseId: ExerciseId;
  /** The set that did it — what the lifter actually performed. */
  readonly set: CompletedSet;
  readonly estimatedOneRepMaxKg: number;
  /** The estimate this beat, or `null` where nothing earlier held sets. */
  readonly previousBestKg: number | null;
}

export interface SessionSummary {
  readonly setsLogged: number;
  /** `Σ weightKg × reps` across every set of the Session (§11.7 — kilograms). */
  readonly volumeKg: number;
  /** Wall-clock minutes, or `null` while the Session is still open. */
  readonly minutes: number | null;
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

  const records: SessionRecord[] = [];
  for (const exercise of detail.exercises) {
    const { exerciseId } = exercise.exerciseSession;
    const history = historyByExercise.get(exerciseId);
    if (history === undefined || exercise.sets.length === 0) continue;

    const series = exerciseSeries(history);
    const index = series.findIndex((point) => point.startedAt === session.startedAt);
    const point = index === -1 ? undefined : series[index];
    if (point === undefined || !point.isRecord) continue;

    // The set that produced the estimate, not the heaviest. A lighter set taken
    // closer to failure can be the one that beat the record, and naming the
    // heaviest instead would credit the wrong lift.
    const set = exercise.sets.reduce((best, performed) =>
      estimateOneRepMaxKg(performed) > estimateOneRepMaxKg(best) ? performed : best,
    );

    records.push({
      exerciseId,
      set,
      estimatedOneRepMaxKg: point.estimatedOneRepMaxKg,
      // `isRecord` is false for the first point, so a record always has one before it.
      previousBestKg: series
        .slice(0, index)
        .reduce<number | null>(
          (best, earlier) => Math.max(best ?? 0, earlier.estimatedOneRepMaxKg),
          null,
        ),
    });
  }

  return {
    setsLogged: sets.length,
    volumeKg: sets.reduce((total, set) => total + set.weightKg * set.reps, 0),
    minutes:
      session.completedAt === null
        ? null
        : Math.max(1, Math.round((session.completedAt - session.startedAt) / 60_000)),
    performed: countStatus(detail, 'performed'),
    skipped: countStatus(detail, 'skipped'),
    pending: countStatus(detail, 'pending'),
    records: records.sort((a, b) => b.estimatedOneRepMaxKg - a.estimatedOneRepMaxKg),
  };
}

function countStatus(detail: SessionHistory, status: 'performed' | 'skipped' | 'pending'): number {
  return detail.exercises.filter((exercise) => exercise.exerciseSession.status === status).length;
}
