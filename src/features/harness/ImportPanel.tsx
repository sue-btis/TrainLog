/**
 * Flow 1 of PRD §47 (REQ-080): routine.yaml → parse → validate → domain
 * objects → IndexedDB → Placements.
 *
 * The anchor date is a control, not a clock read: `generatePlacements` takes it
 * explicitly (DEC-008), and the harness is the caller that owns "today".
 */

import { useState } from 'react';
import { getDefaultUnit, importRoutine, listUserExercises } from '@/db';
import { formatLocalDate, toLocalDate } from '@/domain/dates';
import type { RoutineId } from '@/domain/ids';
import {
  formatPath,
  parseRoutineFile,
  validateRoutineFile,
  type ParseRoutineFileResult,
} from '@/domain/routine-file';
import { routineFileToDomain } from '@/domain/routine-file';
import { generatePlacements } from '@/domain/scheduling';
import { usePlacements, useWorkouts } from '@/features/harness/queries';
import { BUTTON, CARD, INPUT, LABEL, PANEL, WELL } from '@/features/harness/styles';

interface ImportPanelProps {
  readonly routineId: RoutineId | null;
  readonly onImported: (routineId: RoutineId) => void;
}

export function ImportPanel({ routineId, onImported }: ImportPanelProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseRoutineFileResult | null>(null);
  const [anchorDate, setAnchorDate] = useState<string>(() => formatLocalDate(new Date()));
  const [failure, setFailure] = useState<string | null>(null);

  const workouts = useWorkouts(routineId) ?? [];
  const placements = usePlacements(routineId) ?? [];
  const issues = parsed?.ok === true ? validateRoutineFile(parsed.file) : [];
  const canAccept = parsed?.ok === true && issues.length === 0 && anchorDate !== '';

  async function onFileChange(file: File | undefined) {
    setFailure(null);
    if (file === undefined) {
      setFileName(null);
      setParsed(null);
      return;
    }
    setFileName(file.name);
    setParsed(parseRoutineFile(await file.text()));
  }

  async function accept() {
    if (parsed?.ok !== true) return;
    setFailure(null);
    try {
      const [defaultUnit, existingExercises] = await Promise.all([
        getDefaultUnit(),
        listUserExercises(),
      ]);
      const draft = routineFileToDomain(parsed.file, {
        defaultUnit,
        existingExercises,
        createdAt: Date.now(),
      });
      const generated = generatePlacements({
        workouts: draft.workouts,
        weeks: draft.routine.weeks,
        anchorDate: toLocalDate(anchorDate),
      });
      await importRoutine(draft, generated);
      onImported(draft.routine.id);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className={PANEL}>
      <h2 className="type-headline">1 — Import a routine file</h2>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>routine .yaml</span>
        <input
          type="file"
          accept=".yaml,.yml,text/yaml"
          className={INPUT}
          onChange={(event) => void onFileChange(event.target.files?.[0])}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>anchor date (week 1)</span>
        <input
          type="date"
          className={INPUT}
          value={anchorDate}
          onChange={(event) => setAnchorDate(event.target.value)}
        />
      </label>

      {fileName !== null && <p className="type-measure text-ink-3">{fileName}</p>}

      {parsed?.ok === false && (
        <div className={CARD}>
          <span className={LABEL}>structural errors — import rejected</span>
          <ul className="flex flex-col gap-1">
            {parsed.errors.map((error, index) => (
              <li key={index} className="type-measure text-missed-ink">
                {formatPath(error.path)} {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {parsed?.ok === true && (
        <div className={CARD}>
          <span className={LABEL}>parsed</span>
          <p className="type-title">{parsed.file.routine.name}</p>
          <p className="type-measure text-ink-3">
            {parsed.file.routine.weeks} weeks · {parsed.file.routine.workouts.length} workouts
          </p>
          <span className={LABEL}>
            semantic issues — {issues.length === 0 ? 'none, accept is allowed' : 'accept is blocked'}
          </span>
          <ul className="flex flex-col gap-1">
            {issues.map((issue, index) => (
              <li key={index} className="type-measure text-live-ink">
                [{issue.code}] {issue.paths.map(formatPath).join(', ')} — {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" className={BUTTON} disabled={!canAccept} onClick={() => void accept()}>
        Accept import
      </button>

      {failure !== null && <p className="type-measure text-missed-ink">{failure}</p>}

      <div className={CARD}>
        <span className={LABEL}>placements in IndexedDB — {placements.length}</span>
        <ul className="flex flex-col gap-1">
          {placements.map((placement) => (
            <li key={placement.id} className={WELL}>
              <span className="type-measure text-ink">
                {placement.date} ·{' '}
                {workouts.find((workout) => workout.id === placement.workoutId)?.name ?? placement.workoutId}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
