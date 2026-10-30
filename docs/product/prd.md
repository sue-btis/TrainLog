# PRD — TrainLog

This PRD describes the product as it is built today (a retroactive baseline). The
glossary in [CONTEXT.md](../../CONTEXT.md) is binding on every term used here. The
routine file contract is [docs/FORMAT.md](../FORMAT.md).

## 1. Product Overview

### Product

TrainLog is an installable web app, mobile-first and offline-first. A lifter
declares a training programme in a structured file, or authors one in the app. The
app runs that programme at the gym, records what was actually performed, and works
out the next target from that record.

### Problem / Purpose

A lifter on structured programming needs three things at the moment of training:
what today prescribes, what they did last time, and what load comes next. Gyms
often have no reliable connectivity. General-purpose notes and spreadsheets lose
the link between the plan and the performance, and they leave the progression
maths to the lifter.

### Product Philosophy

- **Planned and actual are different things.** What was programmed is never
  rewritten to represent what was performed.
- **The file describes the programme; the app executes it.**
- **Offline is the normal case, not the exception.**
- **The data belongs to the lifter** and stays portable.
- **Progression is deterministic** and can be explained in one sentence.

## 2. Target Users and Usage Context

### Primary User

The author. They train from structured programming with weight, reps and RIR,
revise their own routines periodically, and decide today's load from what they did
last time.

### Secondary Users

Lifters the author knows personally. There is no self-serve public audience. The
app must be self-explanatory to someone already comfortable with programmed
training. It needs no onboarding for strangers and no marketing surface.

### Usage Context

- At the gym, on a phone, using the installed app with one hand between sets.
- Connectivity is assumed absent.
- A single person on a single device. There are no shared or multi-device scenarios.

## 3. Goals

- G-001 — Run a whole training block with no network, no unrecorded set and no
  manual load maths.
- G-002 — Show the previous performance and a suggested target before each exercise.
- G-003 — Keep the history of an Exercise intact across routines and across
  corrected re-imports.
- G-004 — Let the lifter take all of their data off the device, and put it back, at
  any time.
- G-005 — Require no infrastructure, account or recurring cost to use the product.

## 4. Non-Goals

- NG-001 — Accounts, login, cloud sync or multi-device sync.
- NG-002 — Social features, publishing workouts, or multiple users per device.
- NG-003 — Nutrition, calorie tracking, wearables, or health-platform integrations.
- NG-004 — AI coaching or automatic routine generation.
- NG-005 — Payments, subscriptions, or gym management.
- NG-006 — Telemetry or analytics of any kind.
- NG-007 — Rest-timer notifications while the app is in the background.
- NG-008 — Merging a backup into existing data. Restore replaces.
- NG-009 — A theme or dark-mode setting.
- NG-010 — Editing an accepted Routine destructively (rename, reorder, retarget or
  remove what is stored).

## 5. Core User Journeys

### J-001 — Import a routine and start the block

1. The lifter picks a routine file, or starts from scratch.
2. The file is read. A structurally invalid file is rejected with a message.
3. The lifter reviews and corrects the exercises in the wizard.
4. The lifter reviews the suggested days, the number of weeks and the start date.
5. The lifter accepts. The Routine becomes active and its Placements appear in the
   calendar.

### J-002 — Train today's workout

1. Today shows the Workout planned for today, or the next one in rotation.
2. The lifter starts it. Each exercise shows its targets, the previous performance
   and a suggested load.
3. The lifter logs each set. The rest timer runs from the moment the set was logged.
4. The lifter skips, reorders, adds or substitutes exercises as needed. Nothing
   blocks them.
5. The lifter finishes. The Session is stored as completed or partial.

### J-003 — Resume after an interruption

1. The app is closed, the phone is locked, or the browser restarts mid-session.
2. On reopening, Today offers to resume the open Session.
3. Every set logged so far is there, and the rest timer shows the correct
   remaining time.

### J-004 — Review progress

1. The lifter opens Progress, picks a trained exercise and switches metrics.
2. The lifter opens an exercise's history, or a past Session's detail.
3. The lifter checks this week's sets per muscle, planned against logged.

### J-005 — Move to a new phone

1. On the old device, the lifter exports a backup, optionally encrypted with a
   password.
