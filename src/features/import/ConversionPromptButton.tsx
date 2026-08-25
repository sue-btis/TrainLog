/**
 * The other half of `Import routine` (§11.1): getting a routine that lives
 * somewhere else into the file the wizard reads.
 *
 * Most routines arrive as a PDF, a spreadsheet or a coach's message, and the
 * lifter has an assistant to hand. What they lack is the format. This copies a
 * prompt that carries the format and one instruction above all others — adapt,
 * never invent — so the assistant translates the routine instead of writing a
 * new one, and asks about anything the source does not say rather than filling
 * it in quietly.
 *
 * The prompt is a plain string, not a file to fetch: the app makes no network
 * requests at runtime, and this way it is in the bundle the same as the
 * catalog is.
 */

import { useState } from 'react';
import { ClipboardCheck, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CATALOG } from '@/domain/catalog';
import { targetUnitOf, targetsReps } from '@/domain/measurement';
import type { Exercise } from '@/domain/types';
import { useUserExercises } from '@/features/data/queries';
import { ICON_STROKE } from '@/features/ui/styles';

/**
 * The movements this app already measures in something other than repetitions.
 *
 * Only these need calling out. A movement on the rep axis takes `reps` and an
 * assistant that guesses its type wrong costs nothing; one measured in seconds
 * or metres takes `target` instead, and a rep range on it produces a planned
 * exercise with no range at all — a row the backup validator later refuses.
 * Six of the catalog's hundred rows are in this list, plus whatever the lifter
 * has created, so naming them is cheap and naming all hundred would not be.
 */
function nonRepMovements(exercises: readonly Exercise[]): string {
  const rows = exercises
    .filter((exercise) => !targetsReps(exercise.measurement))
    .map(
      (exercise) =>
        `| ${exercise.name} | \`${exercise.id}\` | ${targetUnitOf(exercise.measurement)} |`,
    );

  if (rows.length === 0) return 'This app knows no movement measured in anything but repetitions.';

  return [
    'These movements are already known to the app and are **not** measured in repetitions.',
    'If the routine contains one, use its `exercise_id` exactly as written here and give it a',
    '`target` instead of `reps`. Do not declare a `measurement` for them — the app already knows.',
    '',
    '| Movement | exercise_id | target is in |',
    '| --- | --- | --- |',
    ...rows,
  ].join('\n');
}

/**
 * The prompt handed to an assistant. It mirrors `schema.ts` and `validate.ts`:
 * every rule stated here is one the importer enforces, so a file that follows
 * it parses and passes semantic validation.
 *
 * A function rather than a constant because it names the lifter's own
 * exercises: an assistant that does not know a movement is measured in seconds
 * writes a rep range for it, and the file is broken before it is read.
 */
