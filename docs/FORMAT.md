# The routine file format

A TrainLog programme is one YAML file. The app imports it, lets you review it,
and runs it. This guide describes what the importer accepts.

**The code is the authority.** This document is derived from the parser in
[`src/domain/routine-file/schema.ts`](../src/domain/routine-file/schema.ts), the
checks in [`validate.ts`](../src/domain/routine-file/validate.ts) and the
measurement table in [`src/domain/measurement.ts`](../src/domain/measurement.ts).
Every `yaml` block below is parsed and validated by a test
(`src/domain/routine-file/format-doc.test.ts`), so the examples cannot drift from
what the importer does. Where this guide and the code disagree, the code wins and
this guide has a bug.

## A complete file

```yaml
version: 2

routine:
  name: "Upper / Lower - Block 1"
  weeks: 4

  workouts:
    - name: "Upper A"
      suggested_days: [monday]
      exercises:
        - name: "Dumbbell Bench Press"
          exercise_id: "dumbbell-bench-press"
          unit: "kg"
          sets: 3
          reps: { min: 8, max: 12 }
          rir: { min: 1, max: 2 }
          rest_seconds: 120
          focus: "Main chest lift"
          notes:
            - "Controlled descent, no bounce"
          progression: { type: "double_progression", increment: 2 }

        - name: "Planche Lean"
          exercise_id: "planche-lean"
          sets: 3
          target: { min: 15, max: 30 }
          rest_seconds: 90
          progression: { type: "double_progression", increment: 5 }

    - name: "Lower A"
      suggested_days: [tuesday]
      exercises:
        - name: "Box Jump"
          category: "quadriceps"
          measurement: "bodyweight_reps"
          sets: 3
          reps: { min: 3, max: 3 }
          rest_seconds: 120
          progression: { type: "manual" }
```

## Structure

```text
version
routine
  ├── name
  ├── weeks
  └── workouts            (ordered list — the order is the rotation)
        ├── name
        ├── suggested_days
        └── exercises     (ordered list)
```

A **Workout** is a reusable training day. It carries no date: the import wizard
turns `suggested_days` into Placements on the calendar, and you can move or
delete those afterwards (see [CONTEXT.md](../CONTEXT.md) for the vocabulary).

### Top level

| Field | Required | Value |
| --- | --- | --- |
| `version` | yes | `2`, or `1` for older files. Any other value is refused. Both are read by the same rules; see *Version 1 files*. |
| `routine.name` | yes | Text. A blank name blocks Accept. |
| `routine.weeks` | yes | A number: how many weeks the block runs. The importer checks only that it is a number. |
| `routine.workouts` | yes | A list. An empty list blocks Accept. |

### Workout

| Field | Required | Value |
| --- | --- | --- |
| `name` | yes | Text. |
| `suggested_days` | no | Lower-case weekdays: `monday` … `sunday`. Defaults to none. Two Workouts suggesting the same day block Accept. |
| `exercises` | yes | A list. An empty list is allowed: an empty Workout still runs. |

### Exercise

| Field | Required | Value |
| --- | --- | --- |
| `name` | yes | Text. Used to find the exercise when there is no `exercise_id` (see *How an exercise is found*). |
| `exercise_id` | no | A slug from the built-in catalog, such as `front-squat`. Exact, and immune to renaming. |
| `category` | no | Muscle group, for grouping. Only used when the import creates the exercise; a catalog exercise keeps its own. Weekly volume counts only categories the catalog uses (`quadriceps`, `hamstrings`, `glutes`, `calves`, `chest`, `back`, `shoulders`, `biceps`, `triceps`, `forearms`, `core`, `full-body`); anything else is listed apart. |
| `measurement` | no | One of the nine types below. Only used when the import creates the exercise, and defaults to `weight_reps` there. |
| `unit` | no | `kg` or `lb`: the unit a new set opens on. Defaults to the app's default unit setting. |
| `sets` | yes | Number of planned sets. Must be greater than zero. |
| `reps` | one of | `{ min, max }` — the range for a type scored in repetitions. |
| `target` | one of | `{ min, max }` — the range for a type scored in seconds or metres. |
| `rir` | no | `{ min, max }`, reps in reserve, each from 0 to 10. |
| `rest_seconds` | no | Rest after each set, in seconds. Must not be negative. |
| `focus` | no | Free text about intent, shown while training. |
| `notes` | no | A list of cues, shown while training. Defaults to none. |
| `progression` | yes | `{ type: "manual" }`, or `{ type: "double_progression", increment: <number> }`. `double_progression` without an increment is refused. |

