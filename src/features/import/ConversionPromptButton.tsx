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
import { ICON_STROKE } from '@/features/ui/styles';

/**
 * The prompt handed to an assistant. It mirrors `schema.ts` and `validate.ts`:
 * every rule stated here is one the importer enforces, so a file that follows
 * it parses and passes semantic validation.
 */
export const CONVERSION_PROMPT = `You are converting an EXISTING training routine into the import format of an app called TrainLog.

Your only job is translation. Do not design a programme, do not add or remove exercises, do not "improve" sets, reps, rest or exercise selection. Everything in the output must come from the routine I give you, or from an answer I gave you about it.

## Output format — routine file v1 (YAML)

\`\`\`yaml
version: 1
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
          reps: { min: 4, max: 6 }      # required range; a fixed 8 is { min: 8, max: 8 }
          rir: { min: 1, max: 2 }       # optional, 0-10, min <= max
          rest_seconds: 210             # optional, 0 or more
          focus: "Quadriceps Strength"  # optional
          notes:                        # optional list of short cues
            - "Maintain upright torso"
          progression: { type: "double_progression", increment: 2.5 }
        - name: "Incline Dumbbell Press"
          sets: 3
          reps: { min: 8, max: 12 }
          rest_seconds: 90
          progression: { type: "manual" }
\`\`\`

## Rules

- \`version\` is always 1. Only the keys shown above exist — anything else is dropped, so do not invent fields.
- \`progression\` is required on every exercise. Two types: \`manual\` (I decide the load myself), or \`double_progression\` with an \`increment\` — the weight step in the exercise's unit — for "add weight once you hit the top of the rep range".
- Two workouts must not share a suggested day. Leave \`suggested_days\` empty rather than guessing.
- Rest written as "3 min" becomes \`rest_seconds: 180\`. A rep target of "8-12" becomes \`{ min: 8, max: 12 }\`; "AMRAP" or "max" is not a number — ask me.
- Keep exercise names as the source writes them. Do not translate them into other names.
- The routine must declare at least one workout, and \`routine.name\` must not be blank — an empty routine or an unnamed one is refused until it is fixed.
- \`sets\` must be greater than zero, \`reps.min\` must not exceed \`reps.max\`, \`rir\` must fall between 0 and 10, and \`rest_seconds\` must not be negative.

## Missing information — do not guess

Before writing any YAML, list every field the source routine does not state or states ambiguously (a missing \`weeks\`, no rest times, no progression scheme, "3x8-10" with no RIR, an unclear exercise name, and so on). Then ask me to choose one:

1. You propose a value for each and state the assumption behind it, in a list I can correct.
2. You ask me each question and wait for my answers.

Do not produce the YAML until I have chosen and the gaps are filled. Then output the finished file in a single YAML code block, with nothing after it.

## The routine to convert

[paste your routine here]
`;

export function ConversionPromptButton() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(CONVERSION_PROMPT);
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
          value={CONVERSION_PROMPT}
        />
      )}
    </>
  );
}
