import { describe, expect, it } from 'vitest';
import { parseRoutineFile, validateRoutineFile } from '@/domain/routine-file';
import { routineFileToDomain } from '@/domain/routine-file/to-domain';
import { CATALOG, getCatalogExercise } from '@/domain/catalog';
import { targetsReps } from '@/domain/measurement';
import { conversionPrompt } from '@/features/import/ConversionPromptButton';

const CONVERSION_PROMPT = conversionPrompt(CATALOG);

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

  it('shows an example that maps to exactly one target pair per exercise', () => {
    const parsed = parseRoutineFile(exampleFile());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const draft = routineFileToDomain(parsed.file, {
      defaultUnit: 'kg',
      existingExercises: [],
      createdAt: 1,
    });
    expect(draft.plannedExercises.length).toBeGreaterThan(0);

    const minted = new Map(draft.createdExercises.map((it) => [it.id, it] as const));
    for (const planned of draft.plannedExercises) {
      const exercise = minted.get(planned.exerciseId) ?? getCatalogExercise(planned.exerciseId);
      expect(exercise).toBeDefined();
      const onReps = targetsReps(exercise!.measurement);
      expect([planned.minReps, planned.maxReps].every((it) => it !== null)).toBe(onReps);
      expect([planned.minTarget, planned.maxTarget].every((it) => it !== null)).toBe(!onReps);
    }
  });

  it('names every movement the app measures in something other than reps', () => {
    const nonRep = CATALOG.filter((exercise) => !targetsReps(exercise.measurement));
    expect(nonRep.length).toBeGreaterThan(0);
    for (const exercise of nonRep) {
      expect(CONVERSION_PROMPT).toContain(exercise.id);
      expect(CONVERSION_PROMPT).toContain(exercise.name);
    }
  });

  it("carries the lifter's own non-rep exercises too", () => {
    const mine = {
      id: 'user-1' as never,
      name: 'Weighted Suitcase Hold',
      category: 'core',
      equipment: null,
      measurement: 'duration_weight' as const,
    };
    const prompt = conversionPrompt([...CATALOG, mine]);
    expect(prompt).toContain('Weighted Suitcase Hold');
    expect(prompt).toContain('user-1');
    const repAxis = { ...mine, id: 'user-2' as never, name: 'Zercher Squat', measurement: 'weight_reps' as const };
    expect(conversionPrompt([...CATALOG, repAxis])).not.toContain('Zercher Squat');
  });

  it('states the one-pair rule and the canonical target units', () => {
    const rules = rulesSection();
    expect(rules).toMatch(/never both, never neither/);
    expect(rules).toMatch(/seconds/);
    expect(rules).toMatch(/metres/);
    expect(rules).toMatch(/version` is always 2|always 2/);
  });

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
