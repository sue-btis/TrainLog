/**
 * TST-002 — one case per structural failure class of §11.1 (REQ-031, AC-031).
 * The §12 example parsing cleanly covers the REQ-030 half of TST-001.
 */

import { describe, expect, it } from 'vitest';
import { formatPath, parseRoutineFile } from '@/domain/routine-file';
import { EXAMPLE_YAML } from '@/domain/routine-file/fixtures';

/** The §12 example with one line dropped. */
function exampleWithout(line: RegExp): string {
  const kept = EXAMPLE_YAML.split('\n').filter((l) => !line.test(l));
  if (kept.length === EXAMPLE_YAML.split('\n').length) {
    throw new Error(`fixture drift: ${String(line)} matched nothing`);
  }
  return kept.join('\n');
}

/** The §12 example with one substring replaced. */
function exampleWith(from: string, to: string): string {
  if (!EXAMPLE_YAML.includes(from)) throw new Error(`fixture drift: ${from}`);
  return EXAMPLE_YAML.replace(from, to);
}

function expectRejected(text: string): readonly string[] {
  const result = parseRoutineFile(text);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a structural rejection');
  expect(result.errors.length).toBeGreaterThan(0);
  expect('file' in result).toBe(false); // no partial result (REQ-031)
  return result.errors.map((e) => formatPath(e.path));
}

describe('parseRoutineFile — structural validation (TST-002)', () => {
  it('accepts the §12 example', () => {
    const result = parseRoutineFile(EXAMPLE_YAML);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.file.version).toBe(1);
    expect(result.file.routine.name).toBe('Hybrid Strength - September');
  });

  it('rejects malformed YAML', () => {
    const paths = expectRejected('version: 1\nroutine: [unclosed\n');
    expect(paths).toEqual(['']);
  });

  it('rejects an empty document', () => {
    expectRejected('');
  });

  it('rejects a missing version', () => {
    expect(expectRejected(exampleWithout(/^version:/))).toContain('version');
  });

  it('rejects an unknown version', () => {
    expect(expectRejected(exampleWith('version: 1', 'version: 3'))).toContain(
      'version',
    );
  });

  it('rejects a routine without a name', () => {
    const paths = expectRejected(
      exampleWith('name: "Hybrid Strength', 'title: "Hybrid Strength'),
    );
    expect(paths).toContain('routine.name');
  });

  it('rejects a workout without a name', () => {
    const paths = expectRejected(
      exampleWith('- name: "Push -', '- title: "Push -'),
    );
    expect(paths).toContain('routine.workouts[0].name');
  });

  it('rejects an exercise without a name', () => {
    const paths = expectRejected(
      exampleWith('- name: "Front Squat"', '- title: "Front Squat"'),
    );
    expect(paths).toContain('routine.workouts[0].exercises[0].name');
  });

  it('rejects a missing required field (sets)', () => {
    const paths = expectRejected(exampleWithout(/^          sets: 4$/));
    expect(paths).toContain('routine.workouts[0].exercises[0].sets');
  });

  it('rejects a double_progression without an increment', () => {
    const paths = expectRejected(exampleWithout(/^            increment:/));
    expect(paths).toContain(
      'routine.workouts[0].exercises[0].progression.increment',
    );
  });
});
