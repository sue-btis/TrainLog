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
 *
 * `Import routine` opens the file picker here and hands the wizard what it
 * chose, rather than routing to a wizard step whose only content is the same
 * request a second time.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { Archive, ChevronRight, FileUp, Play, Trash2, TriangleAlert } from 'lucide-react';
import {
  RoutineHasSessionsError,
  activateRoutine,
  archiveRoutine,
  deleteRoutine,
} from '@/db';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { RoutineId } from '@/domain/ids';
import type { Routine } from '@/domain/types';
import { useRoutines, useSessionsByRoutine } from '@/features/data/queries';
import { ConversionPromptButton } from '@/features/import/ConversionPromptButton';
import { ImportRoutineButton } from '@/features/import/ImportRoutineButton';
import { plural, shortDate } from '@/features/ui/format';
import { useAsyncAction } from '@/features/ui/useAsyncAction';
import { ICON_STROKE, LABEL, WELL, alert, chip } from '@/features/ui/styles';
import { formatLocalDate } from '@/domain/dates';

export function RoutinesScreen() {
  const routines = useRoutines();
  // Activating and archiving used to be bare promises handed to an `onClick`
  // typed `() => void`: nothing awaited them, nothing caught them, and nothing
  // on screen said a write was running. Archiving the active Routine changes
  // what Today shows, so it is worth more than silence.
  const { busy, failure, run } = useAsyncAction();
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
      <ImportRoutineButton>
        <FileUp aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        Import routine
      </ImportRoutineButton>

      <ConversionPromptButton />

      {failure !== null && (
        <p className="type-body-sm text-missed-ink" role="alert">
          {failure}
        </p>
      )}

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
            busy={busy}
            key={routine.id}
            onActivate={() => void run(() => activateRoutine(routine.id))}
            onArchive={() => void run(() => archiveRoutine(routine.id))}
            onDelete={() => void run(() => remove(routine))}
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
  /** A write is running somewhere on this screen — no row offers a second one. */
  readonly busy: boolean;
  readonly onActivate: () => void;
  readonly onArchive: () => void;
  readonly onDelete: () => void;
}

function RoutineRow({ routine, refusal, busy, onActivate, onArchive, onDelete }: RoutineRowProps) {
  const [confirming, setConfirming] = useState(false);
  const active = routine.status === 'active';

  // §37's refusal, asked before the lifter presses rather than after.
  // It used to arm, confirm, and only then report that the delete was refused —
  // for a condition the app could answer on render. Two presses to be told no
  // is the shape of a control that should never have offered.
  //
  // The repository stays the authority: `refusal` below is still rendered if a
  // delete is refused anyway, because this read can be a moment stale.
  const sessions = useSessionsByRoutine(routine.id);
  const blocked = sessions !== undefined && sessions.length > 0;

  return (
    <Card>
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
        <Button asChild size="compact" variant="secondary">
          <Link to={`/routines/${routine.id}`}>
            View
            <ChevronRight aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          </Link>
        </Button>

        {active ? (
          <Button disabled={busy} onClick={onArchive} size="compact" type="button" variant="secondary">
            <Archive aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            Archive
          </Button>
        ) : (
          <Button disabled={busy} onClick={onActivate} size="compact" type="button" variant="secondary">
            <Play aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            Make active
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {confirming && (
            <Button
              onClick={() => setConfirming(false)}
              size="compact"
              type="button"
              variant="quiet"
            >
              Keep it
            </Button>
          )}
          <Button
            aria-label={
              blocked
                ? `${routine.name} cannot be deleted — sessions reference it`
                : confirming
                  ? `Confirm deleting ${routine.name}`
                  : `Delete ${routine.name}`
            }
            className={confirming ? 'shadow-none' : undefined}
            disabled={blocked || busy}
            onClick={() => {
              if (confirming) {
                setConfirming(false);
                void onDelete();
              } else {
                setConfirming(true);
              }
            }}
            size="compact"
            type="button"
            variant="danger"
          >
            <Trash2 aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            {confirming ? 'Delete it' : 'Delete'}
          </Button>
        </div>
      </div>

      {blocked && (
        <p className="type-body-sm text-ink-2">
          {plural(sessions.length, 'session')} in your history{' '}
          {sessions.length === 1 ? 'uses' : 'use'} this routine. Archive it instead — it leaves Today and the calendar, your history stays intact.
        </p>
      )}

      {confirming && (
        <p className={LABEL}>
          this removes the routine, its workouts and its days on the calendar — sessions
          are never touched
        </p>
      )}
    </Card>
  );
}
