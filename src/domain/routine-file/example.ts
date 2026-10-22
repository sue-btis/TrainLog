
export const EXAMPLE_ROUTINE_YAML = `version: 2

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

/** What "Try an example routine" imports: a full week across several measurement types, kept apart from the §12 reference above. */
export const DEMO_ROUTINE_YAML = `version: 2

routine:
  name: "Hybrid Strength - Demo"
  weeks: 4

  workouts:
    - name: "Push - Squat + Press"
      suggested_days: [monday]
      exercises:
        - name: "Front Squat"
          exercise_id: "front-squat"
          unit: "kg"
          sets: 4
          reps: { min: 4, max: 6 }
          rir: { min: 1, max: 2 }
          rest_seconds: 210
          focus: "Strength"
          notes: ["Upright torso", "Stop before technical failure"]
          progression: { type: "double_progression", increment: 2.5 }

        - name: "Overhead Press"
          exercise_id: "overhead-press"
          unit: "kg"
          sets: 3
          reps: { min: 6, max: 8 }
          rir: { min: 1, max: 2 }
          rest_seconds: 150
          progression: { type: "double_progression", increment: 2.5 }

        - name: "Push Up"
          exercise_id: "push-up"
          sets: 3
          reps: { min: 12, max: 20 }
          rir: { min: 1, max: 3 }
          rest_seconds: 90
          progression: { type: "double_progression", increment: 2 }

        - name: "Plank"
          exercise_id: "plank"
          sets: 3
          target: { min: 45, max: 60 }
          rest_seconds: 60
          progression: { type: "double_progression", increment: 5 }

    - name: "Pull - Hinge + Back"
      suggested_days: [wednesday]
      exercises:
        - name: "Romanian Deadlift"
          exercise_id: "romanian-deadlift"
          unit: "kg"
          sets: 3
          reps: { min: 6, max: 8 }
          rir: { min: 1, max: 2 }
          rest_seconds: 180
          progression: { type: "double_progression", increment: 2.5 }

        - name: "Pull Up"
          exercise_id: "pull-up"
          sets: 4
          reps: { min: 5, max: 10 }
          rir: { min: 1, max: 2 }
          rest_seconds: 150
          progression: { type: "double_progression", increment: 1 }

        - name: "Barbell Row"
          exercise_id: "barbell-row"
          unit: "kg"
          sets: 3
          reps: { min: 8, max: 10 }
          rir: { min: 1, max: 2 }
          rest_seconds: 120
          progression: { type: "double_progression", increment: 2.5 }

        - name: "Dead Hang"
          exercise_id: "dead-hang"
          sets: 2
          target: { min: 30, max: 60 }
          rest_seconds: 90
          progression: { type: "manual" }

    - name: "Carry + Core"
      suggested_days: [friday]
      exercises:
        - name: "Farmers Walk"
          exercise_id: "farmers-walk"
          unit: "kg"
          sets: 3
          target: { min: 30, max: 40 }
          rest_seconds: 120
          notes: ["Distance in metres; the load is what progresses"]
          progression: { type: "double_progression", increment: 4 }

        - name: "Assisted Dip"
          exercise_id: "assisted-dip"
          unit: "kg"
          sets: 3
          reps: { min: 8, max: 12 }
          rir: { min: 1, max: 2 }
          rest_seconds: 120
          notes: ["The number is the machine's help: less is better"]
          progression: { type: "double_progression", increment: 5 }

        - name: "Hanging Leg Raise"
          exercise_id: "hanging-leg-raise"
          sets: 3
          reps: { min: 8, max: 12 }
          rir: { min: 1, max: 3 }
          rest_seconds: 90
          progression: { type: "double_progression", increment: 2 }

        - name: "Side Plank"
          exercise_id: "side-plank"
          sets: 2
          target: { min: 30, max: 45 }
          rest_seconds: 60
          progression: { type: "double_progression", increment: 5 }
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
    note: '2, or 1 for older files. A version 1 file means every exercise is weight × reps; version 2 may declare a measurement per exercise. Anything else is refused.',
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
