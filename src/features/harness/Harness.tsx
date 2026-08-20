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
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RoutineId } from '@/domain/ids';
import { SessionPanel } from '@/features/harness/SessionPanel';
import { TopBar } from '@/features/shell/TopBar';
import { useRoutines } from '@/features/harness/queries';
import { LABEL } from '@/features/harness/styles';
import { COLUMN, ICON_STROKE, SCREEN } from '@/features/ui/styles';

export function Harness() {
  const routines = useRoutines() ?? [];
  const [picked, setPicked] = useState<RoutineId | null>(null);
  const routineId = picked ?? routines[0]?.id ?? null;

  return (
    <main className={SCREEN}>
      <TopBar
        back={{ to: '/today' }}
        backLabel="Back to Today"
        icon={FlaskConical}
        title="Session harness"
      />

      <div className={COLUMN}>
        <header className="flex flex-col gap-2">
          <p className="type-caption text-ink-3">
            Drives the execution flow of PRD §47 end to end against IndexedDB.
          </p>
          <Button asChild size="compact" variant="ghost" className="self-start">
            <Link to="/import">
              <ArrowLeft aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
              Import a routine
            </Link>
          </Button>
          <div className="flex flex-col gap-1">
            <span className={LABEL}>routine</span>
            <Select
              onValueChange={(next) => setPicked(next as RoutineId)}
              value={routineId ?? ''}
            >
              <SelectTrigger className="type-measure">
                <SelectValue placeholder="no routine imported yet" />
              </SelectTrigger>
              <SelectContent>
                {routines.map((routine) => (
                  <SelectItem className="type-measure" key={routine.id} value={routine.id}>
                    {routine.name} · {routine.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        <SessionPanel routineId={routineId} />
      </div>
    </main>
  );
}