Every exercise states **exactly one** of `reps` or `target`, and which one is
decided by its measurement. `min` may not exceed `max` in either.

## The nine measurements

A measurement says which values a set records, which range the plan states, and
which value counts as progress. It belongs to the exercise, not to the file row.

| `measurement` | A set records | Plan states | Progress is read on | Better is |
| --- | --- | --- | --- | --- |
| `weight_reps` | weight, reps | `reps` | load | heavier |
| `bodyweight_reps` | reps | `reps` | reps | more |
| `weighted_bodyweight` | added weight, reps | `reps` | load (the added weight) | heavier |
| `assisted_bodyweight` | assistance, reps | `reps` | load (the assistance) | **less** |
| `duration` | seconds | `target` in seconds | seconds | longer |
| `duration_weight` | seconds, weight | `target` in seconds | load | heavier |
| `distance_duration` | distance, seconds | `target` in metres | pace (seconds per metre) | **faster** |
| `weight_distance` | weight, distance | `target` in metres | load | heavier |
| `distance` | distance | `target` in metres | distance | farther |

Targets are canonical: seconds are written as seconds (`90`, not `1:30`), and
distances as metres (`5000` for 5 km). The unit you pick on screen while logging
a set is separate and does not change the plan.

One example of each, as one Workout:

```yaml
version: 2

routine:
  name: "Every measurement"
  weeks: 1

  workouts:
    - name: "Sampler"
      exercises:
        - name: "Front Squat"
          exercise_id: "front-squat"
          unit: "kg"
          sets: 3
          reps: { min: 4, max: 6 }
          progression: { type: "double_progression", increment: 2.5 }

        - name: "Push Up"
          exercise_id: "push-up"
          sets: 3
          reps: { min: 10, max: 15 }
          progression: { type: "double_progression", increment: 2 }

        - name: "Weighted Pull Up"
          exercise_id: "weighted-pull-up"
          unit: "kg"
          sets: 3
          reps: { min: 5, max: 8 }
          progression: { type: "double_progression", increment: 2.5 }

        - name: "Assisted Dip"
          exercise_id: "assisted-dip"
          unit: "kg"
          sets: 3
          reps: { min: 6, max: 10 }
          progression: { type: "double_progression", increment: 5 }

        - name: "Plank"
          exercise_id: "plank"
          sets: 3
          target: { min: 45, max: 60 }
          progression: { type: "double_progression", increment: 5 }

        - name: "Loaded Wall Sit"
          category: "quadriceps"
          measurement: "duration_weight"
          unit: "kg"
          sets: 3
          target: { min: 30, max: 45 }
          progression: { type: "double_progression", increment: 5 }

        - name: "Easy Run"
          category: "full-body"
          measurement: "distance_duration"
          sets: 1
          target: { min: 5000, max: 5000 }
          progression: { type: "manual" }

        - name: "Farmers Walk"
          exercise_id: "farmers-walk"
          unit: "kg"
          sets: 3
          target: { min: 30, max: 40 }
          progression: { type: "double_progression", increment: 4 }

        - name: "Medicine Ball Throw"
          category: "full-body"
          measurement: "distance"
          sets: 4
          target: { min: 8, max: 12 }
          progression: { type: "manual" }
```

## How an exercise is found

Each row is bound to one Exercise, in this order:

1. `exercise_id` set and found in the built-in catalog → that catalog exercise.
2. Otherwise, by name, compared trimmed, lower-cased and with spaces collapsed
   (`"  front   SQUAT "` matches `Front Squat`):
   1. a catalog exercise with that name;
   2. one of your own exercises currently called that;
   3. one of your own exercises that **used** to be called that, before you
      renamed it in the app.
