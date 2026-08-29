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
