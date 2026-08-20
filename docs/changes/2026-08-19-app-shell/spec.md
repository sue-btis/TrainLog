# App Shell — Today, Calendar, Routines — Spec

Status: Ready for implementation
Size: medium
Reliability: strict
Base: working tree on `change/technical-spine`, with the import wizard change complete and verified

## Goal

The app becomes navigable and an imported Routine becomes visible. A lifter opens
TrainLog and sees what to train today, can look at the month and tell planned
from performed from missed, can move or delete a Placement, and can manage their
Routines — activate, archive, delete — without touching the harness.

Done when the three screens are reachable from a bottom navigation, the calendar
renders the six states of §11.3 from derived data, a Placement can be moved to
another day and deleted, and deleting a Routine that has Sessions is refused
with archival offered instead.

## Evidence and Current Behavior

Everything this change reads already exists and is tested by
`docs/changes/2026-08-18-technical-spine/`. None of it is rebuilt.

- `src/domain/scheduling/index.ts` — `isMissed(placement, sessions, today)`
  derives a missed day, converting a Session's `startedAt` instant to its local
  day. `nextWorkoutInRotation(workouts, lastPerformedWorkoutId)` returns the next
  Workout by `order`, wrapping, and the first when nothing has been performed.
- `src/db/repositories/placements.ts` — `listPlacementsByRoutine`,
  `listPlacementsBetween(from, to)` on the `date` index. Its header comment
  states that moving and deleting "belong to the calendar (§11.3), which is out
  of scope for this change, so no mutation is exposed yet". This change is that
  calendar.
- `src/db/repositories/routines.ts` — `listRoutines` (newest first),
  `getActiveRoutine`, `activateRoutine` (transactional, demotes every other
  active), `archiveRoutine`, and `deleteRoutine`, which throws
  `RoutineHasSessionsError` carrying `routineId` and `sessionCount` when any
  Session references the Routine, with a message callers are expected to surface
  verbatim.
