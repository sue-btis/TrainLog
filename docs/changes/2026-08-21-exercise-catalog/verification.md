# Exercise Catalog — Verification

Verdict: **Pass with accepted limitations**
Re-verified after remediation — see Remediation.
Size: medium
Reliability: strict

## Audit Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Declared base | `8b5074c` |
| Audited head / working tree | `8b5074c`, dirty on `change/exercise-catalog` (change uncommitted) |
| Diff range | `git diff 8b5074c` plus two untracked paths: `src/features/exercises/`, `docs/changes/2026-08-21-exercise-catalog/` |
| Verification date | 2026-08-21 |

Diff inspected directly, not taken from `execution.md`. Six tracked files
(+163 / −10) and three untracked files, enumerated below.

## Requirement Compliance

| Req / AC | Implementation Evidence | Independent Check | Result |
|---|---|---|---|
| R-1 / AC-1 | `App.tsx:48` adds `/exercises` immediately above `/exercises/:exerciseId` | Both routes resolve; neither shadows the other (`/exercises` → list, `/exercises/box-squat` → history) | Pass |
| R-2 / AC-2 | `ExerciseCatalogScreen.tsx:45` `[...(user ?? []), ...CATALOG]` | 97 rows on a live install = 96 catalog + 1 user Exercise, each once | Pass |
| R-3 / AC-3 | `groupExercises` + `localeCompare` | 12 groups, alphabetical, each headed with `plural(n,'exercise')` | Pass |
| R-4 / AC-4 | `exercise.category \|\| UNCATEGORIZED`, sorted last | Live install holds `Sandbag Bear Hug Carry` with `category: null`; renders in a trailing group of 1. Ordering and the empty-string case are now both pinned by tests | Pass |
| R-5 / AC-5 | `normalizeExerciseName` on both needle and name | `"  front   SQUAT "` → 1 group, `/exercises/front-squat`; other 11 groups unrendered | Pass |
| R-6 / AC-6 | `equipment === null \|\| exercise.equipment === equipment` | `barbell` → 34 rows, zero non-barbell; `uncategorized` (equipment `null`) correctly excluded; default restores 97 | Pass |
| R-7 / AC-7 | Both predicates in one `filter` | `squat` + `barbell` → 5 rows; trigger still `barbell`, field still `squat` | Pass |
| R-8 / AC-8 | `Link` to `/exercises/${id}` | Box Squat → header **"Box Squat"**, *"not performed yet"*, *"No history yet"*. Catalog name resolved, not the `'Exercise'` fallback | Pass |
| R-9 / AC-9 | Empty-state `WELL` | `cable moon walk` → 0 rows, empty state quoting the query | Pass |
| R-10 / AC-10 | `groupExercises` in `src/domain/catalog/index.ts` | No React or Dexie import; `features → db → domain` intact. **11 focused tests**, red→green evidence recorded for both the original function and the remediation | Pass |
| R-11 / AC-11 | `MoreScreen.tsx:167` third `Link`, above `SettingsSection` | More lists `/routines`, `/sessions`, `/exercises` in order | Pass |
| R-12 / AC-12 | New `catalog` predicate, matched exactly (`=== '/exercises'`) so it cannot collide with the `startsWith('/exercises/')` family | `/exercises` → "Exercises" / "Back to More". Regression across all five prior families: `/routines` "Routines"/Back to More; `/routines/:id` "Routine"/link to Routines; `/sessions` "History"/Back to More; `/sessions/:id` "Session"/retracing Back; `/exercises/:id` "Exercise"/retracing Back | Pass |
| R-13 / AC-13 | `sections.ts` not in the diff | 4 tabs on every screen visited | Pass |
| R-14 / AC-14 | No fetch/XHR in the new code; no repository write path | Every request is a Vite dev module load on `localhost`; no external host. `exercises` object store still holds exactly **1 row** after the full QA pass | Pass |
| R-15 / AC-15 | §10, §38, §39 edited | §10 lists `Exercises` under More; §39 no longer carries it as backlog; §38 records it as built. **Placement deviates — see D-1.** | Pass with deviation |

## Automated Checks

