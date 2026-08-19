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

/** `[slug, name, category, equipment]`. */
type Row = readonly [slug: string, name: string, category: Category, equipment: Equipment];

export const CATALOG_ROWS: readonly Row[] = [
  // ---------------------------------------------------------------- lower body
  ['back-squat', 'Back Squat', 'quadriceps', 'barbell'],
  ['front-squat', 'Front Squat', 'quadriceps', 'barbell'],
  ['box-squat', 'Box Squat', 'quadriceps', 'barbell'],
  ['pause-squat', 'Pause Squat', 'quadriceps', 'barbell'],
  ['overhead-squat', 'Overhead Squat', 'quadriceps', 'barbell'],
  ['goblet-squat', 'Goblet Squat', 'quadriceps', 'kettlebell'],
  ['hack-squat', 'Hack Squat', 'quadriceps', 'machine'],
  ['leg-press', 'Leg Press', 'quadriceps', 'machine'],
  ['leg-extension', 'Leg Extension', 'quadriceps', 'machine'],
  ['barbell-lunge', 'Barbell Lunge', 'quadriceps', 'barbell'],
  ['walking-lunge', 'Walking Lunge', 'quadriceps', 'dumbbell'],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'quadriceps', 'dumbbell'],
  ['step-up', 'Step Up', 'quadriceps', 'dumbbell'],
  ['conventional-deadlift', 'Conventional Deadlift', 'hamstrings', 'barbell'],
  ['sumo-deadlift', 'Sumo Deadlift', 'hamstrings', 'barbell'],
  ['romanian-deadlift', 'Romanian Deadlift', 'hamstrings', 'barbell'],
  ['stiff-leg-deadlift', 'Stiff Leg Deadlift', 'hamstrings', 'barbell'],
  ['deficit-deadlift', 'Deficit Deadlift', 'hamstrings', 'barbell'],
  ['rack-pull', 'Rack Pull', 'back', 'barbell'],
  ['good-morning', 'Good Morning', 'hamstrings', 'barbell'],
  ['lying-leg-curl', 'Lying Leg Curl', 'hamstrings', 'machine'],
  ['seated-leg-curl', 'Seated Leg Curl', 'hamstrings', 'machine'],
  ['nordic-curl', 'Nordic Curl', 'hamstrings', 'bodyweight'],
  ['glute-ham-raise', 'Glute Ham Raise', 'hamstrings', 'bodyweight'],
  ['hip-thrust', 'Hip Thrust', 'glutes', 'barbell'],
  ['cable-pull-through', 'Cable Pull Through', 'glutes', 'cable'],
  ['hip-abduction', 'Hip Abduction', 'glutes', 'machine'],
  ['kettlebell-swing', 'Kettlebell Swing', 'glutes', 'kettlebell'],
  ['standing-calf-raise', 'Standing Calf Raise', 'calves', 'machine'],
  ['seated-calf-raise', 'Seated Calf Raise', 'calves', 'machine'],

  // --------------------------------------------------------------------- chest
  ['bench-press', 'Bench Press', 'chest', 'barbell'],
  ['incline-bench-press', 'Incline Bench Press', 'chest', 'barbell'],
  ['close-grip-bench-press', 'Close Grip Bench Press', 'triceps', 'barbell'],
  ['dumbbell-bench-press', 'Dumbbell Bench Press', 'chest', 'dumbbell'],
  ['incline-dumbbell-press', 'Incline Dumbbell Press', 'chest', 'dumbbell'],
  ['dumbbell-fly', 'Dumbbell Fly', 'chest', 'dumbbell'],
  ['cable-fly', 'Cable Fly', 'chest', 'cable'],
  ['machine-chest-press', 'Machine Chest Press', 'chest', 'machine'],
  ['pec-deck', 'Pec Deck', 'chest', 'machine'],
  ['push-up', 'Push Up', 'chest', 'bodyweight'],
  ['dip', 'Dip', 'chest', 'bodyweight'],
  ['weighted-dip', 'Weighted Dip', 'chest', 'bodyweight'],

  // ---------------------------------------------------------------------- back
  ['pull-up', 'Pull Up', 'back', 'bodyweight'],
  ['weighted-pull-up', 'Weighted Pull Up', 'back', 'bodyweight'],
  ['chin-up', 'Chin Up', 'back', 'bodyweight'],
  ['inverted-row', 'Inverted Row', 'back', 'bodyweight'],
  ['lat-pulldown', 'Lat Pulldown', 'back', 'cable'],
  ['straight-arm-pulldown', 'Straight Arm Pulldown', 'back', 'cable'],
  ['seated-cable-row', 'Seated Cable Row', 'back', 'cable'],
  ['barbell-row', 'Barbell Row', 'back', 'barbell'],
  ['pendlay-row', 'Pendlay Row', 'back', 'barbell'],
  ['t-bar-row', 'T Bar Row', 'back', 'barbell'],
  ['dumbbell-row', 'Dumbbell Row', 'back', 'dumbbell'],
  ['chest-supported-row', 'Chest Supported Row', 'back', 'machine'],
  ['machine-row', 'Machine Row', 'back', 'machine'],
  ['barbell-shrug', 'Barbell Shrug', 'back', 'barbell'],
  ['dumbbell-shrug', 'Dumbbell Shrug', 'back', 'dumbbell'],
  ['back-extension', 'Back Extension', 'back', 'bodyweight'],

  // ----------------------------------------------------------------- shoulders
  ['overhead-press', 'Overhead Press', 'shoulders', 'barbell'],
  ['push-press', 'Push Press', 'shoulders', 'barbell'],
  ['seated-dumbbell-press', 'Seated Dumbbell Press', 'shoulders', 'dumbbell'],
  ['arnold-press', 'Arnold Press', 'shoulders', 'dumbbell'],
  ['machine-shoulder-press', 'Machine Shoulder Press', 'shoulders', 'machine'],
  ['lateral-raise', 'Lateral Raise', 'shoulders', 'dumbbell'],
  ['cable-lateral-raise', 'Cable Lateral Raise', 'shoulders', 'cable'],
  ['rear-delt-fly', 'Rear Delt Fly', 'shoulders', 'dumbbell'],
  ['reverse-pec-deck', 'Reverse Pec Deck', 'shoulders', 'machine'],
  ['upright-row', 'Upright Row', 'shoulders', 'barbell'],
  ['face-pull', 'Face Pull', 'shoulders', 'cable'],
  ['band-pull-apart', 'Band Pull Apart', 'shoulders', 'band'],

  // ---------------------------------------------------------------------- arms
  ['barbell-curl', 'Barbell Curl', 'biceps', 'barbell'],
  ['ez-bar-curl', 'EZ Bar Curl', 'biceps', 'barbell'],
  ['dumbbell-curl', 'Dumbbell Curl', 'biceps', 'dumbbell'],
  ['incline-dumbbell-curl', 'Incline Dumbbell Curl', 'biceps', 'dumbbell'],
  ['hammer-curl', 'Hammer Curl', 'biceps', 'dumbbell'],
  ['preacher-curl', 'Preacher Curl', 'biceps', 'barbell'],
  ['cable-curl', 'Cable Curl', 'biceps', 'cable'],
  ['triceps-pushdown', 'Triceps Pushdown', 'triceps', 'cable'],
  ['overhead-triceps-extension', 'Overhead Triceps Extension', 'triceps', 'dumbbell'],
  ['skull-crusher', 'Skull Crusher', 'triceps', 'barbell'],
  ['triceps-kickback', 'Triceps Kickback', 'triceps', 'dumbbell'],
  ['reverse-curl', 'Reverse Curl', 'forearms', 'barbell'],
  ['wrist-curl', 'Wrist Curl', 'forearms', 'dumbbell'],
  ['farmers-walk', 'Farmers Walk', 'forearms', 'dumbbell'],

  // ---------------------------------------------------------------------- core
  ['plank', 'Plank', 'core', 'bodyweight'],
  ['hanging-leg-raise', 'Hanging Leg Raise', 'core', 'bodyweight'],
  ['ab-wheel-rollout', 'Ab Wheel Rollout', 'core', 'bodyweight'],
  ['russian-twist', 'Russian Twist', 'core', 'bodyweight'],
  ['cable-crunch', 'Cable Crunch', 'core', 'cable'],
  ['pallof-press', 'Pallof Press', 'core', 'cable'],

  // ----------------------------------------------------------------- full body
  ['power-clean', 'Power Clean', 'full-body', 'barbell'],
  ['hang-clean', 'Hang Clean', 'full-body', 'barbell'],
  ['clean-and-jerk', 'Clean And Jerk', 'full-body', 'barbell'],
  ['snatch', 'Snatch', 'full-body', 'barbell'],
  ['thruster', 'Thruster', 'full-body', 'barbell'],
  ['turkish-get-up', 'Turkish Get Up', 'full-body', 'kettlebell'],
];