2. On the new device, the lifter installs the app and restores that backup.
3. All of their training is present.

## 6. Product Capabilities

### CAP-001 — Routine import and authoring

A two-step wizard turns a routine file, or a blank draft, into a Routine. Errors
that the lifter can correct are fixed inside the wizard. Nothing is stored until
Accept.

### CAP-002 — Routine management

The lifter can have many Routines and at most one active. An accepted Routine takes
additions only, and only while it is active. A Routine with Sessions cannot be
deleted, only archived.

### CAP-003 — Calendar and Placements

A month view combines intent (Placements) with what happened (Sessions). The lifter
owns the Placements. Missed days are derived, never recorded.

### CAP-004 — Today

The daily entry point. It suggests a Workout, lets the lifter pick another one, and
surfaces an open Session.

### CAP-005 — Session execution

Gym mode. It shows targets, previous performance and a suggested load, and it
handles set logging, deviations, the rest timer, the hold stopwatch and the screen
wake lock.

### CAP-006 — Progression

A suggested next target, derived from history for each Exercise. Two rules exist:
`manual` and `double_progression`.

### CAP-007 — Exercises and measurement

A catalog of base Exercises shipped with the app, plus Exercises the lifter creates.
Each Exercise declares one of nine measurement types, and the type governs what a
set records and how progress is read.

### CAP-008 — History and progress

Per-exercise history, Session detail with session effort, and a progress dashboard:
per-exercise metrics and records, sets per muscle this week, and blocks per Routine.

### CAP-009 — Data portability

A full backup (optionally encrypted), restore by replacement, CSV export of the set
history, and a YAML export of a Routine.

### CAP-010 — Settings

Device defaults: weight unit, RIR, timer cues, wake lock and bodyweight.

### CAP-011 — Installable offline app

The app installs to the home screen, works fully offline after the first load,
warns when stored data is at risk, and offers an update when a new version exists.

## 7. Functional Requirements

### Routine import and authoring (CAP-001)

- FR-001 — The lifter can select a `.yaml` or `.yml` routine file to import.
- FR-002 — A file that is malformed, has a missing or unknown `version`, or lacks a
  required field is rejected before the wizard opens, with a message saying it
  could not be read.
- FR-003 — The wizard flags each semantic issue defined in `docs/FORMAT.md` on the
  field it concerns, and Accept stays blocked while any issue remains.
- FR-004 — In the exercises step, the lifter can edit sets, reps, RIR, rest, notes
  and unit for each Planned Exercise.
- FR-005 — In the exercises step, the lifter can remove, reorder and add exercises,
  and add Workouts.
- FR-006 — The lifter can correct the name of the Routine and of each Workout
  before Accept.
- FR-007 — In the exercises step, the lifter can rename an exercise, or replace it
  with another, in the Routine Draft.
- FR-008 — The add-exercise picker offers the catalog, the lifter's own Exercises,
  and every exercise already in the draft. It also accepts a new name, which
  becomes an Exercise only on Accept.
- FR-009 — The lifter can open the wizard without a file and start from a blank
  draft. That draft is blocked until it has a name and at least one Workout.
- FR-010 — The schedule step shows each Workout's suggested days and the number of
  weeks, and the lifter can edit both.
- FR-011 — The lifter can pick a start date, which defaults to today and cannot be
  in the past.
- FR-012 — On Accept, Placements are generated on the suggested days and cover
  exactly `weeks × 7` days from the start date.
- FR-013 — When a Routine is already active, the schedule step warns that it will be
  archived. It also offers, unchecked by default, to remove that Routine's
  remaining Placements from today onward that have no Session.
- FR-014 — Each exercise in the file resolves to an Exercise in this order: its
  `exercise_id` in the catalog; otherwise its normalized name (trimmed, lower-case,
  whitespace collapsed), matched against current and previous names; otherwise a
  new user Exercise.
- FR-015 — The lifter can cancel the wizard, which discards the draft after a
  confirmation.
- FR-016 — A reload discards a Routine Draft.

### Routine management (CAP-002)

