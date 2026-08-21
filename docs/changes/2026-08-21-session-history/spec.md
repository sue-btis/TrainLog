# Session History — list and detail — Spec

Status: Ready for implementation
Size: medium
Reliability: strict
Base: `master` at `3733301`, clean working tree.

## Goal

A lifter can look back at any training they have done — not one exercise at a
time, but as sessions: what they trained, when, and every set of it.

Done when: **More** carries a **Session history** entry leading to a list of
every Session newest first; opening one shows that Session's exercises with the
targets it was performed against and every set logged in it; and tapping a
session in the Calendar's day panel opens the same detail. All of it works with
the network off.

This closes the last ⬜ row of MVP 0.1 (§38, "History | Sessions").

## Evidence and Current Behavior

Verified by inspection at `3733301`:

- **The read already exists.**
  [`getSessionDetail`](../../../src/db/repositories/history.ts) returns
  `SessionHistory` — the Session, its ExerciseSessions ordered by `order`, and
  each one's sets. It is exported from [`src/db/index.ts:91`](../../../src/db/index.ts) and
  wrapped as `useSessionDetail` in
  [`queries.ts:68`](../../../src/features/data/queries.ts). Its only consumer today is
  [`SessionScreen.tsx:82`](../../../src/features/session/SessionScreen.tsx), for the live session.
  **No new detail read is needed.**
- **No read lists Sessions across Routines without a date range.**
  [`sessions.ts`](../../../src/db/repositories/sessions.ts) has `listSessionsByRoutine`
  (index `routineId`) and `listSessionsBetween` (index `startedAt`, one month at
  a time, used by the Calendar). Nothing answers "every Session, newest first".
- **The index for it is already declared.** `sessions: 'id, status, startedAt,
  routineId'` ([`schema.ts:124`](../../../src/db/schema.ts)). A newest-first list is served by
  `startedAt`; **no schema change and no `SCHEMA_VERSION` bump.**
- **No route and no screen.** [`App.tsx:29-39`](../../../src/App.tsx) has `/today`,
  `/calendar`, `/routines`, `/more`, `/routines/:routineId`,
  `/exercises/:exerciseId`, plus `/import` and `/session` outside the shell.
  Nothing under `/sessions`.
- **`AppShell` resolves the top bar by hand, per route family.**
  [`AppShell.tsx:31-42`](../../../src/features/shell/AppShell.tsx) special-cases exactly two
  sub-routes: `/routines/…` (back → Routines) and `/exercises/…` (back →
  `navigate(-1)`, "reached from more than one place"). A new sub-route family
  must be added there or it renders under the fallback title "Routine".
- **`SECTIONS` is four entries and `AppShell` binds `SECTIONS[2]`**
  ([`sections.ts`](../../../src/features/shell/sections.ts)). The comment states More is
  *"appended, never prepended"* for that reason.
- **The Calendar already renders Sessions per day, inert.**
  `SessionRow` in [`CalendarScreen.tsx:303`](../../../src/features/calendar/CalendarScreen.tsx) draws
  the status chip, the Workout name and the start time inside an `<article>`
  with no navigation. Workout names come from `useWorkoutsById`
  ([`queries.ts:135`](../../../src/features/data/queries.ts)) — the same resolution a
  session list needs.
- **The presentation vocabulary exists.** `SetPill`
  ([`SetPill.tsx`](../../../src/features/ui/SetPill.tsx)) — *"One component so the two never
  drift into two notations for the same fact"*; `chip`, `WELL`, `RULED`,
  `LABEL`, `ROW_LIST`, `ROW` ([`styles.ts`](../../../src/features/ui/styles.ts));
  `longDate`, `shortDate`, `plural`, `range`
  ([`format.ts`](../../../src/features/ui/format.ts)).
- **The planned-target line has no shared formatter.**
  `programmingLine(exercise: PlannedExercise)` in `format.ts` formats the
  *template*. The same line over an **ExerciseSession snapshot** is written
  inline as JSX at [`ExerciseView.tsx:118-124`](../../../src/features/session/ExerciseView.tsx)
  (`4×4–6 · RIR 1–2 · rest 210s`). A second screen needs that line.
- **The snapshot is the only legitimate source of a past target.**
  `PlannedExerciseSession` carries nine `planned*` fields
  ([`types.ts:199`](../../../src/domain/types.ts)); `ExerciseView`'s own header says the targets
  *"come from the ExerciseSession's own snapshot, never from the PlannedExercise
  behind it (ADR 0002)"*. `ExerciseSession` is a union discriminated on
  `plannedExerciseId`, so an unplanned exercise has no targets to render.
