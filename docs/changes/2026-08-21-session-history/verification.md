# Session History Verification

Verdict: **Pass**
Base: `3733301` (`master`)
Head/working tree: dirty — the change is uncommitted
Reliability: strict

Diff range verified: working tree vs `3733301`. No unrelated work is present in
the tree, so the range is unambiguous.

## Requirement Evidence

| Requirement / AC | Evidence | Result |
|---|---|---|
| R-1 / AC-1a | `sessions.test.ts` "AC-1a — every Session, both Routines, every status, newest first" — three Sessions across two Routines and three statuses come back `['s-live','s-partial','s-old']` | Pass |
| R-1 / AC-1b | `sessions.test.ts` "AC-1b — an empty database lists nothing rather than failing" | Pass |
| R-1 / AC-1c | `listAllSessions` is `db.sessions.orderBy('startedAt').reverse().toArray()` — the declared index, no scan. `git diff` shows `db/schema.ts` untouched: no table, no index, no `SCHEMA_VERSION` change | Pass |
| R-2 / AC-2a | Browser: `/sessions` renders under a top bar reading **History** with the bottom nav present | Pass |
| R-2 / AC-2b | Browser: `Push — Vertical Strength / Wed, Aug 19 · 62 mins`; the older row carries a `PARTIAL` chip. Day comes from `formatLocalDate(new Date(startedAt))` — local, not UTC | Pass |
| R-2 / AC-2c | Browser: Aug 19 above Aug 12, matching AC-1a's order | Pass |
| R-2 / AC-2d | Browser: navigating list → detail issued **0** resource requests (`performance.getEntriesByType('resource')` delta). Source review: the screen calls `useAllSessions` + `useWorkoutsById` only — no per-row query | Pass |
| R-3 / AC-3a | Source review: `sessions === undefined` renders "Reading history…" before the empty branch is reached | Pass |
| R-3 / AC-3b | Browser, empty database: "No sessions yet" in the `WELL` pattern | Pass |
| R-4 / AC-4a | Browser: three exercises, eight sets, each `100 kg × 6 · RIR 2` in `setNumber` order | Pass |
| R-4 / AC-4b | Browser: Back Squat, Front Squat, Leg Press — `ExerciseSession.order` 0, 1, 2 | Pass |
| R-4 / AC-4c | Browser: `/sessions/nope` renders "No such session", not a blank screen or a crash | Pass |
| R-5 / AC-5a | **Two independent checks.** (1) `sessions.test.ts` "AC-5a — editing the template leaves a past Session reading its snapshot". (2) A divergent-fixture browser run added during verification: the `PlannedExercise` said `8×10–12`, no RIR, `rest 45s`; the snapshot said `4×4–6 · RIR 1–2 · rest 210s`; **the screen rendered the snapshot** | Pass |
| R-5 / AC-5b | Browser: the unplanned Leg Press shows `UNPLANNED` and no target line | Pass |
| R-5 / AC-5c | `grep -rn "usePlannedExercises\|listPlannedExercisesByWorkout\|repositories/plannedExercises" src/features/history/` → no matches | Pass |
| R-5 / AC-5d | Browser: the skipped Front Squat is listed with a `SKIPPED` chip and "No sets logged." | Pass |
| R-6 / AC-6a | One function, two call sites: `ExerciseView.tsx:117` and `SessionDetailScreen.tsx:131` both call `snapshotLine` | Pass |
| R-6 / AC-6b | Diff review: the extracted function emits the same pieces in the same order as the removed JSX (`sets×range`, then `· RIR …` only when both RIR bounds are non-null, then `· rest …s` only when rest is non-null). `format.test.ts` asserts all four combinations, including `3×8` | Pass |
| R-7 / AC-7a | Browser: `/more` shows "Session history" → `/sessions`; Export backup, Choose a backup file and Export history all still render | Pass |
| R-7 / AC-7b | Browser: the 19 Aug day panel renders `a[href="/sessions/se1"]` | Pass |
| R-7 / AC-7c | Browser: calendar → detail → Back → `/calendar`; list → detail → Back → `/sessions` | Pass |
| R-7 / AC-7d | Browser: `/sessions` → "Back to More" → `/more` | Pass |
| R-8 / AC-8 | `SECTIONS` still holds the same four entries in the same order and `SECTIONS[2]` still binds Routines in `AppShell`; `BottomNav.tsx` is unchanged. `sections.ts` carries a comment-only edit made after the verdict (Observation 3) — no entry, order or export changed | Pass |
| R-9 / AC-9 | **With the preview server stopped**, a cold reload of the deep path `/sessions/se1` rendered the full session from the service-worker cache and IndexedDB. One service worker registered; zero requests during in-app navigation | Pass |
| R-10 / AC-10 | `docs/PRD.md` §38: `History \| Sessions` ✅ naming the new screens and routes; `Platform \| PWA` ✅; `Platform \| Offline` ✅; `Workout \| Rest timer` ✅ citing §11.6's own out-of-MVP note; header line now "2026-08-21 (rama `master`)" | Pass |

