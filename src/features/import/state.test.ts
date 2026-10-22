import { describe, expect, it } from 'vitest';
import type { LocalDate } from '@/domain/dates';
import { blankRoutineFile } from '@/domain/routine-file';
import {
  INITIAL_STATE,
  createdAtFor,
  reduceWizard,
  type WizardState,
} from '@/features/import/state';

const FILE = blankRoutineFile(4);

function editing(announceIssues: boolean): WizardState {
  const state = reduceWizard(INITIAL_STATE, {
    type: 'loaded',
    file: FILE,
    defaultUnit: 'kg',
    startDate: '2026-10-22' as LocalDate,
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

describe('start date', () => {
  const today = '2026-10-22' as LocalDate;

  it('opens on the date it was loaded with and keeps the old Routine placements', () => {
    expect(editing(false)).toMatchObject({ startDate: today, removeRemaining: false });
  });

  it('takes a later date', () => {
    const next = reduceWizard(editing(false), {
      type: 'startDate',
      date: '2026-10-28' as LocalDate,
      today,
    });
    expect(next).toMatchObject({ startDate: '2026-10-28' });
  });

  it('falls back to today for a past or cleared date', () => {
    const past = reduceWizard(editing(false), {
      type: 'startDate',
      date: '2026-10-01' as LocalDate,
      today,
    });
    const cleared = reduceWizard(editing(false), {
      type: 'startDate',
      date: '' as LocalDate,
      today,
    });
    expect(past).toMatchObject({ startDate: today });
    expect(cleared).toMatchObject({ startDate: today });
  });

  it('records the choice to remove the previous placements', () => {
    const next = reduceWizard(editing(false), { type: 'removeRemaining', remove: true });
    expect(next).toMatchObject({ removeRemaining: true });
  });
});

describe('createdAtFor', () => {
  const today = '2026-10-22' as LocalDate;

  it('keeps the real moment when the block starts today', () => {
    expect(createdAtFor(today, today, 1_234)).toBe(1_234);
  });

  it('is the start day local midnight for a later start', () => {
    expect(createdAtFor('2026-10-28' as LocalDate, today, 1_234)).toBe(
      new Date(2026, 9, 28).getTime(),
    );
  });
});
