/**
 * Flow 2 of PRD §47 (REQ-080): PlannedExercise → start Session → snapshot
 * targets → ExerciseSession → CompletedSet → IndexedDB → history → derived
 * progression, with the previous performance read of §11.8 alongside.
 *
 * Every instant is supplied here, by the caller, because no domain function
 * reads the clock (DEC-008).
 */

import { useState } from 'react';
import {
  addExerciseSession,
  createSession,
  saveExerciseSession,
  saveFinishedSession,
  saveLoggedSet,
} from '@/db';
import type { RoutineId, SessionId, WorkoutId } from '@/domain/ids';
import type { SessionHistory } from '@/domain/progression';
import { suggestLoad } from '@/domain/progression';
import {
  finishSession,
  logSet,
  skipExercise,
  startPlannedExercise,
  startSession,
} from '@/domain/session';
import type { PlannedExercise } from '@/domain/types';
import {
  useExerciseHistory,
  useExerciseNames,
  useInProgressSession,
  usePlannedExercises,
  usePreviousPerformance,
  useSessionDetail,
  useWorkouts,
} from '@/features/harness/queries';
import { BUTTON, BUTTON_QUIET, CARD, INPUT, LABEL, PANEL, WELL } from '@/features/harness/styles';

type Entry = SessionHistory['exercises'][number];

interface SessionPanelProps {
  readonly routineId: RoutineId | null;
}

