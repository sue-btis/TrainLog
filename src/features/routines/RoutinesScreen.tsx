/**
 * Routines (§11.2).
 *
 * A Routine is immutable once accepted, so this screen holds no editor — only
 * the three things §11.2 says a lifter does with one: make it the current
 * programme, put it away, or get rid of it. Editing means importing again,
 * which is why `Import routine` sits at the top.
 *
 * Deleting is refused while any Session references the Routine (§37): history
 * outranks tidiness, and the refusal says so and offers archiving instead.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { Archive, ChevronRight, FileUp, Play, ScrollText, Trash2, TriangleAlert } from 'lucide-react';
import {
  RoutineHasSessionsError,
  activateRoutine,
  archiveRoutine,
  deleteRoutine,
} from '@/db';
import type { RoutineId } from '@/domain/ids';
import type { Routine } from '@/domain/types';
import { useRoutines } from '@/features/data/queries';
import { plural, shortDate } from '@/features/ui/format';
import { ScreenHeader } from '@/features/ui/ScreenHeader';
import { CARD, ICON_STROKE, LABEL, WELL, alert, button, chip } from '@/features/ui/styles';
import { formatLocalDate } from '@/domain/dates';

export function RoutinesScreen() {
  const routines = useRoutines();
  const [refusal, setRefusal] = useState<{ routineId: RoutineId; message: string } | null>(null);

  async function remove(routine: Routine) {
    setRefusal(null);
    try {
      await deleteRoutine(routine.id);
    } catch (error) {
      if (error instanceof RoutineHasSessionsError) {
        setRefusal({
          routineId: routine.id,
          message: `${routine.name} has ${plural(error.sessionCount, 'session')} recorded against it. Deleting it would take that history with it, so archive it instead: the Routine gets out of your way and every session stays.`,
        });
        return;
      }
      throw error;
    }
  }

  return (
    <>
      <ScreenHeader icon={ScrollText} title="Routines">
        <p className="type-body-sm text-ink-2">
          Every programme you have imported. One is active at a time; the rest wait,
          archived, with their history intact.
        </p>
      </ScreenHeader>

      <Link className={button('primary', 'block')} to="/import">
        <FileUp aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        Import routine
      </Link>

      {routines === undefined ? null : routines.length === 0 ? (
        <section className={WELL}>
          <p className="type-title">No routines yet</p>
          <p className="type-body-sm text-ink-2">
            A routine is a YAML file describing your programme — its Workouts, their
            exercises and the days they fall on. Import one and it becomes your calendar.
          </p>
        </section>
      ) : (
        routines.map((routine) => (
          <RoutineRow
            key={routine.id}
            onActivate={() => activateRoutine(routine.id)}
            onArchive={() => archiveRoutine(routine.id)}
            onDelete={() => remove(routine)}
            refusal={refusal?.routineId === routine.id ? refusal.message : null}
            routine={routine}
          />
        ))
      )}
    </>
  );
}

interface RoutineRowProps {
  readonly routine: Routine;
  readonly refusal: string | null;
  readonly onActivate: () => void;
  readonly onArchive: () => void;
  readonly onDelete: () => void;
}

function RoutineRow({ routine, refusal, onActivate, onArchive, onDelete }: RoutineRowProps) {
  const [confirming, setConfirming] = useState(false);
  const active = routine.status === 'active';

  return (
    <section className={CARD}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="type-title">{routine.name}</h2>
          <p className="type-measure-sm text-ink-3">
            {plural(routine.weeks, 'week')} · imported {shortDate(formatLocalDate(new Date(routine.createdAt)))}
          </p>
        </div>
        <span className={chip(active ? 'actual' : 'neutral')}>{routine.status}</span>
      </div>

      {refusal !== null && (
        <div className={alert('missed')}>
          <TriangleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={18} strokeWidth={ICON_STROKE} />
          <div className="flex flex-col gap-1">
            <p className="type-title">Delete refused</p>
            <p className="type-body-sm">{refusal}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link className={button('secondary', 'compact')} to={`/routines/${routine.id}`}>
          View
          <ChevronRight aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
        </Link>

        {active ? (
          <button className={button('secondary', 'compact')} onClick={onArchive} type="button">
            <Archive aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            Archive
          </button>
        ) : (
          <button className={button('secondary', 'compact')} onClick={onActivate} type="button">
            <Play aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            Make active
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {confirming && (
            <button
              className={button('quiet', 'compact')}
              onClick={() => setConfirming(false)}
              type="button"
            >
              Keep it
            </button>
          )}
          <button
            aria-label={confirming ? `Confirm deleting ${routine.name}` : `Delete ${routine.name}`}
            className={button(
              'danger',
              'compact',
              confirming ? 'shadow-none' : undefined,
            )}
            onClick={() => {
              if (confirming) {
                setConfirming(false);
                void onDelete();
              } else {
                setConfirming(true);
              }
            }}
            type="button"
          >
            <Trash2 aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            {confirming ? 'Delete it' : 'Delete'}
          </button>
        </div>
      </div>

      {confirming && (
        <p className={LABEL}>
          this removes the routine, its workouts and its placements — sessions are never
          touched
        </p>
      )}
    </section>
  );
}
