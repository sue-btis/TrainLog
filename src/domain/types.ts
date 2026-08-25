/**
 * The domain type contract (REQ-010, PRD §14.1–14.9, CONTEXT.md).
 *
 * Three layers, kept apart on purpose (§14):
 *
 *   Definition   Exercise
 *   Planning     Routine → Workout → PlannedExercise (+ embedded ProgressionRule)
 *                Placement — a Workout on a date
 *   Execution    Session → ExerciseSession → CompletedSet
 *
 * `Placement` and `Session` never reference each other (ADR 0001). An
 * `ExerciseSession` snapshots its targets rather than pointing at a template
 * (ADR 0002). No suggested or working weight is stored anywhere: progression is
 * derived from `CompletedSet` history (§11.9).
 */

import type {
  CompletedSetId,
  ExerciseId,
  ExerciseSessionId,
  PlacementId,
  PlannedExerciseId,
  RoutineId,
  SessionId,
  WorkoutId,
} from '@/domain/ids';
import type { LocalDate, Timestamp } from '@/domain/dates';
import type { DistanceUnit, Unit } from '@/domain/units';
import type { Measurement } from '@/domain/measurement';

export type { LocalDate, Timestamp } from '@/domain/dates';
export type { DistanceUnit, Unit } from '@/domain/units';
export type { Measurement } from '@/domain/measurement';

/** A day of the week, as a Workout's `suggestedDays` names it (§12). */
export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

// ---------------------------------------------------------------- Definition

/**
 * §14.1 — the movement itself, independent of any Routine. The unit history and
 * progression are tracked against (§26).
 *
 * Catalog Exercises ship in the build with permanent kebab-case slug ids and
 * are never written to the `exercises` table; user-created Exercises carry a
 * generated id (DEC-007). `category` and `equipment` are unknown for an
 * Exercise created from a routine file that only names it.
 */
export interface Exercise {
  readonly id: ExerciseId;
  readonly name: string;
  readonly category: string | null;
  readonly equipment: string | null;
  /**
   * How this movement is measured (REQ-104, DEC-B). Declared here and nowhere
   * else: a plank does not become a rep exercise on Tuesday. Snapshotted onto
   * `ExerciseSessionBase` when the exercise starts.
   */
  readonly measurement: Measurement;
}

// ------------------------------------------------------------------ Planning

/** §11.2 — a Routine is active or archived. Deleting is refused once Sessions reference it. */
export type RoutineStatus = 'active' | 'archived';

/**
 * §14.2 — a complete training programme, imported from a single file or
 * authored in the wizard without one. Once accepted it takes additions only: a
 * Workout may be added while it is active, and nothing stored is renamed,
 * reordered, retargeted or removed. It has no start or end date; `weeks` is the
 * intended duration and decides how many Placements are generated.
 */
export interface Routine {
  readonly id: RoutineId;
  readonly name: string;
  readonly weeks: number;
  readonly status: RoutineStatus;
  readonly createdAt: Timestamp;
}

/**
 * §14.3 — a named, reusable unit of programming inside a Routine. Carries no
 * date. `order` defines the rotation; `suggestedDays` is read when the Workout
 * enters the Routine — at import, or when one is added to a Routine already
 * running — to seed Placements, and never consulted again afterwards.
 */
export interface Workout {
  readonly id: WorkoutId;
  readonly routineId: RoutineId;
  readonly name: string;
  readonly suggestedDays: readonly Weekday[];
  readonly order: number;
}

/**
 * §14.5, §27, §28, §29 — how load advances for one Planned Exercise.
 *
 * Embedded on `PlannedExercise` as a value object, not a table (DEC-006): it is
 * 1:1 with its Planned Exercise, created and deleted with it, and never queried
 * on its own. It is a discriminated union on `type`, so the later strategies of
 * §27 (`linear_load`, `rep_target`, `rir_based`, `percentage_based`) are added
 * as union members without a schema change.
 */
export type ProgressionRule = ManualProgression | DoubleProgression;

/** §28 — history is kept and shown; the app never advances the load itself. */
export interface ManualProgression {
  readonly type: 'manual';
}

/**
 * §29 — when the first N sets (N = planned set count) all reach `maxReps`, the
 * suggestion is the previous weight plus `increment`. `increment` is expressed
 * in the exercise's own `unit` (§12 field notes).
 */
export interface DoubleProgression {
  readonly type: 'double_progression';
  readonly increment: number;
}