- **History shows every status.** `listExerciseHistory` deliberately does not
  filter, and `ExerciseHistoryScreen` states *"a `partial` session is listed and
  marked rather than hidden"*. The same rule applies here.
- **An empty read and an in-flight read must not render the same thing** —
  `useLiveQuery` returns `undefined` while running, and
  [`ExerciseHistoryScreen.tsx:41`](../../../src/features/history/ExerciseHistoryScreen.tsx) carries
  that distinction as a comment.
- **`docs/PRD.md` §38 is stale at `3733301`** on four rows: `History | Sessions`
  ⬜ (this change), `Platform | PWA` ⬜ and `Platform | Offline` ⬜ (both shipped
  — [`src/pwa/config.ts`](../../../src/pwa/config.ts), `VitePWA(pwaOptions)` at
  [`vite.config.ts:43`](../../../vite.config.ts)), and `Workout | Rest timer` 🟡 for missing
  notifications that §11.6 itself puts *"Fuera del MVP"*.
- **`stryker.config.json` mutates `src/domain/**` only.** This change adds no
  domain module, so the allowlist is untouched.
- Working tree clean at `3733301`. **No overlap with unrelated work.**

## Scope

Included:

- One repository read: every Session, newest first, across all Routines.
- `/sessions` — the list, inside the shell, reached from More.
- `/sessions/:sessionId` — the detail, over the existing `getSessionDetail`.
- The Calendar's `SessionRow` becomes a link to that detail.
- A shared formatter for the planned-target line over a snapshot, used by both
  the detail and `ExerciseView` (which keeps its current output).
- §38 table correction: the four stale rows above, in the same commit.

Excluded:

- **Progress Dashboard (§11.11)** and the `Progress` nav slot of §10. The bottom
  navigation keeps its four entries; this change adds no tab.
- **Exercise Catalog as a screen (§11.12).**
- **Settings (§32).**
- **Editing history.** The detail is read-only. Correcting a set stays in gym
  mode, where it already is (§11.7).
- **Deleting a Session.** Not in §11.10 and not requested.
- **Filtering, search, date grouping, or per-Routine views** of the list.
- **Resuming an `in_progress` Session from history** — §35 resume belongs to
  Today and gym mode and is unchanged.
- **Any new table, index, or `SCHEMA_VERSION` change.**

## Decisions and Assumptions

| ID | Decision | Authority |
|---|---|---|
| DEC-A | Entries are the **More** screen (→ list) and the Calendar's `SessionRow` (→ detail). No bottom-nav change, no `Progress` screen. | User |
| DEC-B | Routes are `/sessions` and `/sessions/:sessionId`, both inside `AppShell`. | Repo convention: every read-only screen lives in the shell; `/session` (singular, gym mode) stays outside it and is a different thing. |
| DEC-C | The detail's back control retraces (`navigate(-1)`), as `/exercises/…` does — it is reached from two places. The list's back goes to More. | `AppShell.tsx:34-38`, which states that rule for exactly this case |
| DEC-D | The list holds Sessions of every status, `in_progress` included, each marked with its status chip. | §11.8/§11.9 precedent in `ExerciseHistoryScreen`; hiding a status would make the list disagree with the Calendar |
| DEC-E | The detail is read-only for every status, including `in_progress`. It never resumes, never writes. | Scope exclusion above; gym mode is entered from Today (§35) |
| DEC-F | The planned-target line is extracted from `ExerciseView` into `features/ui/format.ts` and reused, rather than written a second time. | Ladder rung 2 (reuse); `SetPill.tsx`'s own stated reason — one notation, not two |
| DEC-G | §38's four stale rows are corrected in this commit. | User; §38's own instruction ("Al cerrar un cambio en `docs/changes/`, actualizar esta tabla en el mismo commit") |

Assumptions:

