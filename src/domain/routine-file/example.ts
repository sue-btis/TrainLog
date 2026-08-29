
export const EXAMPLE_ROUTINE_YAML = `version: 1

routine:
  name: "Hybrid Strength - September"
  weeks: 4

  workouts:
    - name: "Push - Quad + Shoulder Strength"
      suggested_days: [monday, friday]

      exercises:

        - name: "Front Squat"
          exercise_id: "front-squat"
          category: "quadriceps"
          goal: "strength"
          unit: "kg"

          sets: 4

          reps:
            min: 4
            max: 6

          rir:
            min: 1
            max: 2

          rest_seconds: 210

          focus: "Quadriceps Strength"

          notes:
            - "Maintain upright torso"
            - "Avoid technical failure"

          progression:
            type: "double_progression"
            increment: 2.5
`;

/** One row of the field reference the import wizard renders beside the example. */
export interface FieldNote {
  readonly name: string;
  readonly required: boolean;
  readonly note: string;
}

/**
 * What each field means, in the lifter's words rather than the schema's.
 *
 * Deliberately prose, not a generated dump of the Zod shape: the schema knows
 * types, and what someone repairing a file needs to know is which values are
 * allowed and which pairs have to agree.
 */
export const FIELD_NOTES: readonly FieldNote[] = [
  {
    name: 'version',
    required: true,
    note: '1 or 2. A version 1 file means every exercise is weight × reps; version 2 may declare a measurement per exercise. Anything else is refused.',
  },
  { name: 'routine.name', required: true, note: 'What the routine is called.' },
  { name: 'routine.weeks', required: true, note: 'How many weeks the block runs. A whole number, 1 or more.' },
  { name: 'workouts[].name', required: true, note: 'What one training day is called — a Workout carries no date.' },
  {
    name: 'workouts[].suggested_days',
    required: false,
    note: 'Weekday names in lower case: monday … sunday. Two Workouts may not claim the same day.',
  },
  { name: 'exercises[].name', required: true, note: 'The exercise. Matched against the shipped catalog by name.' },
  { name: 'exercises[].exercise_id', required: false, note: 'A catalog slug, when you want to be exact rather than rely on the name.' },
  { name: 'exercises[].category', required: false, note: 'Muscle group, for grouping only.' },
  { name: 'exercises[].unit', required: false, note: 'kg or lb. Fixed per exercise; it is never converted afterwards.' },
  { name: 'exercises[].sets', required: true, note: 'How many sets are planned. 1 or more.' },
  { name: 'exercises[].reps', required: true, note: 'min and max. min may not exceed max.' },
  { name: 'exercises[].rir', required: false, note: 'Reps in reserve — how many you could still have done. min and max, 0 to 10.' },
  { name: 'exercises[].rest_seconds', required: false, note: 'Rest after each set, in seconds. 0 or more.' },
  { name: 'exercises[].focus', required: false, note: 'A free-text note about intent.' },
  { name: 'exercises[].notes', required: false, note: 'A list of cues, shown while you train.' },
  {
    name: 'exercises[].progression',
    required: false,
    note: 'type: manual, or double_progression with an increment — the load added once every planned set reaches max reps.',
  },
];