export function conversionPrompt(exercises: readonly Exercise[]): string {
  return `You are converting an EXISTING training routine into the import format of an app called TrainLog.

Your only job is translation. Do not design a programme, do not add or remove exercises, do not "improve" sets, reps, rest or exercise selection. Everything in the output must come from the routine I give you, or from an answer I gave you about it.

## Output format — routine file v2 (YAML)

\`\`\`yaml
version: 2
routine:
  name: "Hybrid Strength - September"   # the routine's name
  weeks: 4                              # how many weeks it runs
  workouts:
    - name: "Push - Quad + Shoulder"
      suggested_days: [monday, friday]  # lowercase weekday names, may be empty
      exercises:
        - name: "Front Squat"           # required
          exercise_id: "front-squat"    # optional; omit unless you are sure
          category: "quadriceps"        # optional
          unit: "kg"                    # optional, "kg" or "lb"
          sets: 4                       # required, positive whole number
          reps: { min: 4, max: 6 }      # a fixed 8 is { min: 8, max: 8 }
          rir: { min: 1, max: 2 }       # optional, 0-10, min <= max
          rest_seconds: 210             # optional, 0 or more
          focus: "Quadriceps Strength"  # optional
          notes:                        # optional list of short cues
            - "Maintain upright torso"
          progression: { type: "double_progression", increment: 2.5 }
        - name: "Plank"
          exercise_id: "plank"
          sets: 3
          target: { min: 45, max: 45 }  # SECONDS, not reps — a plank is timed
          rest_seconds: 60
          progression: { type: "manual" }
        - name: "Incline Dumbbell Press"
          sets: 3
          reps: { min: 8, max: 12 }
          rest_seconds: 90
          progression: { type: "manual" }
\`\`\`

## Rules

- \`version\` is always 2. Only the keys shown above exist — anything else is dropped, so do not invent fields.
- **Every exercise states its range in exactly one place: \`reps\` or \`target\`. Never both, never neither.** \`reps\` for a movement counted in repetitions; \`target\` for one measured in time or distance. Getting this wrong is the one mistake the app cannot repair for me later.
- \`target\` is always canonical: **seconds** for anything timed, **metres** for anything covering distance. A 45-second hold is \`{ min: 45, max: 45 }\`. A 5 km run is \`{ min: 5000, max: 5000 }\`. Never write \`45s\` or \`5km\`.
- \`measurement\` is optional and only needed for a movement this app does not already know. Its values are \`weight_reps\` (barbell work — the default), \`bodyweight_reps\`, \`weighted_bodyweight\` (weight added to you), \`assisted_bodyweight\` (weight taken off you), \`duration\` (a hold), \`duration_weight\` (a loaded hold), \`distance\`, \`distance_duration\` (a run), \`weight_distance\` (a carry). Omit it and the movement is treated as \`weight_reps\`.
- \`progression\` is required on every exercise. Two types: \`manual\` (I decide the load myself), or \`double_progression\` with an \`increment\` for "advance once you hit the top of the range". On a movement with a load the increment is weight; on one without, it advances the range itself.
- Two workouts must not share a suggested day. Leave \`suggested_days\` empty rather than guessing.
- Rest written as "3 min" becomes \`rest_seconds: 180\`. A rep target of "8-12" becomes \`{ min: 8, max: 12 }\`; "AMRAP" or "max" is not a number — ask me.
- Keep exercise names as the source writes them. Do not translate them into other names.
- The routine must declare at least one workout, and \`routine.name\` must not be blank — an empty routine or an unnamed one is refused until it is fixed.
- \`sets\` must be greater than zero, \`reps.min\` must not exceed \`reps.max\`, \`rir\` must fall between 0 and 10, and \`rest_seconds\` must not be negative.

## Movements measured in something other than repetitions

${nonRepMovements(exercises)}

A hold whose prescription the source writes as "3 x 20-40 s" is \`sets: 3\` with \`target: { min: 20, max: 40 }\` — the seconds are the target, not a note beside it. Do not write \`reps: { min: 1, max: 1 }\` for a hold; that was the old format's workaround and this format does not need it.

## Missing information — do not guess

Before writing any YAML, list every field the source routine does not state or states ambiguously (a missing \`weeks\`, no rest times, no progression scheme, "3x8-10" with no RIR, an unclear exercise name, a hold with no duration, and so on). Then ask me to choose one:

1. You propose a value for each and state the assumption behind it, in a list I can correct.
2. You ask me each question and wait for my answers.

Do not produce the YAML until I have chosen and the gaps are filled. Then output the finished file in a single YAML code block, with nothing after it.

## The routine to convert

[paste your routine here]
`;
}

export function ConversionPromptButton() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  // The catalog ships in the build and the table holds the lifter's own, so the
  // two are disjoint and concatenate (DEC-007). `undefined` is the read still in
  // flight; the catalog alone is already a useful prompt, so it does not wait.
  const user = useUserExercises();
  const prompt = conversionPrompt([...CATALOG, ...(user ?? [])]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      // Clipboard access can be refused outright; the prompt is still the
      // point, so hand it over as text the lifter can select instead.
      setState('failed');
    }
  }

  return (
    <>
      <Button onClick={() => void copy()} size="block" type="button" variant="secondary">
        {state === 'copied' ? (
          <ClipboardCheck aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        ) : (
          <ClipboardCopy aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        )}
        {state === 'copied' ? 'Prompt copied' : 'Copy conversion prompt'}
      </Button>

      {state === 'failed' && (
        <textarea
          aria-label="Conversion prompt"
          className="h-64 w-full rounded-control bg-card p-3 font-mono type-body-sm text-ink-2"
          readOnly
          value={prompt}
        />
      )}
    </>
  );
}
