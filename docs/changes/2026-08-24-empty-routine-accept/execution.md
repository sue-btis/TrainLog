# Empty routine accepted — Execution

## Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Base | `master` at `49efc78` |
| Working tree at start | Clean in `src/`; untracked `docs/PRD-DMS.md` and two change folders |
| Date | 2026-08-24 |

Pre-change health, executed: `pnpm typecheck` pass, `pnpm test` 456 pass,
`pnpm lint` pass.

## Preflight Verdict

Proceed. Three files, one subsystem, no schema, no repository, no dependency.
The unrelated untracked `docs/PRD-DMS.md` was left untouched throughout.

## Executed Work

Sequential, single writer. No subagents, no worktrees.

1. **`src/domain/routine-file/validate.ts`** — added
   `'routine_has_no_workouts'` to `SemanticIssueCode`, and the arity check at
   the top of `validateRoutineFile`, before the workout loop. The check carries
   a comment recording *why* the routine-level case is flagged while the
   Workout-level one is not, because the asymmetry is the part a later reader
   would otherwise "fix".
2. **`src/features/import/issues.ts`** — added the `FIX` entry and folded
   `routine_has_no_workouts` into the existing `suggested_day_shared` case of
   `problemOf`, which already returns `issue.message` verbatim for issues whose
   problem statement does not read off an exercise.
3. **`src/domain/routine-file/validate.test.ts`** — two cases: the empty
   routine is flagged with no paths (AC-1), and a Workout with no exercises is
   still clean (AC-2). The second is the guard against someone later
   "completing" the check by rejecting empty Workouts too.

### The two UI edits were compiler-forced, as ASM-2 predicted

Neither was found by grep. `FIX` is a `Record<SemanticIssueCode, string>` and
`problemOf` is an exhaustive switch with no `default`, so adding the union
member broke `pnpm typecheck` in exactly those two places and nowhere else.
That is also the evidence that no third consumer of `SemanticIssueCode` exists.

### `paths: []` was verified, not assumed

DEC-2 rested on two claims about existing code. Both were read before relying
on them:

- `indexIssues` iterates `for (const path of issue.paths)`
  (`issues.ts:44-56`) — an empty array contributes nothing to the index, so no
  field is marked.
- `jumpToIssue` opens `const path = issue.paths[0]; if (path === undefined)
  return;` (`ImportWizard.tsx:187-188`) — clicking the issue in the action bar
  is inert rather than a crash.

`hasIssuesUnder` reads the index, so it is unaffected for the same reason.

## Integration Gates

| Gate | Result |
|---|---|
| `pnpm typecheck` | Pass — both tsc projects |
| `pnpm test` | Pass — 29 files, **458** tests (456 before, +2) |
| `pnpm lint` | Pass — no output |
| `pnpm build` | Pass — built in 3.56s, PWA precache 23 entries |

The build's "chunks larger than 500 kB" warning is pre-existing and unrelated;
it is emitted by the same build on `49efc78` untouched.

## Requirement Status

| ID | Status | Evidence |
|---|---|---|
| REQ-1 | Done | `validate.ts` — union member added |
| REQ-2 | Done | `validate.ts` — one issue, `paths: []`, guarded on `length === 0` |
| REQ-3 | Done | message names the problem; `FIX` supplies the recovery |
| REQ-4 | Done | 456 pre-existing tests unchanged and passing |
| AC-1 | Done | new test: code is `routine_has_no_workouts`, paths `[]` |
| AC-2 | Done | new test: a Workout with no exercises yields `[]` |
| AC-3 | Done | typecheck / test / lint / build all pass |
| AC-4 | **Partial — see Deviations** | Follows from REQ-2 and the unchanged gate at `ActionBar.tsx:62`, established by reading, not by driving the wizard |

## Deviations

**AC-4 was not verified through the running UI.** The spec anticipated verifying
it by running the wizard, since no DOM test environment exists. That was not
possible here: reaching the empty-routine state requires attaching a `.yaml`
file to the wizard's file input, and this session's browser tooling exposes no
file-upload capability. Driving it with a synthetic `File` through injected
JavaScript would have verified my own synthetic event, not the lifter's path.

What *is* established: `validateRoutineFile` returns exactly one issue for an
empty routine (unit test), and `blocked = issues.length > 0`
(`ActionBar.tsx:62`) with `disabled={blocked || accepting}` (`:202`) is
unchanged by this diff. The inference is one line long and the line was read.
It is an inference nonetheless, and is recorded as one.

## Ownership / Contract Conflicts

None. `SemanticIssueCode` is a shared contract, but it is additive here and the
compiler proved the consumer set is exactly two.

## Blockers

None.

## Independent Verification Readiness

Ready. Diff range: `git diff 49efc78 -- src/`, three files. The untracked
`docs/PRD-DMS.md` is unrelated pre-existing work and is outside the range.