| Command | Result | Covers | Evidence |
|---|---|---|---|
| `pnpm typecheck` | Pass | all | both tsconfigs clean |
| `pnpm lint` | Pass | all | eslint clean; repo has no Prettier config, so formatting is unenforced |
| `pnpm test` | Pass | R-3…R-7, R-10 | **26 files, 384 tests**, 0 failures |
| `pnpm build` | Pass | R-1, R-14 | 0 errors; the `>500 kB chunk` notice is Vite's standing warning, present before this change |
| `vitest --coverage` on `src/domain/catalog/**` | Pass | R-10 | see Quality Metrics |
| `stryker run --mutate src/domain/catalog/index.ts` | Pass | R-10 | **88.89%**, above the repo's own `break: 80` |

Stryker was run via CLI `--mutate` override. `stryker.config.json` was **not**
edited, per the spec's instruction not to widen a gate mid-change.

## QA

Live, on the dev server at `:5233`, viewport 375 × 812, against an install that
already carried an imported routine. Driven through the DOM (`read_page`,
`form_input`, dispatched events) — see L-1.

1. Navigate `/exercises`. Expected: grouped list, title "Exercises". Actual: 97 rows, 12 groups + `uncategorized`, title "Exercises", back "Back to More".
2. Search `"  front   SQUAT "`. Expected: Front Squat only. Actual: 1 group, `/exercises/front-squat`.
3. Search `cable moon walk`. Expected: empty state. Actual: 0 rows, empty state naming the query.
4. Clear search, select equipment `barbell`. Expected: barbell only. Actual: 34 rows, zero non-barbell, `uncategorized` gone.
5. Add search `squat`. Expected: composition. Actual: back-, box-, front-, overhead-, pause-squat; both controls retain their values.
6. Tap Box Squat. Expected: its history. Actual: "Box Squat" / "No history yet".
7. Back. Expected: return to the list. Actual: `/exercises`, 97 rows.
8. Visit `/more`, `/routines`, `/routines/:id`, `/sessions`, `/sessions/:id`, `/today`, `/calendar`, `/progress`. Expected: unchanged titles, back controls, 4 tabs. Actual: all unchanged.
9. Read the `exercises` object store. Expected: unchanged. Actual: 1 row, `Sandbag Bear Hug Carry`.

## Ownership and Scope

| Workstream | Assigned Write Set | Actual Files | Compliant? |
|---|---|---|---|
| Whole change | the 8 paths named in `spec.md` | `docs/PRD.md`, `src/App.tsx`, `src/domain/catalog/index.ts`, `src/domain/catalog/index.test.ts`, `src/features/more/MoreScreen.tsx`, `src/features/shell/AppShell.tsx`, `src/features/exercises/ExerciseCatalogScreen.tsx`, `docs/changes/2026-08-21-exercise-catalog/*` | Yes |

Confirmed **not** touched: `pnpm-lock.yaml`, `package.json`,
`stryker.config.json`, `vitest.config.ts`, `sections.ts`, `catalog/data.ts`,
`ExercisePicker.tsx`, `db/**`, `features/history/**`.

## Contract / Integration Review

- **Frozen contract fidelity:** `CATALOG`, `CATALOG_ROWS` and every slug
  unchanged. DEC-007 preserved — no code path writes the catalog to the table.
  The four-tab rule holds; `SECTIONS` is untouched.
- **Integration gate:** the new route family is matched by **exact equality**,
  the one construction that cannot collide with the existing `startsWith`
  prefix branch. Verified live across all six families.
- **Generated / migration / project / lockfile:** none in the diff. No schema,
  no Dexie version, no migration — the change reads build-time data only.

## Quality Metrics