- FR-017 — The lifter can see every Routine with its status (active or archived).
- FR-018 — The lifter can activate a Routine. Doing so archives any other active one.
- FR-019 — The lifter can archive a Routine.
- FR-020 — The lifter can delete a Routine that has no Sessions, after a confirmation.
- FR-021 — Deleting a Routine that has Sessions is refused, and archiving is offered
  instead.
- FR-022 — The lifter can add a Workout to the active Routine. Its suggested days
  seed new Placements.
- FR-023 — The lifter can add a Planned Exercise to a Workout of the active Routine.
- FR-024 — The lifter can view a Routine's Workouts, exercises and programming.
- FR-025 — The lifter can export a Routine as a routine file.

### Calendar (CAP-003)

- FR-026 — The calendar shows each day as completed, partial, in progress, planned,
  missed or rest.
- FR-027 — The lifter can move a Placement to another date.
- FR-028 — The lifter can delete a Placement, after a confirmation.
- FR-029 — A day's sheet lists that day's Sessions, and each one links to its detail.

### Today (CAP-004)

- FR-030 — Today suggests the Workout placed for today. If none is placed, it
  suggests the Workout after the last one performed, in Routine order.
- FR-031 — Today labels the suggestion as either planned for today or next in rotation.
- FR-032 — When the active Routine has more than one Workout, the lifter can pick
  any of them to start.
- FR-033 — When a Session is open, Today says so and offers to resume it.
- FR-034 — With no Routine, Today offers to import a file or start from scratch.

### Session execution (CAP-005)

- FR-035 — The lifter can start a Session of a Workout. Only one Session can be open
  at a time.
- FR-036 — When a Session starts, the planned targets of every exercise in its
  Workout are copied into it. An unplanned exercise is copied in when it is added.
  Later changes to the Routine do not alter them.
- FR-037 — Before and during an exercise, the app shows the previous performance of
  that Exercise and the suggested target.
- FR-038 — The lifter can log a set with the fields its measurement type collects
  (weight and unit, reps, RIR, duration, distance and distance unit, as applicable).
- FR-039 — A new set opens with the Planned Exercise's unit and the suggested or
  previous values pre-filled.
- FR-040 — The lifter can log the weight of a set in a unit different from the
  planned default.
- FR-041 — The lifter can leave RIR unrecorded, which is kept distinct from RIR 0.
- FR-042 — The lifter can edit a logged set.
- FR-043 — The lifter can delete a logged set.
- FR-044 — The lifter can log more or fewer sets than planned.
- FR-045 — The lifter can skip an exercise.
- FR-046 — The lifter can reorder the exercises of the open Session.
- FR-047 — The lifter can add an unplanned exercise to the open Session.
- FR-048 — Deviations from the plan are marked visually and never block or raise an
  error.
- FR-049 — After a set is logged on an exercise with planned rest, a rest countdown
  runs from the moment the set was logged.
- FR-050 — The lifter can pause, resume, restart and skip the rest timer, and add
  time to it.
- FR-051 — When the rest timer reaches zero, it vibrates and/or plays a sound,
  according to Settings.
- FR-052 — Timed sets offer a stopwatch that cues at the target duration.
- FR-053 — While a Session is open and the setting is on, the screen is kept awake
  where the device supports it. Where it does not, nothing is shown.
- FR-054 — The lifter can finish a Session. It is stored as partial if any exercise
  is still pending, and as completed otherwise.
- FR-055 — The lifter can discard a Session in which nothing has been logged.

### Progression (CAP-006)

- FR-056 — For a `double_progression` exercise, the target advances by one
  increment when the first N sets of the previous eligible Session all reach the
  top of the range. N is the number of sets that Session planned.
- FR-057 — When fewer than N sets were logged, or any of the first N fell short,
  the suggestion repeats the previous load.
- FR-058 — For a `manual` exercise, the suggestion repeats the previous load and
  never advances it.
- FR-059 — An unplanned exercise receives no suggestion.

### Exercises and measurement (CAP-007)

- FR-060 — The lifter can browse the catalog and their own Exercises, grouped by
  category, filtered by equipment and searched by name.
- FR-061 — The lifter can create an Exercise. A name that already exists resolves
  to the existing Exercise.
- FR-062 — The lifter can rename one of their own Exercises. The old name keeps
  resolving to it on import.
