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

/** The `## Rules` section: what the prompt promises the importer enforces. */
function rulesSection(): string {
  const match = /## Rules\n([\s\S]*?)\n## /.exec(CONVERSION_PROMPT);
  if (match?.[1] === undefined) throw new Error('the prompt no longer has a Rules section');
  return match[1].toLowerCase();
}

describe('CONVERSION_PROMPT', () => {
  it('shows an example the importer parses and finds no fault with', () => {
    const parsed = parseRoutineFile(exampleFile());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(validateRoutineFile(parsed.file)).toEqual([]);
  });

  /**
   * TST-515 (REQ-515) — the header claims "every rule stated here is one the
   * importer enforces", and the example test above only proves the example is
   * clean. A rule the importer gained and the prompt never mentioned is
   * invisible to both: an assistant writes a file the app then refuses, and the
   * lifter has no way to see why the prompt did not warn them.
   */
  it('states the two rules the importer gained most recently', () => {
    const rules = rulesSection();

    expect(rules).toMatch(/at least one workout/);
    expect(rules).toMatch(/must not be blank|not be blank/);
  });

  it('states the numeric rules the semantic tier refuses on', () => {
    const rules = rulesSection();

    expect(rules).toMatch(/sets/);
    expect(rules).toMatch(/reps\.min|reps\.max/);
    expect(rules).toMatch(/rir/);
    expect(rules).toMatch(/rest_seconds/);
  });
});
