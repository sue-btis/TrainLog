/**
 * The harness (REQ-080 of the technical spine): the second flow of PRD §47 —
 * start a Session, log sets, finish, read history, read the derived
 * progression — driven against real IndexedDB.
 *
 * Its import half retired when the wizard shipped; what is left is deliberately
 * not the Today screen or the gym-mode execution screen, and must not be
 * mistaken for either. Routines come from the wizard at `/import`.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import type { RoutineId } from '@/domain/ids';
import { SessionPanel } from '@/features/harness/SessionPanel';
import { useRoutines } from '@/features/harness/queries';
import { INPUT, LABEL } from '@/features/harness/styles';
import { COLUMN, ICON_STROKE, SCREEN, button } from '@/features/ui/styles';

export function Harness() {
  const routines = useRoutines() ?? [];
  const [picked, setPicked] = useState<RoutineId | null>(null);
  const routineId = picked ?? routines[0]?.id ?? null;

  return (
    <main className={SCREEN}>
      <div className={COLUMN}>
        <header className="flex flex-col gap-2">
          <h1 className="type-display">Session harness</h1>
          <p className="type-caption text-ink-3">
            Drives the execution flow of PRD §47 end to end against IndexedDB.
          </p>
          <Link className={button('ghost', 'compact', 'self-start')} to="/import">
            <ArrowLeft aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            Import a routine
          </Link>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>routine</span>
            <select
              className={INPUT}
              onChange={(event) => setPicked(event.target.value as RoutineId)}
              value={routineId ?? ''}
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

        <SessionPanel routineId={routineId} />
      </div>
    </main>
  );
}