- FR-063 — A rename to a name that another Exercise already answers to is refused.
- FR-064 — The lifter can delete one of their own Exercises only when no Session and
  no Routine uses it.
- FR-065 — Catalog Exercises cannot be renamed or deleted.
- FR-066 — The lifter can change one of their own Exercise's measurement type only
  while it has no logged sets.

### History and progress (CAP-008)

- FR-067 — Each Exercise has a history screen listing every Session and set, with a
  summary of its best set and its sessions. An Exercise never trained says it has
  no history yet.
- FR-068 — Each Session has a detail screen showing its exercises and sets, and its
  effort when that can be computed.
- FR-069 — Progress offers only exercises that have been trained, most recent first,
  and they are searchable.
- FR-070 — For the selected exercise, Progress offers only the metrics its
  measurement type defines, from: load, estimated 1RM, reps, time, distance, pace
  and volume.
- FR-071 — Progress shows the best set and the best estimated 1RM for the selected
  exercise.
- FR-072 — A Session is marked a record when its estimated 1RM strictly exceeds that
  of every earlier Session. The first Session is never a record.
- FR-073 — Progress shows the selected exercise's history grouped by Routine block.
- FR-074 — Progress shows, for the current Monday-to-Sunday week and the active
  Routine, the sets per muscle category, planned against logged. Exercises with an
  unknown category are listed separately.

### Data portability (CAP-009)

- FR-075 — The lifter can export a full backup file containing all routines,
  schedule, user Exercises, sessions, sets and Settings.
- FR-076 — The lifter can protect a backup with a password. Such a backup cannot be
  restored without that password.
- FR-077 — Restoring validates the whole file and shows a summary before anything
  is changed.
- FR-078 — Before restoring, the current data is saved as a safety backup.
- FR-079 — A confirmed restore replaces all training data at once. The device's
  Settings are left unchanged.
- FR-080 — A restore warns when an open Session will be lost.
- FR-081 — A backup from a newer app version is refused, with a message to update
  the app.
- FR-082 — A backup from an older app version restores.
- FR-083 — The lifter can export the set history as CSV.
- FR-084 — Right after a Session is finished, the app asks for a backup when none
  exists or the newest is a week old or more, and lets the lifter save one from
  that prompt.

### Settings (CAP-010)

- FR-085 — The lifter can set the default weight unit (kg or lb), the default RIR,
  timer vibration, timer sound, keep screen awake, and bodyweight.
- FR-086 — Changing a setting does not alter any training already stored.

### Installable offline app (CAP-011)

- FR-087 — The app can be installed to the home screen and opens standalone.
- FR-088 — Today warns when the app is not installed, or when the browser reports
  that stored data may be cleared.
- FR-089 — The app requests persistent storage after a Routine is accepted and
  after a Session is finished.
- FR-090 — When a new version is available, the app offers to reload. It never
  reloads on its own.

## 8. Non-Functional Requirements

- NFR-001 — Offline operation: after the first load, J-001 through J-005 complete
  with the device in airplane mode.
- NFR-002 — No data egress: the app sends no request that carries user data, and
  makes no request to any origin other than its own static host. The lifter's data
  leaves the device only in a file the lifter exports.
- NFR-003 — Set durability: a set that has been confirmed as logged survives the app
  being killed immediately afterwards.
- NFR-004 — Timer correctness: after the phone is locked for two minutes during a
  rest, the remaining time shown on unlock is within 1 s of wall-clock truth.
- NFR-005 — Session recovery: an open Session, with all its logged sets, can be
  resumed after closing the app, locking the phone, or restarting the browser.
- NFR-006 — Responsiveness: logging, editing and navigating complete in under 100 ms
  on a mid-range phone, wherever local storage allows.
- NFR-007 — Mobile-first layout: every screen is usable at 360–430 px width with
  no horizontal scroll. Desktop is supported but secondary.
- NFR-008 — Backup confidentiality: an encrypted backup reveals nothing about its
  training content without the password.
- NFR-009 — Backup compatibility: every backup produced by an earlier released
  version restores in the current version.
- NFR-010 — CSV stability: columns are only appended at the end. The existing
  columns keep their positions across versions.
- NFR-011 — Routine file compatibility: every file valid under a supported `version`
  of `docs/FORMAT.md` keeps importing.

