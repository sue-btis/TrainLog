# TrainLog

An offline-first training PWA. A structured file declares the training programme;
the app executes it, records what actually happened, and derives progression from
that record.

## Language

### Programming

**Routine**:
A complete training programme, imported from a single file or authored in the
wizard without one. Once accepted it takes **additions** only — a Workout, or a
Planned Exercise inside one, and only while it is active. Nothing stored is
renamed, reordered, retargeted or removed.
_Avoid_: Program, plan, cycle

**Routine Draft**:
The editable Routine held in the wizard before Accept. It is a file being shaped,
not a Routine: nothing about it is stored, a reload discards it, and every verb
that corrects a programme acts on this and never on what is already accepted.
_Avoid_: Draft routine, pending routine, unsaved routine

**Workout**:
A named, reusable unit of programming within a Routine — the exercises and targets
for one training session. Carries no date.
_Avoid_: Day, RoutineDay, split, template

**Suggested Day**:
A weekday a Workout is authored to fall on. Advisory only: read when the Workout
enters a Routine — at import, or when one is added to a Routine already running —
to seed Placements, and never consulted again afterwards. It is not the schedule;
the Placements it generated are, and they are the lifter's to move.
_Avoid_: Scheduled day, assigned day

**Planned Exercise**:
One exercise as programmed inside a Workout — sets, rep range, RIR range, rest and
progression rule.
_Avoid_: Prescription, target exercise

**Progression Rule**:
The rule attached to a Planned Exercise that determines how load advances.
_Avoid_: Progression strategy, scheme

**Exercise**:
The movement itself, independent of any Routine. The unit that history and
progression are tracked against.
_Avoid_: Lift, movement, activity

**Catalog**:
The set of base Exercises shipped with the app.
_Avoid_: Library, database, presets

### Scheduling

**Placement**:
A user-owned assignment of one Workout to one concrete date. Freely movable and
deletable. The only source of truth about when training is intended.
_Avoid_: Schedule entry, appointment, booking, scheduled workout

**Missed**:
A Placement whose date has passed with no Session recorded against it. Derived,
never stored.
_Avoid_: Skipped, failed, incomplete

### Execution

**Session**:
One performed training session, produced by starting a Workout.
_Avoid_: WorkoutSession, training, entry, log

**Exercise Session**:
One exercise as performed within a Session. May stand behind a Planned Exercise or
be unplanned.
_Avoid_: Exercise log, exercise entry

**Completed Set**:
The atomic unit of history: weight, reps and RIR for one performed set.
_Avoid_: Rep set, entry, record

**Snapshot**:
The copy of a Planned Exercise's targets taken into an Exercise Session when it
starts, so history stays true regardless of later template changes.
_Avoid_: Frozen plan, cached target

**Deviation**:
Any difference between what a Session's Workout planned and what was performed —
set count, skipped exercises, substitutions, unplanned exercises.
_Avoid_: Deviation error, non-compliance, miss

**Unplanned Exercise**:
An Exercise Session with no Planned Exercise behind it. Substitution is expressed
as a skipped Planned Exercise plus an Unplanned Exercise.
_Avoid_: Extra, ad-hoc exercise, freestyle

### Measurement

**Unit**:
The weight unit an Exercise is logged in, kg or lb, fixed per Exercise. Every
recorded weight also carries a derived kilogram value used for all comparison,
charting and progression.
_Avoid_: Measure, scale

### Preferences

**Settings**:
The single row of device preferences (§32): default unit, default RIR, timer
vibration, timer sound, keep screen awake. Every field is a *default* — the
value used when nothing more specific is known — and none of them acts on
stored training: changing the unit converts no logged set. Settings belong to
the phone, not to the training, which is why a backup carries them and a restore
leaves them alone. There is no theme setting.
_Avoid_: Preferences, config, options