## Automated Checks

| Command | Result | Notes |
|---|---|---|
| `pnpm typecheck` | Pass | Both `tsconfig.json` and `tsconfig.node.json` |
| `pnpm lint` | Pass | `eslint .`, clean |
| `pnpm test` | Pass | 26 files, 355 tests |
| `pnpm build` | Pass | Built in 1.62s; service worker emitted with 23 precache entries |
| `vitest run --coverage` scoped to the changed testable modules | Pass | See metrics |
| `pnpm exec stryker run` | Not run — not applicable | The `mutate` allowlist is `src/domain/**` and this change adds nothing there; `stryker.config.json` is untouched (spec § Quality Obligations) |

## QA Procedure

Environment: `pnpm preview` on port 4183, viewport 375×812. The Browser pane is
not displayed in this session, so pointer input and screenshots are unavailable;
every step below was driven and read through the accessibility tree, page text
and DOM inspection. Fixtures were written straight into IndexedDB and deleted
afterwards.

1. Open `/sessions` on an empty database.
   Expected: an empty state distinct from a loading state.
   Actual: "No sessions yet" under a top bar reading **History**, bottom nav present.
2. Seed two Sessions (one `completed` with a performed, a skipped and an unplanned
   exercise; one `partial`) and open `/sessions`.
   Expected: newest first, name, local day, duration, status chip.
   Actual: `Push — Vertical Strength / Wed, Aug 19 · 62 mins`, then the same
   Workout `Wed, Aug 12 · 40 mins` with `PARTIAL`.
3. Open the newest session's detail.
   Expected: exercises in order, targets from the snapshot, every set.
   Actual: Back Squat `4×4–6 · RIR 1–2 · rest 210s` with three sets; Front Squat
   `SKIPPED`, `3×8`, "No sets logged."; Leg Press `UNPLANNED` with one set.
4. **ADR 0002 adversarial check (added by verification).** Seed a Session whose
   `PlannedExercise` disagrees with its snapshot — template `8×10–12`, no RIR,
   `rest 45s`; snapshot `4×4–6 · RIR 1–2 · rest 210s`.
   Expected: the screen shows the snapshot.
   Actual: `4×4–6 · RIR 1–2 · rest 210s`. The template is not read.
5. `/sessions/nope`.
   Expected: a stated "no such session", not a blank screen.
   Actual: "No such session" with an explanation.
6. Navigate More → list → detail → Back, and Calendar day → session row → Back.
   Expected: back returns where the lifter came from in both cases.
   Actual: `/sessions` and `/calendar` respectively; `/sessions` → `/more`.
7. Stop the preview server and reload `/sessions/se1` cold.
   Expected: the session still renders.
   Actual: the full session rendered from cache and IndexedDB.

## Quality Metrics

- **Changed-line coverage (modules the repo tests by convention): 100%.**
  `db/repositories/sessions.ts` — 100% statements, 100% lines, 90% branches
  (the one uncovered branch is line 91, pre-existing, outside this change).
  `features/ui/format.ts` — `snapshotLine` fully covered; the file's remaining
  uncovered lines (19–25, 48–79) are the pre-existing `Intl` formatters.