3. No match → the import creates a new exercise of your own, using the row's
   `measurement` (default `weight_reps`) and `category`.

History follows the Exercise, not the file. Re-importing a corrected file, or a
new block that names the same exercises, continues the same history. A row that
resolves to an existing exercise keeps that exercise's measurement and category;
the row cannot rewrite them.

Renaming a row in the YAML without an `exercise_id` creates a new exercise and
starts a separate history. Use `exercise_id` for catalog exercises, or rename
your own exercise in the app, where the old name keeps matching.

## Validation

Two tiers behave differently.

**Structural** — the file is refused, with the field named. This covers
malformed YAML, an unknown `version`, a missing required field, a value of the
wrong type, an unknown `measurement` or weekday, and `double_progression`
without `increment`.

**Semantic** — the file loads into the wizard's review step with the problem
marked, and Accept stays blocked until it is fixed there:

| Code | Raised when |
| --- | --- |
| `routine_name_blank` | the routine name is blank |
| `routine_has_no_workouts` | the routine declares no Workouts |
| `reps_range_inverted` | `reps.min` is greater than `reps.max` |
| `target_range_inverted` | `target.min` is greater than `target.max` |
| `target_pair_ambiguous` | both `reps` and `target` are given |
| `target_pair_missing` | neither `reps` nor `target` is given |
| `target_axis_mismatch` | the range is on the wrong axis for the exercise it resolves to — `reps` for an exercise measured in seconds or metres, or `target` for one counted in reps |
| `rir_out_of_range` | an RIR value is below 0 or above 10 |
| `rest_seconds_negative` | `rest_seconds` is negative |
| `sets_not_positive` | `sets` is zero or less |
| `progression_unrecognized` | `progression.type` is neither `manual` nor `double_progression` |
| `suggested_day_shared` | two Workouts suggest the same weekday |

## Progression

Progression is computed from what you logged, never stored, and only from a
finished Session (or a partial one in which that exercise was fully performed).

- **`manual`** — the app suggests repeating what you did last time.
- **`double_progression`** — the app looks at the first `sets` sets of the last
  eligible Session, using that Session's own plan. If every one reached the top
  of the range (`reps.max` or `target.max`), it advances by `increment`;
  otherwise it repeats.
  - On a type whose progress is load, the advance is the increment in the
    exercise's unit — or, for `assisted_bodyweight`, the assistance goes **down**
    by it, never below zero.
  - On a type with no load, the advance is on the value itself: more reps, more
    seconds, more metres, or for `distance_duration` a faster pace (the increment
    is subtracted from seconds per metre, never below zero).

Exercises added during a session, outside the plan, get no suggestion.

## Version 1 files

`version: 1` files still import, and the importer reads them by exactly the same
rules as version 2 — the number only has to be 1 or 2. Version 2 is the version
that introduced `measurement` and `target`; a file written for version 1 uses
neither, so every exercise it creates is `weight_reps` and every row states
`reps`.

```yaml
version: 1

routine:
  name: "Version 1 example"
  weeks: 4
  workouts:
    - name: "Full Body"
      suggested_days: [monday, thursday]
      exercises:
        - name: "Back Squat"
          exercise_id: "back-squat"
          unit: "kg"
          sets: 3
          reps: { min: 5, max: 5 }
          progression: { type: "double_progression", increment: 2.5 }
```

## More examples

- [`docs/examples/routine.yaml`](./examples/routine.yaml) and
  [`docs/examples/hibrido-v2.yaml`](./examples/hibrido-v2.yaml) — commented
  examples (comments in Spanish).
- [`docs/examples/bloque-a-acumulacion.yaml`](./examples/bloque-a-acumulacion.yaml),
  [`bloque-b-intensificacion.yaml`](./examples/bloque-b-intensificacion.yaml) and
  [`bloque-c-estetica-hibrida.yaml`](./examples/bloque-c-estetica-hibrida.yaml) — real
  training blocks, including HIIT written as a Workout.
