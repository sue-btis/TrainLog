# Empty routine accepted — Verification

Verdict: **Pass, with one recorded limitation and one follow-up**
Size: quick
Reliability: strict

## Audit Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Declared base | `49efc78` |
| Audited head / working tree | `49efc78`, dirty — three tracked files in `src/` |
| Diff range | `git diff 49efc78 -- src/` — 3 files, 38 insertions, 1 deletion |
| Unrelated work in range | None. `docs/PRD-DMS.md` is untracked, unrelated, and untouched. |
| Verification date | 2026-08-24 |

## Requirement Compliance

| Req / AC | Implementation Evidence | Independent Check | Result |
|---|---|---|---|
| REQ-1 | `validate.ts:19` — union member added | Read the diff; additive, no member removed or renamed | Pass |
| REQ-2 | `validate.ts:57-63` — one issue, `paths: []`, guarded on `length === 0` | Guard sits *before* the workout loop, so it cannot interact with per-exercise issues | Pass |
| REQ-3 | `message` names the problem; `FIX` supplies the recovery | **Partially reachable — see below** | Pass with note |
| REQ-4 | 456 pre-existing tests unchanged | `pnpm test` — 458 pass, and the diff touches no existing test case | Pass |
| AC-1 | `validate.test.ts:19-25` | Re-ran; asserts both the code and the empty `paths` | Pass |
| AC-2 | `validate.test.ts:27-29` | Re-ran; a Workout with no exercises yields `[]` | Pass |
| AC-3 | typecheck / test / lint / build | All four re-run at verification time | Pass |
| AC-4 | `ActionBar.tsx:62` unchanged | **Inference, not observation — see Limitations** | Partial |

### REQ-3: the recovery sentence is real but currently unrendered

Traced independently rather than taken from `execution.md`. `describeIssue` has
exactly two call sites, and this issue reaches neither:

- `ExercisesStep.tsx:237-238` — reached via `issuesAt(issues, key)`, which reads
  the index. `indexIssues` iterates `issue.paths`, so a path-less issue is never
  indexed.
- `ScheduleStep.tsx:160` — a workout-scoped clash lookup, `suggested_day_shared`
  only.

So the `FIX` entry is required by the exhaustive `Record<SemanticIssueCode,
string>` but is not displayed today. What the lifter actually sees is
`issue.message` in the action bar's issue list (`ActionBar.tsx:168`) — which is
also all that every *other* issue shows there. The behaviour is consistent with
the rest of the wizard, not a regression.

**The recovery half is not missing from the screen; it was already there.**
`ExercisesStep.tsx:107-113` renders, for exactly this state:

> This routine declares no Workouts
> Add at least one Workout to the file and choose it again.

That is the finding worth recording: the wizard already *told* the lifter the
routine was empty and already told them how to fix it. What it did not do was
stop them accepting it. The UI was honest and the gate was not — which is why
this survived review.

The implementation's message deliberately echoes that heading's wording, so the
action bar and the step agree.

## Automated Checks

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass — both tsc projects |
| `pnpm test` | Pass — 29 files, 458 tests |
| `pnpm lint` | Pass — no output |
| `pnpm build` | Pass — built in 3.56s |

The build's 500 kB chunk warning is pre-existing on `49efc78` and unrelated.

## QA

Reachability of the original defect, stated honestly. It requires a file
declaring `workouts: []` explicitly — `workouts:` with nothing under it parses
as `null` and is already refused by the structural tier. That is an odd file to
hand-write, which is why it survived. It is not odd to *generate*: the app's own
primary onboarding path is `ConversionPromptButton`, which hands an assistant a
prompt to translate a PDF or a coach's message into this format
(`ConversionPromptButton.tsx:1-15`). A thin or unparseable source is exactly the
case where an assistant emits an empty list. Under DEC-C (from-scratch
authoring) the state becomes the *opening* state of the wizard.

## Ownership and Scope

Three files, all declared in the spec's Change Surface. No file outside it was
touched. No repository, no schema, no dependency, no migration.

## Contract / Integration Review

`SemanticIssueCode` is a shared contract. The change is additive, and the
consumer set was proven exhaustive by the compiler rather than by grep: `FIX` is
a total `Record` and `problemOf` is a `default`-less switch, so both failed
`tsc` until handled, and nothing else did. `stepOfIssue` needed no change — it
returns `1` for everything except `suggested_day_shared`, and step 1 is where
Workouts live.

## Missing / Partial Requirements

AC-4 only. See Limitations.

## Extra / Unrequested Changes

None. The diff is 38 insertions across the three declared files, of which 13
lines are the explanatory comment in `validate.ts` and 12 are the two tests.

## Security / Tenant / Permission / Compatibility Concerns

None. No stored data shape changes, so no migration and no `BACKUP_VERSION`
move. A backup taken before this change restores unaffected — validation runs on
routine *files*, never on restored rows.

## Limitations or Deviations

**AC-4 was not observed in a running browser.** Reaching the state needs a
`.yaml` file attached to the wizard's file input, and this session's browser
tooling has no file-upload capability. Injecting a synthetic `File` via
JavaScript would have tested my own event dispatch, not the lifter's path, so it
was not done and is not claimed.

What is established: the unit test proves `validateRoutineFile` returns exactly
one issue for an empty routine, and `blocked = issues.length > 0`
(`ActionBar.tsx:62`) feeding `disabled={blocked || accepting}` (`:202`) is
outside this diff and unchanged. The gap between those two facts is one
unchanged line. It is an inference, and it is recorded as one rather than
reported as a test.

## Follow-up Identified, Not Taken

`ConversionPromptButton`'s prompt states the format rules for an assistant, and
its header claims "every rule stated here is one the importer enforces". That
claim is still true — it is one-directional — but the prompt does not say a
routine needs at least one Workout, and the assistant-conversion path is the
most likely source of a file that now gets rejected. Adding that line would stop
the bad file being generated rather than catching it at the door.

Not done here: it is outside this spec's declared Change Surface, and widening
scope mid-implementation without saying so is how a quick change stops being
one. Recommended as a one-line follow-up.

## Merge Risk

Low. Additive union member, one guard clause, two compiler-forced UI lines, two
tests. No behaviour changes for any file that declares at least one Workout —
pinned by the 456 pre-existing tests and by AC-2.
