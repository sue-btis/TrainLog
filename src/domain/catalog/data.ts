/**
 * The shipped exercise catalog data (REQ-020, DEC-007).
 *
 * A build-time module: it is imported statically, never fetched, and never
 * written into the `exercises` table. Every slug here is PERMANENT (REQ-023) —
 * stored history references it, so a slug may be added but never renamed or
 * removed.
 *
 * `category` and `equipment` are `string` on the frozen `Exercise` type; the
 * two vocabularies below are internal to this module and exist only to keep the
 * authored rows consistent with each other. They are deliberately not exported
 * into the domain contract.
 */

import type { Measurement } from '@/domain/measurement';

/** Muscle-group vocabulary used by the catalog rows. */
type Category =
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'full-body';

/** Equipment vocabulary used by the catalog rows. */
type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band';

/** `[slug, name, category, equipment, measurement]`. */
type Row = readonly [
  slug: string,
  name: string,
  category: Category,
  equipment: Equipment,
  measurement: Measurement,
];

export const CATALOG_ROWS: readonly Row[] = [
  // ---------------------------------------------------------------- lower body
  ['back-squat', 'Back Squat', 'quadriceps', 'barbell', 'weight_reps'],
  ['front-squat', 'Front Squat', 'quadriceps', 'barbell', 'weight_reps'],
  ['box-squat', 'Box Squat', 'quadriceps', 'barbell', 'weight_reps'],
  ['pause-squat', 'Pause Squat', 'quadriceps', 'barbell', 'weight_reps'],
  ['overhead-squat', 'Overhead Squat', 'quadriceps', 'barbell', 'weight_reps'],
  ['goblet-squat', 'Goblet Squat', 'quadriceps', 'kettlebell', 'weight_reps'],
  ['hack-squat', 'Hack Squat', 'quadriceps', 'machine', 'weight_reps'],
  ['leg-press', 'Leg Press', 'quadriceps', 'machine', 'weight_reps'],
  ['leg-extension', 'Leg Extension', 'quadriceps', 'machine', 'weight_reps'],
  ['barbell-lunge', 'Barbell Lunge', 'quadriceps', 'barbell', 'weight_reps'],
  ['walking-lunge', 'Walking Lunge', 'quadriceps', 'dumbbell', 'weight_reps'],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'quadriceps', 'dumbbell', 'weight_reps'],
  ['step-up', 'Step Up', 'quadriceps', 'dumbbell', 'weight_reps'],
  ['conventional-deadlift', 'Conventional Deadlift', 'hamstrings', 'barbell', 'weight_reps'],
  ['sumo-deadlift', 'Sumo Deadlift', 'hamstrings', 'barbell', 'weight_reps'],
  ['romanian-deadlift', 'Romanian Deadlift', 'hamstrings', 'barbell', 'weight_reps'],
  ['stiff-leg-deadlift', 'Stiff Leg Deadlift', 'hamstrings', 'barbell', 'weight_reps'],
  ['deficit-deadlift', 'Deficit Deadlift', 'hamstrings', 'barbell', 'weight_reps'],
  ['rack-pull', 'Rack Pull', 'back', 'barbell', 'weight_reps'],
  ['good-morning', 'Good Morning', 'hamstrings', 'barbell', 'weight_reps'],
  ['lying-leg-curl', 'Lying Leg Curl', 'hamstrings', 'machine', 'weight_reps'],
  ['seated-leg-curl', 'Seated Leg Curl', 'hamstrings', 'machine', 'weight_reps'],
  ['nordic-curl', 'Nordic Curl', 'hamstrings', 'bodyweight', 'bodyweight_reps'],
  ['glute-ham-raise', 'Glute Ham Raise', 'hamstrings', 'bodyweight', 'bodyweight_reps'],
  ['hip-thrust', 'Hip Thrust', 'glutes', 'barbell', 'weight_reps'],
  ['cable-pull-through', 'Cable Pull Through', 'glutes', 'cable', 'weight_reps'],
  ['hip-abduction', 'Hip Abduction', 'glutes', 'machine', 'weight_reps'],
  ['kettlebell-swing', 'Kettlebell Swing', 'glutes', 'kettlebell', 'weight_reps'],
  ['standing-calf-raise', 'Standing Calf Raise', 'calves', 'machine', 'weight_reps'],
  ['seated-calf-raise', 'Seated Calf Raise', 'calves', 'machine', 'weight_reps'],

  // --------------------------------------------------------------------- chest
  ['bench-press', 'Bench Press', 'chest', 'barbell', 'weight_reps'],
  ['incline-bench-press', 'Incline Bench Press', 'chest', 'barbell', 'weight_reps'],
  ['close-grip-bench-press', 'Close Grip Bench Press', 'triceps', 'barbell', 'weight_reps'],
  ['dumbbell-bench-press', 'Dumbbell Bench Press', 'chest', 'dumbbell', 'weight_reps'],
  ['incline-dumbbell-press', 'Incline Dumbbell Press', 'chest', 'dumbbell', 'weight_reps'],
  ['dumbbell-fly', 'Dumbbell Fly', 'chest', 'dumbbell', 'weight_reps'],
  ['cable-fly', 'Cable Fly', 'chest', 'cable', 'weight_reps'],
  ['machine-chest-press', 'Machine Chest Press', 'chest', 'machine', 'weight_reps'],
  ['pec-deck', 'Pec Deck', 'chest', 'machine', 'weight_reps'],
  ['push-up', 'Push Up', 'chest', 'bodyweight', 'bodyweight_reps'],
  ['dip', 'Dip', 'chest', 'bodyweight', 'bodyweight_reps'],
  ['weighted-dip', 'Weighted Dip', 'chest', 'bodyweight', 'weighted_bodyweight'],

  // ---------------------------------------------------------------------- back
  ['pull-up', 'Pull Up', 'back', 'bodyweight', 'bodyweight_reps'],
  ['weighted-pull-up', 'Weighted Pull Up', 'back', 'bodyweight', 'weighted_bodyweight'],
  ['chin-up', 'Chin Up', 'back', 'bodyweight', 'bodyweight_reps'],
  ['inverted-row', 'Inverted Row', 'back', 'bodyweight', 'bodyweight_reps'],
  ['lat-pulldown', 'Lat Pulldown', 'back', 'cable', 'weight_reps'],
  ['straight-arm-pulldown', 'Straight Arm Pulldown', 'back', 'cable', 'weight_reps'],
  ['seated-cable-row', 'Seated Cable Row', 'back', 'cable', 'weight_reps'],
  ['barbell-row', 'Barbell Row', 'back', 'barbell', 'weight_reps'],
  ['pendlay-row', 'Pendlay Row', 'back', 'barbell', 'weight_reps'],
  ['t-bar-row', 'T Bar Row', 'back', 'barbell', 'weight_reps'],
  ['dumbbell-row', 'Dumbbell Row', 'back', 'dumbbell', 'weight_reps'],
  ['chest-supported-row', 'Chest Supported Row', 'back', 'machine', 'weight_reps'],
  ['machine-row', 'Machine Row', 'back', 'machine', 'weight_reps'],
  ['barbell-shrug', 'Barbell Shrug', 'back', 'barbell', 'weight_reps'],
  ['dumbbell-shrug', 'Dumbbell Shrug', 'back', 'dumbbell', 'weight_reps'],
  ['back-extension', 'Back Extension', 'back', 'bodyweight', 'bodyweight_reps'],

  // ----------------------------------------------------------------- shoulders
  ['overhead-press', 'Overhead Press', 'shoulders', 'barbell', 'weight_reps'],
  ['push-press', 'Push Press', 'shoulders', 'barbell', 'weight_reps'],
  ['seated-dumbbell-press', 'Seated Dumbbell Press', 'shoulders', 'dumbbell', 'weight_reps'],
  ['arnold-press', 'Arnold Press', 'shoulders', 'dumbbell', 'weight_reps'],
  ['machine-shoulder-press', 'Machine Shoulder Press', 'shoulders', 'machine', 'weight_reps'],
  ['lateral-raise', 'Lateral Raise', 'shoulders', 'dumbbell', 'weight_reps'],
  ['cable-lateral-raise', 'Cable Lateral Raise', 'shoulders', 'cable', 'weight_reps'],
  ['rear-delt-fly', 'Rear Delt Fly', 'shoulders', 'dumbbell', 'weight_reps'],
  ['reverse-pec-deck', 'Reverse Pec Deck', 'shoulders', 'machine', 'weight_reps'],
  ['upright-row', 'Upright Row', 'shoulders', 'barbell', 'weight_reps'],
  ['face-pull', 'Face Pull', 'shoulders', 'cable', 'weight_reps'],
  ['band-pull-apart', 'Band Pull Apart', 'shoulders', 'band', 'weight_reps'],

  // ---------------------------------------------------------------------- arms
  ['barbell-curl', 'Barbell Curl', 'biceps', 'barbell', 'weight_reps'],
  ['ez-bar-curl', 'EZ Bar Curl', 'biceps', 'barbell', 'weight_reps'],
  ['dumbbell-curl', 'Dumbbell Curl', 'biceps', 'dumbbell', 'weight_reps'],
  ['incline-dumbbell-curl', 'Incline Dumbbell Curl', 'biceps', 'dumbbell', 'weight_reps'],
  ['hammer-curl', 'Hammer Curl', 'biceps', 'dumbbell', 'weight_reps'],
  ['preacher-curl', 'Preacher Curl', 'biceps', 'barbell', 'weight_reps'],
  ['cable-curl', 'Cable Curl', 'biceps', 'cable', 'weight_reps'],
  ['triceps-pushdown', 'Triceps Pushdown', 'triceps', 'cable', 'weight_reps'],
  ['overhead-triceps-extension', 'Overhead Triceps Extension', 'triceps', 'dumbbell', 'weight_reps'],
  ['skull-crusher', 'Skull Crusher', 'triceps', 'barbell', 'weight_reps'],
  ['triceps-kickback', 'Triceps Kickback', 'triceps', 'dumbbell', 'weight_reps'],
  ['reverse-curl', 'Reverse Curl', 'forearms', 'barbell', 'weight_reps'],
  ['wrist-curl', 'Wrist Curl', 'forearms', 'dumbbell', 'weight_reps'],
  ['farmers-walk', 'Farmers Walk', 'forearms', 'dumbbell', 'weight_distance'],

  // ---------------------------------------------------------------------- core
  ['plank', 'Plank', 'core', 'bodyweight', 'duration'],
  ['hanging-leg-raise', 'Hanging Leg Raise', 'core', 'bodyweight', 'bodyweight_reps'],
  ['ab-wheel-rollout', 'Ab Wheel Rollout', 'core', 'bodyweight', 'bodyweight_reps'],
  ['russian-twist', 'Russian Twist', 'core', 'bodyweight', 'bodyweight_reps'],
  ['cable-crunch', 'Cable Crunch', 'core', 'cable', 'weight_reps'],
  ['pallof-press', 'Pallof Press', 'core', 'cable', 'weight_reps'],

  // ----------------------------------------------------------------- full body
  ['power-clean', 'Power Clean', 'full-body', 'barbell', 'weight_reps'],
  ['hang-clean', 'Hang Clean', 'full-body', 'barbell', 'weight_reps'],
  ['clean-and-jerk', 'Clean And Jerk', 'full-body', 'barbell', 'weight_reps'],
  ['snatch', 'Snatch', 'full-body', 'barbell', 'weight_reps'],
  ['thruster', 'Thruster', 'full-body', 'barbell', 'weight_reps'],
  ['turkish-get-up', 'Turkish Get Up', 'full-body', 'kettlebell', 'weight_reps'],

  // ------------------------------------------------- isometric holds and jumps
  // The three holds are the movements whose *measurement* the rows above cannot
  // declare (REQ-122, DEC-S): `docs/bloque-a-acumulacion.yaml` and
  // `docs/bloque-b-intensificacion.yaml` programme all three in seconds, and
  // before this group existed both had to smuggle the prescription into
  // `notes`. No cardio row: those would be speculative and would name no muscle
  // group (REQ-140, AC-169).
  //
  // Broad Jump sits here for history rather than for its type. It shipped as
  // `distance` on the reading that a jump is one jump, measured in metres; the
  // programmes count jumps instead — a set is three of them, and what is
  // tracked is the reps performed, not the metres of any one. So it is
  // `bodyweight_reps` like every other rep-counted movement, and the `distance`
  // type stays for what is actually run or thrown (DEC-R, revised). The slug is
  // permanent (REQ-023), so the row stays where it is.
  //
  // Categories and equipment are the vocabularies above, unchanged (REQ-140).
  ['planche-lean', 'Planche Lean', 'shoulders', 'bodyweight', 'duration'],
  ['handstand-hold', 'Handstand Hold', 'shoulders', 'bodyweight', 'duration'],
  ['tuck-planche-hold', 'Tuck Planche Hold', 'shoulders', 'bodyweight', 'duration'],
  ['broad-jump', 'Broad Jump', 'quadriceps', 'bodyweight', 'bodyweight_reps'],
];