- **Changed-branch coverage:** `snapshotLine`'s four branch combinations are all
  asserted; `listAllSessions` has none.
- **React components: 0% automated, by repository design.** AGENTS.MD states
  "UI is verified by running it", and no component-test harness exists. The two
  new screens, the shell wiring and both entry points were verified through the
  QA procedure above rather than by unit test. Not a gap introduced here.
- **Mutation:** not applicable — see Automated Checks.
- **Flaky or skipped tests in scope:** none.

## Diff and Scope Review

Files changed (14):

- `src/db/repositories/sessions.ts`, `sessions.test.ts`, `src/db/index.ts`
- `src/features/data/queries.ts`
- `src/features/history/SessionHistoryScreen.tsx` (new), `SessionDetailScreen.tsx` (new)
- `src/features/ui/format.ts`, `format.test.ts` (new — added during verification)
- `src/features/session/ExerciseView.tsx`
- `src/features/calendar/CalendarScreen.tsx`, `src/features/more/MoreScreen.tsx`
- `src/features/shell/AppShell.tsx`, `src/features/shell/sections.ts` (comment only), `src/App.tsx`
- `docs/PRD.md`

Scope and ownership: every path is in the spec's expected-edit list except two,
both recorded rather than absorbed — `format.test.ts`, added by verification as
evidence, and `sections.ts`, a comment-only edit applied after the verdict
(Observation 3). Of the "do not touch" list, `db/schema.ts`, `src/domain/`,
`db/repositories/history.ts` and `stryker.config.json` are untouched, and
`sections.ts` keeps every entry, its order and its exports intact.

Contract review: the persistence contract is additive only — one exported
repository function and two hooks. No table, index, `SCHEMA_VERSION`, domain type
or backup-document field changed, so a backup written before this change restores
unchanged after it. Layering holds: the read is `db/`, the screens are
`features/`, `domain/` is untouched, and no component imports Dexie.

Lockfiles, generated files, migrations: none changed. `pnpm-lock.yaml` untouched.

Unrelated changes: none.

### Observations (raised by this review; resolution below)

1. **`range` was left as an unused export.** After `ExerciseView` switched to
   `snapshotLine`, no module imported it — it survives only as an internal
   helper of `programmingLine` and `snapshotLine`. (`ExercisesStep.tsx` has its
   own local `range`.) **Fixed after the verdict, on the user's instruction:**
   the `export` keyword was dropped. Gates re-run green.
2. **`/sessions/` with a trailing slash** would be titled "Session" by the shell
   while React Router renders the list, because `sessionDetail` is decided by
   `pathname.startsWith('/sessions/')`. Cosmetic, and unreachable from any
   in-app link.
3. **`sections.ts`'s header comment understated its own constraint.** It
   explained that More is appended because `AppShell` reads `SECTIONS[2]`;
   `AppShell` now also binds `SECTIONS[3]`, so a future edit could have
   reasoned about the ordering rule from an incomplete statement of it.
   **Fixed after the verdict, on the user's instruction:** the comment now names
   both bindings. This is the one edit outside the spec's write set — comment
   only, no behavior, and it keeps a "do not touch" file's own documentation
   true. Gates re-run green.

## Limitations or Deviations

- **Verification added one test file**, `src/features/ui/format.test.ts`
  (4 assertions over `snapshotLine`). The strict profile requires unit tests for
  changed decision logic, and `snapshotLine` — three branches, newly extracted —
  had none, since `features/ui/` had no test file at all. It adds evidence only;
  no production behavior was modified. Recorded here rather than silently folded
  into the implementation record.
- **No screenshots.** The Browser pane is not displayed in this session, so the
  visual result was verified structurally (accessibility tree, page text, DOM)
  rather than pictorially. Nothing in the acceptance criteria depends on
  appearance, but a human should glance at both screens on a phone before
  release.
- **Browser QA ran against seeded IndexedDB fixtures, not the import wizard**,
  because the file picker cannot be driven without pointer input. The row shapes
  are covered independently by the repository tests, which build theirs through
  `startWorkout` / `logSet` / `finishSession`.
