/**
 * The import wizard's state (§11.1).
 *
 * Three phases, and the file lives in exactly one of them: nothing is stored
 * until the user accepts, so the draft exists only here, in memory, and a
 * reload restarts the import. That is the PRD's rule, not a limitation —
 * "la rutina no se almacena hasta que el usuario acepta".
 */

import type { LocalDate } from '@/domain/dates';
import {
  setWeeks,
  toggleSuggestedDay,
  type RoutineFile,
  type StructuralError,
} from '@/domain/routine-file';
import type { Unit, Weekday } from '@/domain/types';

/** The duration a Routine may declare. One week is the smallest useful block. */
export const MIN_WEEKS = 1;
export const MAX_WEEKS = 52;

export type WizardStep = 1 | 2;

/** What the confirmation reports, taken from what was actually written. */
export interface AcceptedSummary {
  readonly routineName: string;
  readonly workouts: number;
  readonly exercises: number;
  readonly placements: number;
  readonly first: LocalDate | null;
  readonly last: LocalDate | null;
}

export type WizardState =
  | {
      readonly phase: 'choosing';
      readonly fileName: string | null;
      /** Structural failures: the file was read but rejected (§11.1). */
      readonly errors: readonly StructuralError[] | null;
      /** The file could not be read at all. */
      readonly unreadable: string | null;
    }
  | {
      readonly phase: 'editing';
      readonly fileName: string;
      readonly file: RoutineFile;
      readonly defaultUnit: Unit;
      readonly step: WizardStep;
      readonly accepting: boolean;
      readonly failure: string | null;
    }
  | { readonly phase: 'accepted'; readonly summary: AcceptedSummary };

export type WizardAction =
  | { readonly type: 'restart' }
  | {
      readonly type: 'rejected';
      readonly fileName: string;
      readonly errors: readonly StructuralError[];
    }
  | { readonly type: 'unreadable'; readonly fileName: string; readonly message: string }
  | {
      readonly type: 'loaded';
      readonly fileName: string;
      readonly file: RoutineFile;
      readonly defaultUnit: Unit;
    }
  | { readonly type: 'edited'; readonly file: RoutineFile }
  /**
   * Step 2's two edits arrive as intent rather than as a finished file, so the
   * reducer reads the current one. A view that computes `weeks - 1` from its
   * own render loses a decrement when a lifter taps twice before React has
   * re-rendered; the reducer never sees a stale file.
   */
  | { readonly type: 'weeksBy'; readonly delta: number }
  | { readonly type: 'toggleDay'; readonly workout: number; readonly day: Weekday }
  | { readonly type: 'step'; readonly step: WizardStep }
  | { readonly type: 'accepting' }
  | { readonly type: 'accepted'; readonly summary: AcceptedSummary }
  | { readonly type: 'acceptFailed'; readonly message: string };

export const INITIAL_STATE: WizardState = {
  phase: 'choosing',
  fileName: null,
  errors: null,
  unreadable: null,
};

export function reduceWizard(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'restart':
      return INITIAL_STATE;

    case 'rejected':
      return {
        phase: 'choosing',
        fileName: action.fileName,
        errors: action.errors,
        unreadable: null,
      };

    case 'unreadable':
      return {
        phase: 'choosing',
        fileName: action.fileName,
        errors: null,
        unreadable: action.message,
      };

    case 'loaded':
      return {
        phase: 'editing',
        fileName: action.fileName,
        file: action.file,
        defaultUnit: action.defaultUnit,
        step: 1,
        accepting: false,
        failure: null,
      };

    case 'edited':
      // An edit clears a previous acceptance failure: the user is responding
      // to it, and a stale error under a changed file would be a lie.
      return state.phase === 'editing'
        ? { ...state, file: action.file, failure: null }
        : state;

    case 'weeksBy': {
      if (state.phase !== 'editing') return state;
      const weeks = clamp(state.file.routine.weeks + action.delta);
      return weeks === state.file.routine.weeks
        ? state
        : { ...state, file: setWeeks(state.file, weeks), failure: null };
    }

    case 'toggleDay':
      return state.phase === 'editing'
        ? {
            ...state,
            file: toggleSuggestedDay(state.file, action.workout, action.day),
            failure: null,
          }
        : state;

    case 'step':
      return state.phase === 'editing' ? { ...state, step: action.step } : state;

    case 'accepting':
      return state.phase === 'editing'
        ? { ...state, accepting: true, failure: null }
        : state;

    case 'accepted':
      return { phase: 'accepted', summary: action.summary };

    case 'acceptFailed':
      // The draft survives verbatim, so a retry costs nothing (R-15).
      return state.phase === 'editing'
        ? { ...state, accepting: false, failure: action.message }
        : state;
  }
}

function clamp(weeks: number): number {
  return Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, weeks));
}