## 9. Business Rules and Invariants

- BR-001 — Planned training is never rewritten to reflect performed training.
- BR-002 — A Session's planned targets are the snapshot taken when the Session
  started. Later Routine changes never alter them, and a Planned Exercise added
  during an open Session does not join it.
- BR-003 — Each import, and each scratch authoring, creates a new Routine. Routines
  are not versioned.
- BR-004 — An accepted Routine takes additions only (a Workout, or a Planned
  Exercise), and only while it is active.
- BR-005 — Importing a Routine never modifies historical Sessions.
- BR-006 — History and progression are keyed to the Exercise, never to the Planned
  Exercise, so a corrected re-import preserves history.
- BR-007 — Exercise identity is a generated identifier. A name is a mutable label.
- BR-008 — Placements and Sessions are independent. Neither references the other.
- BR-009 — Missed is derived: a past Placement is missed when no Session of its
  Workout falls on its date or earlier in its Monday-week. Exact-date matches are
  assigned first. Each Session answers at most one Placement.
- BR-010 — A past Placement with no Session stays where it is. It is never shifted
  forward.
- BR-011 — Suggested days only seed Placements, and are not consulted afterwards.
- BR-012 — The previous eligible Session for progression is the newest one that is
  completed, or partial with that exercise fully performed. An open Session never
  counts.
- BR-013 — Progression is derived from history on demand. No working weight is stored.
- BR-014 — A set records the unit it was actually logged in. Every weight also has
  a kilogram value, and every distance a metre value, used for all comparison,
  charting and progression.
- BR-015 — The measurement type is declared on the Exercise and copied onto the
  Exercise Session when that is created. It decides which fields a set collects, which
  axis records and progression read, and whether lower or higher is better.
  Assisted bodyweight and pace read lower-is-better.
- BR-016 — Volume is kept as separate families (kg·reps, reps, seconds, metres).
  No figure adds two families together.
- BR-017 — Estimated 1RM is `kg × (1 + (reps + RIR) / 30)`, taken as the maximum
  over all sets of a Session, and defined only for weight-and-reps types.
- BR-018 — Session effort is mean RPE (`10 − RIR`) times session minutes. It is
  unitless and never called load.
- BR-019 — RIR is stored as an actual result and never discarded. An unrecorded RIR
  is not 0.
- BR-020 — A Session's status is in progress, partial or completed. "Scheduled" and
  "skipped" are not Session statuses.
- BR-021 — Settings are defaults that belong to the device. They are carried in a
  backup but never restored.
- BR-022 — The catalog ships with the app and is never part of a backup.
- BR-023 — A CSV cell for a field the row's type does not carry is empty, never zero.

## 10. Product / UX Principles

- UX-001 — Navigation has exactly four tabs: Today, Calendar, Progress and More.
  Everything else is reached from one of them.
- UX-002 — During a Session, nothing that does not serve the current set competes
  with the targets, the previous performance, the inputs and the complete action.
- UX-003 — Primary controls sit in the thumb zone. Numeric entry prefers steppers,
  presets and numeric keyboards over free text.
- UX-004 — Previous or suggested values pre-fill the inputs.
- UX-005 — Destructive actions (delete Routine, delete Placement, delete Exercise,
  remove exercise from the draft, cancel the wizard, restore) require an explicit
  second confirmation.
- UX-006 — User-facing language follows CONTEXT.md: Session, Set, Exercise, RIR.

## 11. Hard Constraints

- CON-001 — No backend, no account and no paid service is required for any capability.
- CON-002 — All training data lives on the device.
- CON-003 — The routine file is YAML, and its contract is `docs/FORMAT.md`
  (versions 1 and 2).
- CON-004 — The app is distributed as static files, and the exercise catalog ships
  inside them.
- CON-005 — The UI and all repository artifacts are in English.

## 12. MVP Scope

The baseline is everything that ships today.

### In

- FR-001–FR-016 — routine import and authoring.
- FR-017–FR-025 — routine management.
- FR-026–FR-029 — calendar.
- FR-030–FR-034 — Today.
- FR-035–FR-055 — session execution.
- FR-056–FR-059 — progression.
- FR-060–FR-066 — exercises and measurement.
- FR-067–FR-074 — history and progress.
- FR-075–FR-084 — data portability.
- FR-085–FR-086 — settings.
- FR-087–FR-090 — the installable offline app.