- `src/db/repositories/sessions.ts` — `getInProgressSession` (the "is a session
  open?" read of §35), `listSessionsByRoutine`. No range query exists yet.
- `src/db/schema.ts` — version 1, and it already declares every index this
  change needs: `placements.date`, `placements.routineId`, `sessions.startedAt`,
  `sessions.status`, `sessions.routineId`, `workouts.routineId`,
  `plannedExercises.workoutId`, `routines.status`. **No schema change is
  required or permitted.**
- `src/db/repositories/history.ts` — `getSessionDetail(sessionId)` returns a
  Session with its ExerciseSessions and their CompletedSets.
- `src/features/ui/styles.ts` — the Dose Card vocabulary: `SCREEN`, `COLUMN`,
  `CARD`, `PANEL_CARD`, `WELL`, `LABEL`, `button`, `tab`, `chip`, `alert`,
  `field`, `FOCUS_RING`, `PRESS`, `ICON_STROKE`.
- `src/styles/theme.css` — DESIGN.md tokens, the `type-*` scale, and the `bloom`
  and `glass` utilities the import wizard added for its action bar. DESIGN.md
  puts the glass nav over that same bloom.
- `src/App.tsx` — `react-router` with `/import`, `/harness`, and a catch-all
  redirecting to `/import`.
- `SessionStatus` is `in_progress | completed | partial`; a Placement carries
  `date` as a `LocalDate` (`YYYY-MM-DD`), so lexical order is chronological.

## Scope

Included:

- `dayState` and `estimateDuration` in `src/domain/scheduling/`, both pure and
  unit-tested.
- `movePlacement` and `deletePlacement` in the placements repository;
  `listSessionsBetween` and the last-performed-Workout read in the sessions
  repository.
- A bottom navigation and the routing that goes with it.
- Today (§11.4), Calendar (§11.3), Routines list and Routine detail (§11.2).

Excluded:

- Workout execution, set logging and the rest timer (§11.5–11.7) — the next
  change. **Today therefore carries no `Start workout` control**; see A-4.
- Progress dashboard, charts, and any charting dependency.
- The exercise catalog browser, Settings, backup, restore, CSV export, PWA.
- Adding a Placement by hand — §11.3 permits moving and deleting only.
- Any Dexie schema change; any new dependency; shadcn/ui.
- Editing a Routine. Routines are immutable once accepted (AGENTS.MD); editing
  happens in the import wizard, which already exists.

## Decisions and Assumptions

- **D1** — Navigation is Today · Calendar · Routines. `/today` is the index
  route; `/calendar`, `/routines`, `/routines/:routineId`; `/import` keeps its
  URL and is entered from Routines; `/harness` stays reachable by URL but is
  absent from the navigation. Authority: change owner, 2026-08-19.
- **D2** — Estimated session duration is
  `Σ over planned exercises of sets × (restSeconds + WORK_SECONDS_PER_SET)`,
  with `WORK_SECONDS_PER_SET = 45`, `DEFAULT_REST_SECONDS = 90` when the
  exercise declares no rest, rounded to the nearest 5 minutes and always
  rendered with a leading `~`. The three constants are frozen here and are named
  exports, so a later change adjusts them deliberately rather than by drift.
  The PRD defines no formula; this one is the change owner's. Authority: change
  owner, 2026-08-19.
- **D3** — A Placement is moved with a native `<input type="date">` in the day
  sheet, with delete beside it. No drag interaction, no new dependency.
  Authority: change owner, 2026-08-19.
- A-1: the calendar reads one month at a time and across **all** Routines, not
  only the active one — a month can span an archived Routine's Placements and
  the Sessions performed against it. Stop if a §11.3 requirement scopes the
  calendar to one Routine.
- A-2: the day sheet is rendered inline beneath the grid, not in a modal.
  DESIGN.md and Operate mode both make a modal the last resort, and shadcn stays
  out of the tree until a focus trap is genuinely needed. Stop if the sheet
  cannot be made keyboard-operable inline.
- A-3: `deleteRoutine` and `deletePlacement` each take a two-press inline
  confirm, matching the import wizard's remove control. Stop if a stronger
  guard is required for either.
- A-4: Today shows what to train and does not start it. §11.4's `START WORKOUT`
  arrives with the execution screen (§11.5); a disabled button as the screen's
  focal point would be worse than its absence. Stop if Today must be able to
  start a Session in this change.
- A-5: the 7-column week grid takes DESIGN.md's explicit 48 Rule exemption
  (~41px cells, 6px separation) and is never the only route to a day — the day
  sheet is reachable by keyboard from the same cells.

## Requirements and Acceptance

### Shell

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-1 | Routes are `/today` (index), `/calendar`, `/routines`, `/routines/:routineId`, `/import`, `/harness`. Any unknown path redirects to `/today`. | AC-1: loading `/` renders Today; `/nonsense` redirects to `/today`; `/import` still renders the wizard and `/harness` the session harness. |
| R-2 | A bottom navigation carries exactly Today, Calendar and Routines, on those screens only. The current item is marked with `aria-current="page"` and reads as pressed in — filled `planned-ink` with the sunk inset — while the others are raised domes on the glass film over the colour bloom. | AC-2: on each of the three screens the matching item carries `aria-current="page"` and a `#1F49C4` fill; AC-3: the navigation is absent from `/import` and `/harness`. |
| R-3 | Every navigation item is at least 48px tall and reachable by keyboard in reading order. | AC-4: no navigation control measures under 48px at 390px width; Tab reaches all three. |

### Routines (§11.2)

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-10 | `/routines` lists every Routine, newest import first, each showing its name and status, with the active one distinguished. | AC-10: after two imports the list shows both, newest first, exactly one marked active. |
| R-11 | A Routine can be activated. Afterwards exactly one Routine is active and the previously active one reads `archived`. | AC-11: activating the older Routine leaves it the only active one. |
| R-12 | A Routine can be archived. Its Sessions and history are untouched. | AC-12: archiving the active Routine leaves no active Routine and does not change the session count. |
| R-13 | A Routine can be deleted after a two-press confirm. Deletion removes the Routine, its Workouts, its Planned Exercises and its Placements. | AC-13: deleting a Routine with no Sessions removes all four; the first press only arms the control. |
| R-14 | Deleting a Routine that any Session references is refused. The screen reports the refusal in the product's own language, names how many Sessions hold it, and offers archiving instead. | AC-14: attempting it leaves every row intact and shows the refusal with the session count and an archive control. |
| R-15 | `/routines` offers `Import routine`, opening `/import`. With no Routine stored, the screen is an empty state that says so and offers the same control. | AC-15: on an empty database the list shows the empty state and the control reaches the wizard. |
| R-16 | `/routines/:routineId` shows the Routine's weeks, its Placement count, and each Workout in `order` with its suggested days and its Planned Exercises in `order` — exercise name resolved, sets, rep range, RIR range, rest and progression. | AC-16: the detail of an imported example file matches the file's own programming, exercise for exercise. |
| R-17 | An unknown `:routineId` shows a not-found state with a route back to the list, and never a blank screen. | AC-17: `/routines/does-not-exist` renders that state. |

### Calendar (§11.3)

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-20 | `/calendar` renders one month as a 7-column grid beginning Monday, with the month named and controls for previous month, next month and back to today. | AC-20: the grid places each date under the correct weekday and the controls move the rendered month. |
| R-21 | Every day cell carries exactly one derived state: `completed`, `partial`, `in_progress`, `planned`, `missed`, or `rest`. Each is distinguishable without colour alone, and a legend names them in the product's language. | AC-21: a day with a completed Session, a past Placement with none, a future Placement, and a bare day render as four visibly distinct, individually labelled states. |
| R-22 | State is derived at read time from Placements and Sessions. Nothing writes `missed` or any other day state, and a past Placement without a Session stays on its own date — it is never carried forward. | AC-22: a `missed` day appears with no write to IndexedDB; the Placement's `date` is unchanged after rendering. |
| R-23 | The calendar reads all Routines, not only the active one. | AC-23: after archiving a Routine, its Placements and Sessions still render in the month they fall in. |
| R-24 | Selecting a day opens a sheet naming the date and listing what is on it: each Placement by Workout name, and each Session by Workout name with its status and the exercises performed. A day with nothing says so. | AC-24: selecting a day with one Placement and one Session lists both; selecting a bare day shows the rest-day state. |
| R-25 | A Placement can be moved to another date from the sheet, using a native date control. The grid reflects the move immediately, and no Session is affected. | AC-25: moving a Placement forward two days removes it from the old cell and places it on the new one, with `sessions` unchanged. |
| R-26 | A Placement can be deleted from the sheet after a two-press confirm. No Session is affected. | AC-26: the first press arms, the second removes the Placement and only that Placement. |
| R-27 | A month containing nothing renders an empty state that explains where Placements come from, rather than an unexplained empty grid. | AC-27: on an empty database the month renders that state. |

### Today (§11.4)

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-30 | Today resolves the suggested Workout as §11.4 states: a Placement for today in the active Routine names the Workout; with none, the next Workout in rotation after the last performed one; with no active Routine, nothing to suggest. | AC-30: with a Placement for today the screen names that Workout; AC-31: with no Placement it names the next in rotation; AC-32: after performing the last Workout in the rotation it wraps to the first. |
| R-31 | A Workout selector is always available and switches the shown Workout to any Workout of the active Routine. A day with no Placement is not a blocked day. | AC-33: on a day with no Placement the selector still offers every Workout and switching changes what is shown. |
| R-32 | The screen shows today's date, the Workout's name, its exercise count, its estimated duration prefixed `~`, and its exercises with their programming. | AC-34: the exercise count matches the Workout's Planned Exercises and the duration matches D2's formula for that Workout. |
| R-33 | The last Session performed against the shown Workout is summarised — when it was and how it ended. With none, the screen says so plainly. | AC-35: after one completed Session the summary names its date and status; on a fresh Routine it reads as no history yet. |
| R-34 | With a Session `in_progress`, Today says so before anything else and offers the one place it can currently be resumed. | AC-36: with an open Session the notice appears above the suggestion and links to `/harness`. |
| R-35 | With no Routine stored, Today is an empty state that explains the app needs a routine file and offers the import wizard. | AC-37: on an empty database Today shows that state and reaches `/import`. |

### Domain and persistence

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-40 | `dayState(placements, sessions, date, today)` returns one of the six states of §11.3. It is pure, reads no clock, writes nothing, and lives in `src/domain/scheduling/`. A Session on the day outranks a Placement; among Sessions, `in_progress` outranks `completed` and `partial`. Today's own date is never `missed`. | AC-40: unit tests cover all six states; AC-41: a Placement dated today with no Session is `planned`, not `missed`; AC-42: the function is called with a fixed `today` and never reads `Date.now()`. |
| R-41 | `estimateDuration(plannedExercises)` implements D2 exactly, exporting its three constants. An empty list estimates zero. | AC-43: `4 sets × (210 + 45) = 1020s` plus `3 × (150 + 45) = 585s` estimates to 25 minutes; AC-44: an exercise with no `restSeconds` uses 90. |
| R-42 | `movePlacement(id, date)` changes only that Placement's date. `deletePlacement(id)` removes only that Placement. Neither touches a Session, and neither is reachable from outside `src/db/`. | AC-45: repository tests against `fake-indexeddb` prove both, including that the Session count is unchanged. |
| R-43 | `listSessionsBetween(from, to)` returns the Sessions whose `startedAt` falls on a local day within the inclusive range, across all Routines, using the `startedAt` index. | AC-46: a Session started at 23:30 local on the last day of the range is included, and one at 00:30 the next day is not. |
| R-44 | The last performed Workout is readable for rotation, across the active Routine's Sessions. | AC-47: with three Sessions, the newest by `startedAt` names the Workout rotation advances from. |
| R-45 | Dexie stays at schema version 1. No table, index or field is added or changed. | AC-48: `SCHEMA_V1` is byte-for-byte unchanged and `SCHEMA_VERSION` is still 1. |

### Design and accessibility

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-50 | Every colour, radius, shadow and type value comes from a `theme.css` token or `type-*` utility. No literal, no arbitrary Tailwind value beyond those DESIGN.md names as exceptions, and no dark-mode variant. | AC-50: a repo-wide sweep for `bg-[#`, `rounded-[`, `shadow-[`, hex literals and `dark:` returns nothing new. |
| R-51 | Every interactive control is at least 48px tall, with the single exception of the 7-column week grid, which DESIGN.md exempts at ~41px with 6px separation and which is never the only route to a day. | AC-51: at 390px, the only controls under 48px are day cells, and every day is also reachable from the keyboard. |
| R-52 | Both destructive actions — deleting a Routine and deleting a Placement — take two presses, name what will be removed, and offer a way out. | AC-52: one press never destroys anything, in either place. |
| R-53 | Each screen is fully operable by keyboard, states its current position in the navigation, and gives every empty and error state a title in product language plus one sentence of what to do. | AC-53: Tab reaches every control in reading order on all four screens; AC-54: no empty state reads merely "nothing here". |
| R-54 | Authored mobile-first at 390px; the page body never scrolls horizontally at any width; the fixed navigation never covers content. | AC-55: at 390px and 1280px, `scrollWidth <= clientWidth`, and the last element of each screen is reachable above the navigation. |
| R-55 | The app makes no runtime network request. | AC-56: `performance.getEntriesByType('resource')` shows same-origin entries only. |

## Contracts and Risk Controls

Changed:

- **`src/db/repositories/placements.ts`** gains `movePlacement` and
  `deletePlacement` — the first mutations of user-owned scheduling data, and the
  reason this change carries a `strict` profile. Its header comment, which
  currently defers them, is updated rather than left contradicting the code.
- **`src/db/repositories/sessions.ts`** gains `listSessionsBetween` and the
  last-performed read.
- **`src/domain/scheduling/`** gains `dayState` and `estimateDuration`, exported
  through its existing entry point.
- **UI contract** — the index route becomes `/today`; `/import` is no longer the
  app's front door, though its URL is unchanged.

Preserved:

- Every AGENTS.MD invariant. In particular: Placements and Sessions stay
  mutually unreferencing — moving or deleting a Placement never reads or writes
  a Session, and `missed` stays derived and unwritten (ADR 0001).
- Dexie schema version 1, exactly as it stands.
- Layering: `features → db → domain`; `src/domain/**` imports neither Dexie nor
  React, `src/db/**` imports no React. The ESLint rules stay and must keep
  passing.
- The import wizard's behaviour and its `/import` URL; the harness and `/harness`.
- Routines remain immutable once accepted — nothing here edits one.

## Quality Obligations

- Tests: unit tests for `dayState` covering all six states and the boundaries
  (today is never missed; `in_progress` outranks the rest; a Session without a
  Placement still reads as performed), and for `estimateDuration` including the
  absent-rest default and rounding. Repository tests against `fake-indexeddb`
  for `movePlacement`, `deletePlacement` (both asserting Sessions untouched),
  and `listSessionsBetween` including the local-day boundary of AC-46.
- QA (AGENTS.MD: UI is verified by running it): drive the dev server through an
  empty database, an imported Routine, a moved Placement, a deleted Placement,
  a refused Routine deletion, an activation, and Today with and without a
  Placement for the day. Record what was observed.
- Static/build: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` clean.
- Coverage: the two new domain functions at 100% lines and branches.
- Mechanical design detector run once over the changed UI targets.
- No mutation gate: `strict`, not `critical`.

## Change Surface

Expected edits:

- `src/domain/scheduling/index.ts` and its test — `dayState`, `estimateDuration`.
- `src/db/repositories/placements.ts`, `sessions.ts`, and their tests.
- `src/db/index.ts` — export the four new functions.
- `src/features/shell/**` — navigation and the screen frame.
- `src/features/today/**`, `src/features/calendar/**`, `src/features/routines/**`.
- `src/features/ui/styles.ts` — extend the vocabulary only where a screen needs
  something the wizard did not.
- `src/App.tsx` — routes.

Do not touch:

- `src/db/schema.ts`, `src/db/database.ts` — version 1 is frozen.
- `src/domain/{types,ids,units,dates}.ts`, `catalog/**`, `routine-file/**`,
  `session/**`, `progression/**`.
- `src/features/import/**` and `src/features/harness/**`, beyond what routing
  requires.
- `src/styles/theme.css`, unless a genuinely missing token is required, in which
  case add it there rather than inlining a value.
- `docs/`, `DESIGN.md`, `PRODUCT.md`, `AGENTS.MD`, `design/`,
  `.claude/launch.json`, `package.json` dependencies.

## Planning Decision

Plan required: **No**.
One writer, and the order is forced by the dependencies: domain functions →
repository functions → shell and routing → Routines → Calendar → Today. No
migration, no parallel write sets, no contract to freeze before work starts.

## Stop Conditions

Stop and report rather than invent behavior if:

- a day's state cannot be derived from Placements and Sessions alone;
- the calendar or Today would need a Dexie index that version 1 does not declare;
- moving or deleting a Placement would require reading or writing a Session;
- a design obligation needs a value with no token, or a new dependency;
- Today cannot be built without a way to start a Session (A-4);
- the working tree carries unrelated changes overlapping the write set above.
