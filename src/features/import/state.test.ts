/**
 * When the wizard announces its outstanding semantic issues.
 *
 * A from-scratch draft is blank, so `validateRoutineFile` has two things to say
 * about it before the lifter has typed a character — and the bar used to say
 * both, two seconds after they pressed "Start from scratch". Suppressing that
 * is only safe because of one property, which is what these tests pin: an issue
 * can never be blocking `Accept` while unannounced. `Accept` lives on step 2,
 * step 2 is only reachable through the `step` action, and that action announces.
 */

import { describe, expect, it } from 'vitest';
import { blankRoutineFile } from '@/domain/routine-file';
import { INITIAL_STATE, reduceWizard, type WizardState } from '@/features/import/state';

const FILE = blankRoutineFile(4);

function editing(announceIssues: boolean): WizardState {
  const state = reduceWizard(INITIAL_STATE, {
    type: 'loaded',
    file: FILE,
    defaultUnit: 'kg',
    announceIssues,
  });
  if (state.phase !== 'editing') throw new Error('expected the editing phase');
  return state;
}

describe('announceIssues', () => {
  it('stays quiet for a draft nobody has submitted', () => {
    expect(editing(false)).toMatchObject({ phase: 'editing', announceIssues: false });
  });

  it('speaks up for a draft that arrived as a file', () => {
    expect(editing(true)).toMatchObject({ phase: 'editing', announceIssues: true });
  });

  it('speaks up once the lifter edits the draft', () => {
    const next = reduceWizard(editing(false), { type: 'edited', file: FILE });
    expect(next).toMatchObject({ announceIssues: true });
  });

  // The safety property. Without this, a lifter could reach `Accept`, find it
  // disabled, and have nothing on screen saying why.
  it('speaks up on the way to step 2, where Accept lives', () => {
    const next = reduceWizard(editing(false), { type: 'step', step: 2 });
    expect(next).toMatchObject({ step: 2, announceIssues: true });
  });

  it('does not un-announce on the way back to step 1', () => {
    const forward = reduceWizard(editing(false), { type: 'step', step: 2 });
    const back = reduceWizard(forward, { type: 'step', step: 1 });
    expect(back).toMatchObject({ step: 1, announceIssues: true });
  });
});