### Out

- Everything in §4 and §14.
- A list of every Session. Sessions are reached from the calendar and from history.
- Deleting a Session, or clearing all data, from inside the app.

## 13. Success Criteria

- SC-001 — Offline, with the app installed, the lifter completes this sequence:
  1. Import a real block file (`docs/examples/bloque-a-acumulacion.yaml`) and
     accept it.
  2. See its Placements in the calendar.
  3. Start Today's Workout, see the previous performance, and log a set.
  4. Lock the phone for two minutes and find the rest timer correct.
  5. Finish the Session.
  6. Reopen the app and find the history intact.
  7. Move next week's Placement.
  8. See the progression target.
  9. Export a backup.
- SC-002 — That backup, restored on a clean install, reproduces every Session and
  set.
- SC-003 — Re-importing a corrected version of an imported file keeps each
  Exercise's history and progression continuous.
- SC-004 — A full block runs with no network request, apart from the app's own
  static assets and update check.

## 14. Future Product Scope

- Workout volume per week, workout adherence and calendar statistics.
- Advanced charts. They still use one chart with a metric switch, and never a
  second Y axis.
- Muscle volume for past weeks, and fractional sets.
- Warm-up sets that do not count toward progression.
- Supersets and drop sets.
- Deload support.
- Custom progression strategies beyond `manual` and `double_progression`.
- Destructive routine editing: rename, reorder, retarget, remove. It needs a written
  product decision first.
- A rest timer whose pause and added time survive the app being closed. Today only
  the countdown from the logged set survives.
- Optional cloud sync. Local operation would stay primary.

## 15. Product Decisions

| ID | Question | Status | Decision | Decided by | Date | Quote | Affects |
|---|---|---|---|---|---|---|---|
| PD-001 | Is the target state for this baseline the current code, or are there planned changes? | Decided | Document what exists. The code is the target. | Josue | 2026-10-30 | «Documentar lo que existe (Recommended)» | Whole PRD; the brief's drifts |
| PD-002 | What happens to the real block files that tests and FORMAT.md use? | Decided | Keep them as fixtures in `docs/examples/`. | Josue | 2026-10-30 | «Restaurar en examples (Recommended)» | SC-001, NFR-011 |
| PD-003 | Do `docs/PRD-DMS.md` and `docs/PRD-TEMPLATE.md` stay? | Decided | Remove them. They are not TrainLog documents. | Josue | 2026-10-30 | «Sí, borrar ambos (Recommended)» | Repository docs |
| PD-004 | Does this PRD supersede `docs/PRD.md`? And do PRODUCT.md's product sections become pointers? | Decided | Yes to both. The brand sections of PRODUCT.md stay. | Josue | 2026-10-30 | «Sí, reemplaza» | `docs/PRD.md`, PRODUCT.md, AGENTS.MD, README.MD links |
| PD-005 | Does the `docs/changes/` folder convention continue for future changes? | Open | — | — | — | — | README.MD, CONTRIBUTING.md |

## 16. Product Traceability

| Capability / Journey | Requirements |
|---|---|
| CAP-001 / J-001 | FR-001–FR-016, NFR-011, BR-003, BR-005, BR-006 |
| CAP-002 | FR-017–FR-025, BR-004 |
| CAP-003 / J-001 | FR-026–FR-029, BR-008–BR-011 |
| CAP-004 / J-002, J-003 | FR-030–FR-034 |
| CAP-005 / J-002, J-003 | FR-035–FR-055, NFR-003–NFR-006, BR-002, BR-014, BR-015, BR-019, BR-020 |
| CAP-006 / J-002 | FR-056–FR-059, BR-012, BR-013 |
| CAP-007 | FR-060–FR-066, BR-007, BR-015 |
| CAP-008 / J-004 | FR-067–FR-074, BR-016–BR-018 |
| CAP-009 / J-005 | FR-075–FR-084, NFR-002, NFR-008–NFR-010, BR-021–BR-023 |
| CAP-010 | FR-085–FR-086, BR-021 |
| CAP-011 | FR-087–FR-090, NFR-001, NFR-007 |
