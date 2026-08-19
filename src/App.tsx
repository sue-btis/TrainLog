/**
 * The harness (REQ-080): one route, two panels, driving the two flows of
 * PRD §47 against real IndexedDB. It is deliberately not the import wizard,
 * the calendar, Today, or the gym-mode execution screen — those are later
 * changes and this must not be mistaken for any of them.
 */

import { useState } from 'react';
import type { RoutineId } from '@/domain/ids';
import { ImportPanel } from '@/features/harness/ImportPanel';
import { SessionPanel } from '@/features/harness/SessionPanel';
import { useRoutines } from '@/features/harness/queries';
import { INPUT, LABEL } from '@/features/harness/styles';

export function App() {
  const routines = useRoutines() ?? [];
  const [picked, setPicked] = useState<RoutineId | null>(null);
  const routineId = picked ?? routines[0]?.id ?? null;

  return (
    <main className="bg-board text-ink min-h-screen p-6 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="type-display">TrainLog harness</h1>
        <p className="type-caption text-ink-3">
          Drives the two flows of PRD §47 end to end against IndexedDB.
        </p>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>routine</span>
          <select
            className={INPUT}
            value={routineId ?? ''}
            onChange={(event) => setPicked(event.target.value as RoutineId)}
          >
            {routines.length === 0 && <option value="">no routine imported yet</option>}
            {routines.map((routine) => (
              <option key={routine.id} value={routine.id}>
                {routine.name} · {routine.status}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <ImportPanel routineId={routineId} onImported={setPicked} />
        <SessionPanel routineId={routineId} />
      </div>
    </main>
  );
}
