import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MEASUREMENTS } from '@/domain/measurement';
import { parseRoutineFile } from '@/domain/routine-file/schema';
import { validateRoutineFile, type SemanticIssueCode } from '@/domain/routine-file/validate';

const FORMAT = readFileSync(fileURLToPath(new URL('../../../docs/FORMAT.md', import.meta.url)), 'utf8');

// `\r?` because a Windows checkout with core.autocrlf hands this file over with CRLF.
const yamlBlocks = [...FORMAT.matchAll(/```yaml\r?\n([\s\S]*?)```/g)].map((match) => match[1]!);

// A record keyed by the union, so adding a code to `validate.ts` stops this file
// compiling until the code is listed here, and then fails until the guide has it.
const CODES = Object.keys({
  reps_range_inverted: true,
  target_range_inverted: true,
  target_pair_ambiguous: true,
  target_pair_missing: true,
  target_axis_mismatch: true,
  rir_out_of_range: true,
  rest_seconds_negative: true,
  sets_not_positive: true,
  progression_unrecognized: true,
  suggested_day_shared: true,
  routine_has_no_workouts: true,
  routine_name_blank: true,
} satisfies Record<SemanticIssueCode, true>);

describe('docs/FORMAT.md', () => {
  it('has examples to check', () => {
    expect(yamlBlocks.length).toBeGreaterThan(0);
  });

  it.each(yamlBlocks.map((block, index) => [index, block] as const))(
    'yaml block %i parses and validates clean, axis check on',
    (_, block) => {
      const result = parseRoutineFile(block);
      if (!result.ok) throw new Error(JSON.stringify(result.errors));

      expect(validateRoutineFile(result.file, { knownExercises: [] })).toEqual([]);
    },
  );

  it('documents every measurement and every semantic code', () => {
    for (const name of [...MEASUREMENTS, ...CODES]) expect(FORMAT).toContain(`\`${name}\``);
  });
});
