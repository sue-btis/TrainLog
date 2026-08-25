/**
 * The import wizard's state (§11.1).
 *
 * Three phases, and the draft lives in exactly one of them: nothing is stored
 * until the user accepts, so it exists only here, in memory, and a reload
 * restarts the wizard. That is the PRD's rule, not a limitation — "la rutina no
 * se almacena hasta que el usuario acepta".
 *
 * The editing phase does not record where its draft came from. A file and a
 * blank start produce the same thing — a `RoutineFile` being shaped — and the
 * steps that shape it have no reason to ask which. Only the `choosing` phase
 * still names a file, because that is the phase whose job is reporting what
 * happened to one.
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

/**
 * The duration a from-scratch draft opens on, inside those bounds.
 *
 * A month is the shortest block most programmes are written in, and it is a
 * number the lifter changes on step 2 rather than one they have to supply
 * before they can start. It lives here, not in the domain: the bounds it sits
 * inside are the wizard's, and `blankRoutineFile` takes `weeks` precisely so
 * the domain does not have to know them.
 */
export const DEFAULT_WEEKS = 4;

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
      readonly file: RoutineFile;
      readonly defaultUnit: Unit;
      readonly step: WizardStep;
      readonly accepting: boolean;
      readonly failure: string | null;
      /**
       * Whether outstanding semantic issues are *announced* — the counter in
       * the action bar and the error line under an inline field. It never
       * decides what is allowed: `Accept` is disabled by the issues themselves,
       * so a suppressed issue still blocks it.
       *
       * False only for a draft nobody has submitted or touched yet, which is
       * the from-scratch one. Greeting a lifter who pressed "Start from
       * scratch" two seconds ago with "2 problems still block this routine" is
       * reporting a mistake they have not had the chance to make, and it
       * teaches them to read the counter as decoration by step 2, where it is
       * the only thing pointing at the field in the way.
       *
       * A file arrives with it true: choosing the file *is* the submission, and
       * its problems are findings about something the lifter handed over. That
       * is not the origin the phase deliberately stopped recording — the first
       * edit sets it too, and so does `Next`, whatever the draft came from.
       */
      readonly announceIssues: boolean;
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
      readonly file: RoutineFile;
      readonly defaultUnit: Unit;
      readonly announceIssues: boolean;
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
        file: action.file,
        defaultUnit: action.defaultUnit,
        step: 1,
        accepting: false,
        failure: null,
        announceIssues: action.announceIssues,
      };

    case 'edited':
      // An edit clears a previous acceptance failure: the user is responding
      // to it, and a stale error under a changed file would be a lie.
      // The first edit is also the moment issues start being announced: the
      // lifter has now done something, so what is outstanding is about their
      // draft rather than about an empty form.
      return state.phase === 'editing'
        ? { ...state, file: action.file, failure: null, announceIssues: true }
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
      // `Next` announces them too, and that is what keeps the suppression safe:
      // `Accept` lives on step 2 and step 2 is only reachable through here, so
      // no issue can be blocking `Accept` while still unannounced.
      return state.phase === 'editing'
        ? { ...state, step: action.step, announceIssues: true }
        : state;

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