Scope: `src/domain/catalog/index.ts` (the only changed production logic; the
screen is React and outside both tools' configured scope).

- Changed-line coverage: **100%** (25/25) — strict target 90%.
- Changed-branch coverage: **100%** (12/12) — strict target 80%.
- Statements: **100%** (29/29).
- Mutation: **88.89%** — strict target 70%; repo break threshold 80.
- Surviving mutants: **6**, of which **4 are pre-existing code**; classified below.
- Flaky/skipped tests affecting scope: none.

### Surviving mutants

| Location | Mutant | Classification |
|---|---|---|
| `:23`, `:39`, `:41` (×4) | object/arrow literals in `CATALOG`, `byId`, `byNormalizedName` | **Pre-existing**, outside this change |
| `:93:8`, `:93:19` | `needle === ''` short-circuit removed | **Equivalent.** `String.includes('')` is true for every string, so the guard is an optimization, not behavior. No assertion can kill it without asserting on performance. |
| — | the sort-comparator guards and the `UNCATEGORIZED` literal | **Killed.** Survived on the first pass; see the Remediation section |

## Missing / Partial Requirements

None. All 15 requirements have both implementation and validation evidence.

## Extra / Unrequested Changes

None. Every hunk maps to a requirement.

## Security / Tenant / Permission / Compatibility Concerns

None. The change is read-only over build-time data, adds no persistence, no
network call, no permission surface, and no stored-data contract. Offline
behavior (NFR-01) is preserved.

## Limitations or Deviations

**D-1 — R-15 placement deviation.** The spec asked for a **row in the §38
table**; §38 is scoped `MVP 0.1` and this screen is a V1.0 item, so its closing
line was rewritten to record the screen as built instead. Requirement intent
met, literal placement not. Accepted here as documentation-only; needs the
change owner's nod.

**L-1 — visual fidelity asserted, not observed.** The Browser pane was not
displayed, so screenshots and real pointer input were unavailable; QA ran
through the DOM. Layout, spacing, the One Surface Rule and the type scale are
therefore inferred from the shared tokens the screen uses (`CARD`, `ROW_LIST`,
`ROW`, `WELL`, `LABEL`), **not seen**. The equipment `Select` was opened and
operated by keyboard because Radix ignores synthetic pointer events; pointer
operation is inherited from Radix and unverified here.

**L-2 and L-3 were found by this verification and have been fixed.** See
Remediation; both are closed and re-verified.

**Cosmetic — fixed.** `AppShell.tsx`'s `title` ternary was left indenting
inconsistently by the new arm, and the comment above `back` still spoke of one
list where two now qualify. Both cleaned up; no behavioural change, all four
gates re-run green after.


## Remediation

Two findings from the first verification pass were fixed and re-verified in
place, at the change owner's request.

**L-3 — an empty-string `category` opened a group with a blank heading.**
`?? UNCATEGORIZED` catches `null` and `undefined`, not `''`. Confirmed by probe
before the fix: `groupExercises([{…, category: ''}], '', null)` returned
`[{category: ''}]`, which renders an `<h2>` with no text, sorted before every
real group. Reachable, not hypothetical: `routine-file/schema.ts:57` is
`z.string().optional()` with no `.min(1)`, `validate.ts` has **zero** checks on
`category`, and `to-domain.ts:80` passes it through unchanged, so a YAML naming
`category: ""` reaches the screen.

Fix: `exercise.category || UNCATEGORIZED`, with the reason in a comment.
Regression test proven red against the old code —
`AssertionError: expected [ '' ] to deeply equal [ 'uncategorized' ]` — then
green.

**L-2 — the "trailing group" rule was not pinned by any test.** Coverage left
`index.ts:108` unexecuted and three mutants survived on the sort comparator. The
first cause was input order: the original test appended the uncategorized entry,
where `'uncategorized'` already sorts after `'triceps'` on its own, while
production prepends it (`[...user, ...CATALOG]`). Adding that order closed the
coverage gap.

The mutants, however, survived even then — which showed the deeper cause:
against the twelve categories the catalog ships, alphabetical order puts
`'uncategorized'` last **by luck**, so the guards can be deleted without any
observable change. They only bite behind a category sorting after `'u'`, and a
routine file names its own categories, so that is reachable. A test using
`'wrists'`, in both input orders (each order exercises only one of the two
guards), makes the rule load-bearing and kills both mutants.

A third test asserts the literal `'uncategorized'`, killing the constant mutant —
the label is a user-visible heading, so its value is behavior.

Result: coverage 91.66% → **100%** branch, mutation 80.77% → **88.89%**, and every
survivor in new code is now the one equivalent pair at `:93`. Suite 380 → **384**
tests, all green; all four gates re-run.

No UI file changed in remediation, and the live install's exercise carries
`category: null`, which behaves identically under `??` and `||` — so the browser
QA above still holds without a re-run.

## Merge Risk

**Low.**

Behavior is additive and read-only; every prior route family was regression-
checked live; the write set is exactly as specified with no lockfile, config or
generated file touched; all four repository gates pass, and both coverage and
mutation clear the strict profile and the repo's own thresholds. The two findings this
verification raised (L-2, L-3) were fixed and re-verified. What remains is a
documentation placement (D-1) and an unobserved visual layer (L-1). The two
cosmetic nits in `AppShell` were cleaned up.
