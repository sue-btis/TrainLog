/**
 * The prompt teaches the format by example, so the example has to be one the
 * importer actually accepts — otherwise a schema change quietly turns the
 * prompt into instructions for producing files this app rejects.
 */

import { describe, expect, it } from 'vitest';
import { parseRoutineFile, validateRoutineFile } from '@/domain/routine-file';
import { CONVERSION_PROMPT } from '@/features/import/ConversionPromptButton';

/** The one ```yaml block in the prompt: the format, written out. */
function exampleFile(): string {
  const match = /```yaml\n([\s\S]*?)```/.exec(CONVERSION_PROMPT);
  if (match?.[1] === undefined) throw new Error('the prompt no longer contains a YAML example');
  return match[1];
}

describe('CONVERSION_PROMPT', () => {
  it('shows an example the importer parses and finds no fault with', () => {
    const parsed = parseRoutineFile(exampleFile());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(validateRoutineFile(parsed.file)).toEqual([]);
  });
});
