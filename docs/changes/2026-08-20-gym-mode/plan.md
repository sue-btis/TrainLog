# Gym Mode Implementation Plan

Status: Ready
Size: medium
Reliability: strict
Base: `master@6dbb8d9`

## Preflight Baseline

- Working tree: clean except `docs/changes/2026-08-20-gym-mode/` (this change's own
  artifacts, untracked). No unrelated user work overlaps the write set.
- Spec: `docs/changes/2026-08-20-gym-mode/spec.md`, status `Ready for planning`.
- Audit: N/A — medium. The technical-spine audit
  (`docs/changes/2026-08-18-technical-spine/audit.md`) already covers this surface
  and the spec cites it directly.
- Required commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`,
  `pnpm dev` (for the QA checks; UI is verified by running it, per AGENTS.MD).
- Relevant overlaps: none. `change/app-shell` is merged; `src/features/harness/`
  is touched only by this change.

## Dependency Graph

### True Dependencies

| ID | Dependency | Why It Must Precede | Unlocks |
|---|---|---|---|
| D-1 | Pure domain functions before any persistence | The repository writes what a domain function produced; no repository derives values (DEC-008, AGENTS.MD) | T-2 |
| D-2 | Transactional session start before the screen | The screen reads ExerciseSessions that do not exist until R-2 is written; without it every screen read returns empty and nothing is verifiable | T-3 |
| D-3 | Screen frame + set logging before rest timer | The timer starts *from* a completed set (R-7); with no way to log a set there is nothing to start it | T-4 |
| D-4 | Screen frame before deviations | Extra sets, skip, reorder and the unplanned picker all attach to the exercise view | T-5 |
| D-5 | Everything above before deleting the harness | The harness is the only way to write a Session until T-3 works. Deleting it early removes the fallback for verifying T-1 and T-2 by hand | T-6 |

### Artificial Dependencies Removable by Gate 0

None. Every contract this change needs is already frozen in the tree —
`src/domain/types.ts`, `src/db/schema.ts` v1, and the `DESIGN.md` component specs.
Nothing has to be materialized before work can start.

## Execution Strategy

Topology: **Sequential** (single agent, one working tree).

Reason: the tasks form a strict chain (D-1…D-5) with no two independently
implementable branches. `src/features/ui/styles.ts`, `src/db/index.ts` and
`src/App.tsx` are each written by more than one task, so concurrent writers would
collide on shared files that have no integration owner. The change is ~12 files;
worktree isolation would cost more than it saves.

## Gate 0

Required: **No**.

## Ownership Map

| Task | Mode | Requirement IDs | May Read | May Edit | Must Not Edit | Depends On |
|---|---|---|---|---|---|---|
| T-1 Domain | write | R-2 (values), R-7 (arithmetic), R-10 (renumbering) | `src/domain/**`, `spec.md` | `src/domain/session/index.ts`, `src/domain/session/index.test.ts` | `src/db/**`, `src/features/**`, `src/domain/progression/**`, `src/domain/scheduling/**` | — |
| T-2 Persistence | write | R-2, R-3, R-10 (writes) | `src/domain/**`, `src/db/**` | `src/db/repositories/sessions.ts`, `src/db/repositories/sessions.test.ts`, `src/db/repositories/exerciseSessions.ts`, `src/db/index.ts` | `src/db/schema.ts`, `src/db/database.ts`, `src/db/repositories/completedSets.ts`, all other repositories, `src/features/**` | T-1 |
| T-3 Screen + logging | write | R-1, R-4, R-5, R-6 | all of `src/`, `DESIGN.md` | `src/features/session/**` (new), `src/features/ui/styles.ts`, `src/features/data/queries.ts`, `src/features/today/TodayScreen.tsx`, `src/App.tsx` | `src/db/**`, `src/domain/**`, `src/styles/theme.css`, `src/features/harness/**` | T-2 |
| T-4 Rest timer + wake lock | write | R-7, R-8 | all of `src/`, `DESIGN.md` | `src/features/session/**`, `src/features/ui/styles.ts` | `src/db/**`, `src/domain/**`, `src/styles/theme.css` | T-3 |
| T-5 Deviations | write | R-9, R-10, R-11 | all of `src/` | `src/features/session/**`, `src/features/data/queries.ts`, `src/features/ui/styles.ts` | `src/db/repositories/plannedExercises.ts`, `workouts.ts`, `routines.ts`, `src/domain/**` | T-3, T-2 |
| T-6 Finish, recovery, harness | write | R-12, R-13, R-14 | all of `src/` | `src/features/session/**`, `src/features/today/TodayScreen.tsx`, `src/App.tsx`, delete `src/features/harness/**` | `src/db/**`, `src/domain/**` | T-3, T-4, T-5 |

Shared files and their single writer per task, in order: `src/db/index.ts` → T-2
only. `src/features/ui/styles.ts` → T-3, then T-4, then T-5, never concurrently.
`src/App.tsx` → T-3 adds the route, T-6 removes `/harness`.
`src/features/today/TodayScreen.tsx` → T-3 adds `Start workout`, T-6 adds
`Resume` and removes the harness link.

## Generated / Migration / Project / Lockfile Ownership

| File / Pattern | Owner | When It May Change | Validation |
|---|---|---|---|
| `package.json`, `pnpm-lock.yaml` | Nobody | Never — the spec excludes new dependencies (Offline Rule) | `git diff --exit-code package.json pnpm-lock.yaml` |
| `src/db/schema.ts` | Nobody | Never — schema v1 is frozen and the file forbids it | `git diff --exit-code src/db/schema.ts` |
| `src/styles/theme.css` | Nobody | Never — no new token is expected | `git diff --exit-code src/styles/theme.css` |

## Wave 1 — A session can be started and its sets survive a reload

Goal: the durable spine of gym mode — start, snapshot, log, persist, recover.
Requirements: R-1, R-2, R-3, R-4, R-5, R-6, R-7, R-8.
Acceptance: AC-1…AC-17.

### T-1 — Domain: the values gym mode needs

- Assigned requirements: R-2 (the values), R-7 (the arithmetic), R-10 (renumbering).
- May edit: `src/domain/session/index.ts`, `src/domain/session/index.test.ts`.
- Steps:
  1. Write the failing tests first: snapshot fidelity and `order` for the
     composite start including the empty-Workout case; reorder contiguity and the
     no-op at each end; rest remaining across elapsed, exhausted, added-time and
     the negative clamp.
  2. Add the three pure functions. The composite start calls the existing
     `startSession` and `startPlannedExercise` rather than restating them; every
     instant stays a parameter (DEC-008).
  3. `pnpm test src/domain/session`, `pnpm typecheck`.
- Evidence: test output naming the new cases; the diff touching two files.
- Stop if: a value cannot be produced without reading the clock or the database;
  reorder would need to write anywhere but `ExerciseSession.order`.

### T-2 — Persistence: one transaction, N+1 rows

- Assigned requirements: R-2, R-3, R-10 (the writes).
- May edit: `src/db/repositories/sessions.ts`, `src/db/repositories/sessions.test.ts`,
  `src/db/repositories/exerciseSessions.ts`, `src/db/index.ts`.
- Steps:
  1. Write the failing `fake-indexeddb` tests: N ExerciseSessions plus the Session
     written together; the second-session refusal still raised **inside** the
     transaction; a forced mid-write failure leaving neither behind (AC-5).
  2. Add the transactional start alongside `createSession` — the existing
     `createSession` keeps its signature and behavior. Add the bulk order write to
     `exerciseSessions.ts`. Re-export both from `src/db/index.ts`.
  3. `pnpm test src/db`, `pnpm typecheck`.
- Evidence: test output for AC-3, AC-5, AC-6; `git diff --exit-code src/db/schema.ts`
  clean.
- Stop if: the write needs an index that v1 does not declare.

### T-3 — The screen: one exercise, and a set that lands on disk

- Assigned requirements: R-1, R-4, R-5, R-6.
- May edit: `src/features/session/**` (new), `src/features/ui/styles.ts`,
  `src/features/data/queries.ts`, `src/features/today/TodayScreen.tsx`,
  `src/App.tsx`.
- Steps:
  1. Add the `/session` route outside `AppShell` — it renders its own frame and
     no `BottomNav` (§21).
  2. Add the Dome and set-logger class vocabulary to `src/features/ui/styles.ts`,
     built from existing tokens only (Token-Only Rule). No colour, radius or
     shadow literal enters a `.tsx`.
  3. Build the exercise view: name, target line, rest, previous performance
     (§11.8), the Dome strip, the stepper readouts, `COMPLETE SET`. Reads go
     through hooks in `src/features/data/queries.ts`; no component imports Dexie.
  4. Open the readouts on `suggestLoad` where it returns a suggestion, on the
     previous load where it returns `null` but history exists, empty otherwise.
  5. Wire `Start workout` on Today to T-2's transactional start.
  6. `pnpm typecheck`, `pnpm lint`; QA in `pnpm dev`: start a session, log a set,
     **reload the page** and confirm the set is still there (AC-12).
- Evidence: the reload check, described with what was seen. Screenshot of the
  exercise view.
- Stop if: a target would have to be read through `plannedExerciseId`; a design
  value has no token.

### T-4 — Rest timer and wake lock

- Assigned requirements: R-7, R-8.
- May edit: `src/features/session/**`, `src/features/ui/styles.ts`.
- Steps:
  1. Build the timer shell to `DESIGN.md:908-912`: `live-ink` surface, white
     `type-clock`, a `scrim` track with a `live-rail` fill that **scales** — the
     Don'ts forbid animating width or height.
  2. Drive the display from T-1's arithmetic against the last set's stored
     `completedAt`. The ticking display is component state; the *remaining time*
     is never accumulated from ticks (§35).
  3. Pause, reset, skip, add time. Pause and added time are component state (A-3).
  4. Request `Screen Wake Lock` while the session screen is mounted, re-request on
     `visibilitychange`, release on unmount, and swallow absence or refusal
     silently.
  5. `pnpm typecheck`, `pnpm lint`; QA: background the tab 60s during a 180s rest
     and read the remaining time (AC-13); reload mid-rest (AC-14).
- Evidence: the two timing checks with the numbers observed.
- Stop if: correctness would need a persisted field (A-3 false) or a `Settings`
  field (A-2 false).

### Wave 1 Integration Gate

- Must inspect: `git diff master@6dbb8d9` in full — ownership compliance, and that
  `src/db/schema.ts`, `src/styles/theme.css`, `package.json` and `pnpm-lock.yaml`
  are untouched.
- Checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Completion: AC-1, AC-3…AC-14, AC-16, AC-17 demonstrated. AC-2 and AC-15 may
  remain open into Wave 2 (Resume belongs to T-6).
- Stop if: any check fails, or a file outside the ownership map changed.

## Wave 2 — The session can deviate, finish, and stand alone

Goal: the deviations of FR-14/FR-15, the finish, and the harness's removal.
Requirements: R-9, R-10, R-11, R-12, R-13, R-14.
Acceptance: AC-2, AC-15, AC-18…AC-29.

### T-5 — Deviations

- Assigned requirements: R-9, R-10, R-11.
- May edit: `src/features/session/**`, `src/features/data/queries.ts`,
  `src/features/ui/styles.ts`.
- Steps:
  1. Extra sets — the Dome strip grows past `plannedSets` with an add affordance;
     fewer sets needs no code, only a way to move on.
  2. Skip — `skipExercise` + `saveExerciseSession`, both existing.
  3. Reorder — T-1's renumbering + T-2's bulk write. **Verify `plannedExercises`
     is untouched afterwards** (AC-20).
  4. Unplanned exercise — a picker over `CATALOG` and `listUserExercises`, then
     `startUnplannedExercise` + `addExerciseSession`. No suggestion is shown for
     it; sets log in `getDefaultUnit` (A-4). No Exercise is created (A-1).
  5. Mark every deviation with a chip in the hue of its state; nothing blocks and
     nothing errors (AC-19b).
  6. `pnpm typecheck`, `pnpm lint`; QA all four.
- Evidence: the Routine detail screen shown unchanged after a reorder.
- Stop if: R-11 needs an Exercise to be created (A-1 false); reordering would
  write to `plannedExercises`, `workouts` or `routines`.

### T-6 — Finish, recovery, and the harness's removal

- Assigned requirements: R-12, R-13, R-14.
- May edit: `src/features/session/**`, `src/features/today/TodayScreen.tsx`,
  `src/App.tsx`; delete `src/features/harness/**`.
- Steps:
  1. Finish via the existing `finishSession` + `saveFinishedSession`. Finishing
     with a `pending` exercise asks first and names the consequence (§37 wording,
     `DESIGN.md` destructive-armed pattern).
  2. Today: `Resume session` when one is open, `Start workout` otherwise; remove
     the alert's harness link (AC-2).
  3. `/session` with no open Session resolves — it does not render an empty
     screen or crash. Reopening with one open resumes it (AC-27).
  4. Delete `src/features/harness/` and the `/harness` route.
  5. `rg -n "harness" src/` returns nothing (AC-28).
  6. `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` (AC-29).
- Evidence: the `rg` output; the four commands green; a session finished with a
  pending exercise showing `partial`.
- Stop if: deleting the harness breaks a build or a test that depended on it.

### Wave 2 Integration Gate

- Must inspect: the full combined diff against `master@6dbb8d9`; the four
  never-touched files still clean; no component imports `dexie`.
- Checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, plus the full
  QA list of the spec's Quality Obligations.
- Completion: every AC-1…AC-29 mapped to observed evidence.
- Stop if: any acceptance cannot be demonstrated.

## Single-Agent Fallback

This *is* the sequential plan; no fallback is needed. Order: T-1 → T-2 → Wave 1
gate on T-3 → T-4 → Wave 1 gate → T-5 → T-6 → Wave 2 gate.

Reason: D-1…D-5 admit no reordering. Each task's output is the next one's input,
and the harness must survive until the screen replaces it.

## Requirement Execution Matrix

| Requirement | Wave / Task | Acceptance | Tests |
|---|---|---|---|
| R-1 | W1 / T-3 | AC-1 | QA |
| R-2 | W1 / T-1 + T-2 | AC-3, AC-4, AC-5 | domain unit, `fake-indexeddb` |
| R-3 | W1 / T-2 | AC-6 | `fake-indexeddb` |
| R-4 | W1 / T-3 | AC-7, AC-8 | QA |
| R-5 | W1 / T-3 | AC-9, AC-10 | QA |
| R-6 | W1 / T-3 | AC-11, AC-12 | QA (reload) |
| R-7 | W1 / T-1 + T-4 | AC-13, AC-14, AC-15 | domain unit, QA (background tab) |
| R-8 | W1 / T-4 | AC-16, AC-17 | QA |
| R-9 | W2 / T-5 | AC-18, AC-19, AC-19b | QA |
| R-10 | W2 / T-1 + T-2 + T-5 | AC-20 | domain unit, `fake-indexeddb`, QA |
| R-11 | W2 / T-5 | AC-21, AC-22, AC-23 | QA |
| R-12 | W2 / T-6 | AC-24, AC-25, AC-26 | QA |
| R-13 | W2 / T-6 | AC-27 | QA (reload) |
| R-14 | W2 / T-6 | AC-28, AC-29 | `rg`, all four commands |

## Final Verification

| Command / Check | Covers | Environment | Required Evidence |
|---|---|---|---|
| `pnpm test` | R-2, R-3, R-7, R-10 | Node + `fake-indexeddb` | full pass, new cases named |
| `pnpm typecheck` | all | Node | clean |
| `pnpm lint` | all | Node | clean |
| `pnpm build` | R-14, Offline Rule | Node | clean |
| `rg -n "harness" src/` | R-14 | shell | no output |
| `git diff --exit-code src/db/schema.ts src/styles/theme.css package.json pnpm-lock.yaml` | frozen contracts | shell | no diff |
| QA list in `spec.md` § Quality Obligations | R-1, R-4…R-9, R-11…R-13 | `pnpm dev` on a phone-sized viewport | what was done and what was observed, per check |

## Global Stop Conditions

- The spec and the repository contradict each other.
- A task needs to write outside its ownership row.
- Any of the four frozen files would have to change.
- A requirement needs a decision that was not approved.
- Unrelated user work appears in the working tree over a required write set.