- **The list is unpaginated.** One local lifter training daily logs a few hundred
  Sessions a year; the Calendar already reads a whole month and export already
  holds the entire database in memory (`schema.ts:50`, "One database, one local
  user"). A stated ceiling, not a silent one. **Stop if** the list is ever asked
  to serve more than one user's history, or if `pnpm build` QA shows the list
  janking at a few thousand rows — pagination then enters this spec rather than
  being improvised.
- **`getSessionDetail` needs no change.** It returns exactly what the detail
  renders. **Stop if** the screen turns out to need a field it does not carry —
  that is a repository change and a re-read of the layering rule, not an inline
  Dexie call from a component.
- **The extracted formatter reproduces `ExerciseView`'s current line exactly.**
  R-6 makes that testable by inspection. **Stop if** the two screens turn out to
  want different text — then they are two notations and the extraction is wrong.

## Requirements and Acceptance

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-1 | A repository read returns every Session across every Routine, newest `startedAt` first, of every status. | AC-1a: with Sessions in two Routines and statuses `completed`, `partial` and `in_progress`, the read returns all of them, ordered strictly by descending `startedAt`. AC-1b: on an empty database it returns `[]`, not an error. AC-1c: it is served by the `startedAt` index — no table scan, no new index, `SCHEMA_V1` and `SCHEMA_VERSION` unchanged. |
| R-2 | `/sessions` renders that list inside the shell: one row per Session carrying its status, its Workout's name, its local day, and its duration. Every value on a row comes from the `Session` row itself or from the Workout name lookup — the list issues no per-Session query. | AC-2a: navigating to `/sessions` renders under a top bar naming the screen, with the bottom nav present. AC-2b: each row states the Workout name resolved through `useWorkoutsById`, the local calendar day of `startedAt` (never a UTC day), the duration when `completedAt` is set, and the status chip for any status that is not `completed`. AC-2c: rows appear newest first, matching R-1's order. AC-2d: rendering the list runs a bounded number of reads — the Session list and the Workout names — regardless of how many Sessions exist. |
| R-3 | A read still in flight and a lifter with no Sessions render differently. | AC-3a: while the query is `undefined` the screen says it is reading, not "no sessions". AC-3b: with zero Sessions it shows an empty state in the `WELL` pattern, worded like `ExerciseHistoryScreen`'s. |
| R-4 | Opening a row shows `/sessions/:sessionId`: the Workout name, the day and duration, and every exercise of that Session in `order`, each with its sets in the order they were logged. | AC-4a: a Session with three exercises and eight sets renders all three and all eight, sets in `setNumber` order, each showing `weight unit × reps` and its RIR. AC-4b: exercises render in `ExerciseSession.order`. AC-4c: an unknown `sessionId` renders a "no such session" state rather than a blank screen or a crash. |
| R-5 | The detail renders a planned exercise's targets **only** from the `ExerciseSession` snapshot, and renders none for an unplanned one. | AC-5a: editing (or deleting) the `PlannedExercise` behind a past Session leaves the detail's target line unchanged — the ADR 0002 invariant. AC-5b: an `UnplannedExerciseSession` shows the `Unplanned` chip and no target line. AC-5c: no file under `src/features/history/` imports `usePlannedExercises`, `listPlannedExercisesByWorkout`, or `db/repositories/plannedExercises` — grep-verifiable. AC-5d: a `skipped` exercise is listed and marked, not omitted. |
| R-6 | The planned-target line is one shared formatter. `ExerciseView`'s rendered line is unchanged. | AC-6a: `ExerciseView` and the detail produce the same string for the same snapshot. AC-6b: for `4×4–6 · RIR 1–2 · rest 210s` the gym-mode header reads exactly as it did at `3733301`, including the omission of RIR when `plannedMinRir` is `null` and of rest when `plannedRestSeconds` is `null`. |
| R-7 | **More** carries a visible entry to the list, and the Calendar's `SessionRow` opens the detail of that Session. | AC-7a: `/more` shows a "Session history" entry that navigates to `/sessions`; the three data actions remain and still work. AC-7b: tapping a Session in a Calendar day panel lands on that Session's detail. AC-7c: back from a detail reached via the Calendar returns to the Calendar; back from one reached via the list returns to the list. AC-7d: back from `/sessions` returns to More. |
| R-8 | The bottom navigation is unchanged. | AC-8: `SECTIONS` still has four entries in the same order, and `AppShell`'s `SECTIONS[2]` still resolves to Routines. |
| R-9 | No runtime network request is introduced, and both screens work offline. | AC-9: with the service worker active and the network cut, the list and a detail render from IndexedDB. The network panel records no request from them. |
| R-10 | `docs/PRD.md` §38 states the verified truth after this change. | AC-10: `History \| Sessions` ✅ citing the new screen; `Platform \| PWA` ✅ citing `src/pwa/config.ts` and `vite.config.ts`; `Platform \| Offline` ✅; `Workout \| Rest timer` ✅ with §11.6's own "notifications are out of MVP" as the reason the 🟡 was wrong. The "Estado verificado…" line names the new date and `master`. |

## Contracts and Risk Controls

**Preserved contracts.** `SCHEMA_V1`, `SCHEMA_VERSION`, every type in
`src/domain/types.ts`, the backup document format, and `SECTIONS`' order are all
unchanged. `db/index.ts` remains the only persistence seam; `dexie` stays
imported only inside `src/db` (REQ-073). Layering holds: the read is `db/`, the
screens are `features/`, and nothing new lands in `domain/`.

**Changed contract — one added repository function** exported from
`db/index.ts`, plus one hook in `features/data/queries.ts`. Additive.

**Risk controls, in force because this screen renders the past:**

1. **The snapshot is the only source of a past target** (ADR 0002). The failure
   this guards is silent: a detail that reads through `plannedExerciseId` would
   show today's programme over last month's sets and look entirely plausible.
   AC-5a tests it behaviorally; AC-5c makes it structurally hard to reintroduce.
2. **Read-only.** Nothing on either screen writes to IndexedDB. A history screen
   that can mutate history is a way to lose data that has no undo.
3. **Local days, not UTC days** (REQ-013) — a Session started at 23:30 belongs
   to that local day, as `listSessionsBetween` already establishes.
4. **Every status visible.** Hiding `partial` or `in_progress` would make the
   list disagree with the Calendar about what happened.

## Quality Obligations

- **Tests** (`src/db/repositories/sessions.test.ts`, against `fake-indexeddb`):
  the new read's ordering across Routines and statuses (AC-1a), and the empty
  database (AC-1b). One focused test for AC-5a — mutate a `PlannedExercise`
  after the Session exists and assert `getSessionDetail`'s `planned*` values are
  the snapshotted ones. No domain module is added, so no domain suite grows.
- **QA (manual, in the browser)** — the flow, since AGENTS.MD verifies UI by
  running it: import a routine, log a session with one skipped exercise and one
  unplanned exercise, finish it; More → Session history → the session; check the
  targets, the sets, the chips; go back; open the same session from the Calendar;
  check back returns to the Calendar. Repeat with the network off (AC-9).
- **Static/build:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` —
  all four must pass.
- **Mutation:** none. `stryker.config.json`'s allowlist is `src/domain/**` and
  this change adds nothing there; the file is not edited.

## Change Surface

Expected edits:

| Path | Change |
|---|---|
| `src/db/repositories/sessions.ts` | Add the "every Session, newest first" read |
| `src/db/repositories/sessions.test.ts` | AC-1a, AC-1b, AC-5a |
| `src/db/index.ts` | Re-export it |
| `src/features/data/queries.ts` | One hook over it |
| `src/features/history/SessionHistoryScreen.tsx` (new) | The list (R-2, R-3) |
| `src/features/history/SessionDetailScreen.tsx` (new) | The detail (R-4, R-5) |
| `src/features/ui/format.ts` | The extracted planned-target formatter (R-6) |
| `src/features/session/ExerciseView.tsx` | Use it; rendered output unchanged |
| `src/features/calendar/CalendarScreen.tsx` | `SessionRow` becomes a link (R-7b) |
| `src/features/more/MoreScreen.tsx` | The "Session history" entry (R-7a) |
| `src/features/shell/AppShell.tsx` | Top bar + back for the `/sessions` family (R-2a, R-7c, R-7d) |
| `src/App.tsx` | The two routes; amend the header comment |
| `docs/PRD.md` §38 | R-10 |

Do not touch:

- `src/db/schema.ts` — the `startedAt` index already exists.
- `src/domain/` — no derivation is added; this change renders stored rows.
- `src/features/shell/sections.ts` and `BottomNav` — R-8.
- `src/features/session/` beyond `ExerciseView`'s one substituted line. Gym
  mode's behavior does not change.
- `src/db/repositories/history.ts` — `getSessionDetail` is used as it stands.
- `stryker.config.json`.

## Planning Decision

**Plan required: No.**

Reason: one linear sequence with a single owner (read → hook → screens → routes
→ entries → docs), no contract to freeze before parallel work, no migration, no
rollout, and no writer/reader pair that could silently disagree. The one real
correctness constraint (ADR 0002) is a rule the spec states, not an ordering
problem a plan would solve.

## Stop Conditions

Implementation must stop rather than invent behavior if:

- rendering a target on the detail would require reading `PlannedExercise` —
  the snapshot is incomplete and that is an ADR 0002 problem, not a screen one;
- the list needs a new index, a table, or a `SCHEMA_VERSION` bump;
- the list needs pagination to stay usable (see the stated ceiling);
- `ExerciseView`'s line cannot be reproduced by the shared formatter;
- a requirement would need the `Progress` screen, the exercise catalog screen, or
  a §32 setting — all excluded scope;
- making history coherent seems to need an edit or delete action;
- unrelated working-tree changes overlap the write set above.
