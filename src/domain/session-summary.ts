/**
 * What a Session amounted to, read once at the end of it.
 *
 * Finishing a Session used to record it and navigate away without a word, which
 * made the most repeated moment in the product the only one that says nothing.
 * This is the arithmetic behind the screen that replaces that silence: pure,
 * derived, stored nowhere — the same contract progression holds.
 *
 * Almost nothing here is a new measure. `volumeKg` is the `Σ weightKg × reps`
 * of `ExercisePoint`, and a record is `ExercisePoint.isRecord` read for this
 * Session's own point rather than recomputed. Two definitions of "a record"
 * would eventually disagree, and the one on the chart is the one a lifter has
 * already been reading.
 *
 * `effort` is the exception, and the reason for it is that volume cannot answer
 * "how hard was this" for work that is not kilograms. A run, a hold and a carry
 * are all silent in `Σ weightKg × reps`, and a programme that mixes them needs
 * one figure that is not blind to half of itself.
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
    minutes,
    effort: effortOf(sets, minutes),
    performed: countStatus(detail, 'performed'),
    skipped: countStatus(detail, 'skipped'),
    pending: countStatus(detail, 'pending'),
    records: records.sort((a, b) => b.estimatedOneRepMaxKg - a.estimatedOneRepMaxKg),
  };
}

/**
 * RPE 10 is a set taken to failure, so RIR is its complement: `RPE = 10 - RIR`.
 * §30 stores the RIR actually achieved, which makes the conversion a rename
 * rather than an estimate.
 */
const RPE_AT_FAILURE = 10;

/**
 * Foster's session load — mean RPE times minutes — over one Session's sets.
 *
 * The only figure in the product that means the same thing for a squat and for
 * a run. Volume cannot be: kilogram-reps, seconds and metres do not add up, and
 * any single number claiming to sum them has an invented conversion inside it.
 * RIR is the one value every set carries whatever was being measured, which is
 * what makes it the axis both halves of a hybrid programme can share.
 *
 * `Math.max(0, …)` is not defensive noise. A logged RIR is deliberately not
 * bounded above — `backup/schema.ts` accepts one past `MAX_RIR` and has a test
 * saying so — and a set logged at RIR 12 would otherwise contribute negative
 * effort, pulling the Session's figure down for having been easy.
 *
 * Rounded, because it is an index rather than a measurement: a mean of
 * whole-number ratings times an already-rounded minute count does not have a
 * decimal's worth of precision to report.
 *
 * `null` where there is nothing to compute from. An open Session has no
 * duration and a setless one has no RPE, and in both cases the answer is
 * unknown rather than zero — the same distinction `minutes` already makes.
 *
 * The known ceiling: `minutes` is wall clock, so rest, a phone left on a bench
 * and a conversation between sets are all inside it. That is Foster's own
 * definition rather than a shortcut — the figure is meant to scale with time
 * spent training — but a leisurely session and a dense one of equal length do
 * read alike.
 */
function effortOf(sets: readonly CompletedSet[], minutes: number | null): number | null {
  if (minutes === null || sets.length === 0) return null;

  const meanRpe =
    sets.reduce((total, set) => total + Math.max(0, RPE_AT_FAILURE - set.rir), 0) / sets.length;
  return Math.round(meanRpe * minutes);
}

function countStatus(detail: SessionHistory, status: 'performed' | 'skipped' | 'pending'): number {
  return detail.exercises.filter((exercise) => exercise.exerciseSession.status === status).length;
}