/**
 * §14.4 — one exercise as programmed inside a Workout. `order` is its position
 * in the Workout. A new one is created by every import, which is why history is
 * queried by `exerciseId` and never by `plannedExerciseId` (§11.9).
 */
export interface PlannedExercise {
  readonly id: PlannedExerciseId;
  readonly workoutId: WorkoutId;
  readonly exerciseId: ExerciseId;
  readonly sets: number;
  /**
   * The target range, for a type whose target axis is reps (REQ-135, REQ-139).
   * Nullable since this change; the names and the meaning are unchanged, so no
   * stored row is rewritten and `parseBackup` needs no field mapping (DEC-Q).
   */
  readonly minReps: number | null;
  readonly maxReps: number | null;
  /**
   * The target range for a type whose target axis is *not* reps (REQ-138):
   * seconds for the duration types, metres for the distance types, both
   * canonical as `restSeconds` already is. Exactly one of the two pairs is
   * populated, decided by the Exercise's measurement (REQ-139).
   */
  readonly minTarget: number | null;
  readonly maxTarget: number | null;
  readonly minRir: number | null;
  readonly maxRir: number | null;
  readonly restSeconds: number | null;
  readonly unit: Unit;
  readonly focus: string | null;
  readonly notes: readonly string[];
  readonly order: number;
  readonly progression: ProgressionRule;
}

/**
 * §14.9 — a user-owned assignment of one Workout to one concrete date, and the
 * only source of truth about when training is intended. Freely movable and
 * deletable. `date` is a local calendar day, never an instant (REQ-013). Two
 * Placements may share a date. A Placement neither creates nor references a
 * Session (ADR 0001); a missed day is a past Placement with no Session and is
 * derived at query time, never stored (§11.3).
 */
export interface Placement {
  readonly id: PlacementId;
  readonly routineId: RoutineId;
  readonly workoutId: WorkoutId;
  readonly date: LocalDate;
}

// ----------------------------------------------------------------- Execution

/**
 * §36, DEC-009 — the stored states of a Session. `scheduled` and `skipped` do
 * not exist: intent is a Placement, and a missed day is derived.
 */
export type SessionStatus = 'in_progress' | 'completed' | 'partial';

/**
 * §14.6 — one performed training session, produced by starting a Workout. Its
 * date is the instant it happened; it has no `scheduledDate` and no reference
 * to a Placement (ADR 0001). It is `completed` when no ExerciseSession is still
 * `pending` at finish, `partial` otherwise (DEC-009). Only `completed` Sessions
 * feed progression (§11.9).
 */
export interface Session {
  readonly id: SessionId;
  readonly routineId: RoutineId;
  readonly workoutId: WorkoutId;
  readonly startedAt: Timestamp;
  readonly completedAt: Timestamp | null;
  readonly status: SessionStatus;
  /**
   * The lifter's bodyweight on the day, or `null` where none has ever been
   * recorded (REQ-108, DEC-C, DEC-I). A field on `Session` rather than a tenth
   * table. Carried forward from the most recent non-null value and editable for
   * the length of the Session. Every row written before this change reads
   * `null`; no backfill invents one.
   */
  readonly bodyweightKg: number | null;
}

/**
 * §14.7, DEC-009 — `performed` on the first logged set, `skipped` only by
 * explicit user action, `pending` until then.
 */
export type ExerciseSessionStatus = 'pending' | 'performed' | 'skipped';

interface ExerciseSessionBase {
  readonly id: ExerciseSessionId;
  readonly sessionId: SessionId;
  readonly exerciseId: ExerciseId;
  readonly order: number;
  readonly status: ExerciseSessionStatus;
  /**
   * The Exercise's measurement, snapshotted when the exercise starts (REQ-105,
   * DEC-H). On the base rather than among the `planned*` fields: an unplanned
   * exercise has a measurement too. Never copied onto `CompletedSet`, so a set
   * cannot contradict the ExerciseSession above it.
   */
  readonly measurement: Measurement;
}

/**
 * §14.7, §16, ADR 0002 — a planned exercise as performed. The `planned*` fields
 * are a snapshot copied from the PlannedExercise when the exercise starts;
 * `plannedExerciseId` is provenance only and targets are never read back
 * through it, so editing the template afterwards cannot rewrite the past.
 */