export function SessionPanel({ routineId }: SessionPanelProps) {
  const workouts = useWorkouts(routineId) ?? [];
  const session = useInProgressSession();
  const [picked, setPicked] = useState<WorkoutId | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const workoutId = session?.workoutId ?? picked ?? workouts[0]?.id ?? null;
  const planned = usePlannedExercises(workoutId) ?? [];
  const detail = useSessionDetail(session?.id ?? null);
  const names = useExerciseNames(planned.map((exercise) => exercise.exerciseId));

  async function run(action: () => Promise<unknown>) {
    setFailure(null);
    try {
      await action();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  }

  const exerciseSessions = detail?.exercises.map((entry) => entry.exerciseSession) ?? [];

  return (
    <section className={PANEL}>
      <h2 className="type-headline">2 — Perform a session</h2>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>workout</span>
        <select
          className={INPUT}
          value={workoutId ?? ''}
          disabled={session !== undefined}
          onChange={(event) => setPicked(event.target.value as WorkoutId)}
        >
          {workouts.map((workout) => (
            <option key={workout.id} value={workout.id}>
              {workout.name}
            </option>
          ))}
        </select>
      </label>

      {session === undefined ? (
        <button
          type="button"
          className={BUTTON}
          disabled={routineId === null || workoutId === null}
          onClick={() =>
            void run(() => {
              if (routineId === null || workoutId === null) return Promise.resolve();
              return createSession(startSession({ routineId, workoutId, startedAt: Date.now() }));
            })
          }
        >
          Start session
        </button>
      ) : (
        <div className={CARD}>
          <span className={LABEL}>session in progress</span>
          <p className="type-measure text-ink-3">
            started {new Date(session.startedAt).toLocaleString()} · {exerciseSessions.length}{' '}
            exercises
          </p>
          <button
            type="button"
            className={BUTTON}
            onClick={() =>
              void run(() =>
                saveFinishedSession(
                  finishSession(session, exerciseSessions, Date.now()),
                  exerciseSessions,
                ),
              )
            }
          >
            Finish session
          </button>
        </div>
      )}

      {failure !== null && <p className="type-measure text-missed-ink">{failure}</p>}

      {planned.map((exercise) => (
        <ExerciseRow
          key={exercise.id}
          planned={exercise}
          name={names?.get(exercise.exerciseId) ?? exercise.exerciseId}
          sessionId={session?.id ?? null}
          entry={detail?.exercises.find(
            (candidate) => candidate.exerciseSession.plannedExerciseId === exercise.id,
          )}
          onFailure={setFailure}
        />
      ))}
    </section>
  );
}

interface ExerciseRowProps {
  readonly planned: PlannedExercise;
  readonly name: string;
  readonly sessionId: SessionId | null;
  readonly entry: Entry | undefined;
  readonly onFailure: (message: string | null) => void;
}

function ExerciseRow({ planned, name, sessionId, entry, onFailure }: ExerciseRowProps) {
  const previous = usePreviousPerformance(planned.exerciseId, sessionId);
  const history = useExerciseHistory(planned.exerciseId);
  const suggestion = history === undefined ? null : suggestLoad(planned, history);

  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState('');

  async function run(action: () => Promise<unknown>) {
    onFailure(null);
    try {
      await action();
    } catch (error) {
      onFailure(error instanceof Error ? error.message : String(error));
    }
  }

  function log() {
    if (entry === undefined) return Promise.resolve();
    return saveLoggedSet(
      logSet({
        exerciseSession: entry.exerciseSession,
        setNumber: entry.sets.length + 1,
        weight: Number(weight),
        unit: planned.unit,
        reps: Number(reps),
        rir: Number(rir),
        completedAt: Date.now(),
      }),
    );
  }

  const numbersEntered = [weight, reps, rir].every(
    (value) => value !== '' && Number.isFinite(Number(value)),
  );

  return (
    <div className={CARD}>
      <p className="type-title">{name}</p>
      <p className="type-measure text-ink-3">
        {planned.sets} x {planned.minReps}-{planned.maxReps} reps
        {planned.minRir === null ? '' : ` @ RIR ${planned.minRir}-${planned.maxRir}`} ·{' '}
        {planned.unit} · {planned.progression.type}
        {planned.progression.type === 'double_progression'
          ? ` +${planned.progression.increment}`
          : ''}
      </p>

      <div className={WELL}>
        <span className={LABEL}>previous</span>
        {previous === undefined ? (
          <span className="type-measure text-ink-3">no previous performance</span>
        ) : (
          previous.exercises.flatMap((exercise) =>
            exercise.sets.map((set) => (
              <span key={set.id} className="type-measure text-ink">
                Set {set.setNumber} → {set.weight} {set.unit} x {set.reps} @{set.rir}
              </span>
            )),
          )
        )}
      </div>

      <div className={WELL}>
        <span className={LABEL}>progression suggestion</span>
        <span className="type-measure text-progress-ink">
          {suggestion === null
            ? 'none — no completed history yet'
            : `${suggestion.weight} ${suggestion.unit} (${suggestion.weightKg} kg) · target ${
                suggestion.targetMet ? 'met, load advances' : 'not met, repeat load'
              }`}
        </span>
      </div>

      <div className={WELL}>
        <span className={LABEL}>history — {history?.length ?? 0} sessions</span>
        {(history ?? []).map((item) => (
          <span key={item.session.id} className="type-measure text-ink-3">
            {new Date(item.session.startedAt).toLocaleDateString()} · {item.session.status} ·{' '}
            {item.exercises
              .flatMap((exercise) => exercise.sets)
              .map((set) => `${set.weight}${set.unit}x${set.reps}@${set.rir}`)
              .join(' ') || 'no sets'}
          </span>
        ))}
      </div>

      {sessionId !== null && entry === undefined && (
        <button
          type="button"
          className={BUTTON_QUIET}
          onClick={() =>
            void run(() =>
              addExerciseSession(startPlannedExercise({ sessionId, planned, order: planned.order })),
            )
          }
        >
          Start exercise (snapshot targets)
        </button>
      )}

      {entry !== undefined && (
        <div className="flex flex-col gap-2">
          <span className={LABEL}>logged sets — {entry.exerciseSession.status}</span>
          {entry.sets.map((set) => (
            <span key={set.id} className="type-measure text-actual-ink">
              Set {set.setNumber} → {set.weight} {set.unit} x {set.reps} @{set.rir} ({set.weightKg}{' '}
              kg)
            </span>
          ))}
          <div className="flex flex-wrap gap-2">
            <input
              className={INPUT}
              inputMode="decimal"
              placeholder="weight"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
            />
            <input
              className={INPUT}
              inputMode="numeric"
              placeholder="reps"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
            />
            <input
              className={INPUT}
              inputMode="numeric"
              placeholder="rir"
              value={rir}
              onChange={(event) => setRir(event.target.value)}
            />
            <button
              type="button"
              className={BUTTON}
              disabled={!numbersEntered}
              onClick={() => void run(log)}
            >
              Log set
            </button>
            <button
              type="button"
              className={BUTTON_QUIET}
              onClick={() =>
                void run(() => saveExerciseSession(skipExercise(entry.exerciseSession)))
              }
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