export interface PlannedExerciseSession extends ExerciseSessionBase {
  readonly plannedExerciseId: PlannedExerciseId;
  /**
   * The unit this exercise is loaded in (§11.7). Snapshotted like every other
   * planned value, and for the same reason: without it the first set of a
   * `lb` exercise has nothing to read but the settings default, and would be
   * stored as kilograms with a `weightKg` converted from the wrong number.
   * Once any set exists, `CompletedSet.unit` carries it instead.
   */
  readonly plannedUnit: Unit;
  readonly plannedSets: number;
  readonly plannedMinReps: number | null;
  readonly plannedMaxReps: number | null;
  /** The non-rep target range, snapshotted alongside the rest (REQ-138). */
  readonly plannedMinTarget: number | null;
  readonly plannedMaxTarget: number | null;
  readonly plannedMinRir: number | null;
  readonly plannedMaxRir: number | null;
  readonly plannedRestSeconds: number | null;
  readonly plannedProgression: ProgressionRule;
}

/**
 * §11.5, §14.7 — an exercise performed with no Planned Exercise behind it. It
 * carries no planned targets and receives no progression suggestion (§11.9).
 * A substitution is a skipped PlannedExerciseSession plus one of these.
 */
export interface UnplannedExerciseSession extends ExerciseSessionBase {
  readonly plannedExerciseId: null;
}

/**
 * §14.7 — one exercise as performed within a Session.
 *
 * A union rather than one shape with nullable targets: `plannedExerciseId`
 * discriminates it, so "unplanned but carrying planned targets" cannot be
 * written down, and reading a target forces the caller to establish that the
 * exercise was planned.
 */
export type ExerciseSession = PlannedExerciseSession | UnplannedExerciseSession;

/**
 * §14.8, §11.7 — the atomic unit of history. `weight` and `unit` preserve what
 * was entered; `weightKg` is the derived value every comparison, chart and
 * progression step reads (`toKg`). `rir` is the RIR actually achieved (§30).
 */
export interface CompletedSet {
  readonly id: CompletedSetId;
  readonly exerciseSessionId: ExerciseSessionId;
  readonly setNumber: number;
  readonly weight: number;
  readonly unit: Unit;
  readonly weightKg: number;
  /**
   * The rep count, or `null` for a type that collects none (REQ-106). Widened
   * by this change; `weight`, `unit`, `weightKg` and `rir` stay required and
   * non-null, because every row already on disk has all five (DER-1).
   */
  readonly reps: number | null;
  readonly rir: number;
  /** Seconds held or worked, for a type that collects a duration (REQ-106). */
  readonly durationSeconds: number | null;
  /** The distance as entered, with its unit, plus the derived metres (REQ-107). */
  readonly distance: number | null;
  readonly distanceUnit: DistanceUnit | null;
  readonly distanceM: number | null;
  readonly completedAt: Timestamp;
}

// ------------------------------------------------------------------ Settings

/**
 * §32, REQ-077 — the single settings row. Every field is a *default*: a value
 * used when nothing more specific is known. None of them reaches back into
 * stored training. The unit is what a routine file inherits when it omits one;
 * each Exercise keeps its own from then on (§12).
 *
 * The fields after `defaultUnit` were added later, so a row already on disk
 * carries only `defaultUnit`. They are optional here for that reason alone —
 * `getSettings` fills them in on read, and every consumer above the repository
 * sees all five. Nothing else may read this type off the database directly.
 *
 * No theme setting: dark was rejected from the use scene (DESIGN.md, the
 * No-Dark-Variant Rule), so there is nothing for a theme control to choose.
 */
export interface Settings {
  readonly id: 'settings';
  readonly defaultUnit: Unit;
  /** The RIR the readouts open on when nothing else is known. `null` = no opinion. */
  readonly defaultRir?: number | null;
  /** Whether the rest timer buzzes when it reaches zero (§11.6). */
  readonly timerVibration?: boolean;
  /** Whether the rest timer beeps when it reaches zero (§11.6). */
  readonly timerSound?: boolean;
  /** Whether the screen is held awake for the length of a session (§11.6). */
  readonly keepScreenAwake?: boolean;
  /**
   * When a backup was last exported, or `null` for never.
   *
   * The app has no server, so the export button is the only thing standing
   * between a lifter and losing everything — and an export button is pressed
   * once and never thought about again. The number is what turns it into a
   * habit, and it cannot be one unless it is written down.
   *
   * Optional like the rest, so a backup taken before this existed still
   * restores (§18's compatibility rule).
   */
  readonly lastBackupAt?: Timestamp | null;
}

/** The settings row as everything above the repository sees it: complete. */
export type ResolvedSettings = Required<Settings>;
