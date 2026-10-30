# TrainLog — repo rules

Offline-first training PWA. A YAML file declares the programme; the app executes
it, records what happened, and derives progression from that record.

- [CONTEXT.md](./CONTEXT.md) — the glossary. Binding on identifiers, not just prose.
- [docs/product/prd.md](./docs/product/prd.md) — product spec (FR/NFR/BR IDs). The design package is indexed by [docs/spec/manifest.yaml](./docs/spec/manifest.yaml). `§n` references below and in code point at the superseded [docs/PRD.md](./docs/PRD.md) until they are migrated.
- [docs/design/architecture/adr/](./docs/design/architecture/adr/) — why the load-bearing decisions were made.

## Vocabulary is binding

Name things as [CONTEXT.md](./CONTEXT.md) names them, in identifiers as well as in
prose. Three pairs carry most of the confusion:

| Use | Not |
| --- | --- |
| `Workout` — reusable template, no date | `RoutineDay`, "day", "split" |
| `Session` — one performed training | `WorkoutSession`, "workout" |
| `Placement` — a Workout assigned to a date | "schedule", "scheduled workout" |

When a term is settled during work, add it to `CONTEXT.md` in the same change.

## Architecture

```text
src/
├── domain/     pure TypeScript — no Dexie, no React
├── db/         Dexie schema + repositories — the only IndexedDB access
├── features/   React UI + hooks
└── pwa/        manifest + service worker
```

Dependencies point one way: `features → db → domain`. `domain/` imports from
neither.

Everything deterministic lives in `domain/`: YAML parsing and validation,
placement generation, target snapshotting, unit conversion, the progression
engine, next-in-rotation, missed-day derivation. Each is a function over data,
callable from a test with no database and no rendering.

Stack: Vite, React, TypeScript, React Router, Dexie with `dexie-react-hooks`,
Zod, `vite-plugin-pwa`, Vitest with `fake-indexeddb`.

React reads data through `useLiveQuery` inside feature hooks, which call
repositories. Session state lives in IndexedDB — every set persists as it is
logged (NFR-03), so an interrupted session resumes from the database (§35).
Component state holds only what dies with the screen, such as the ticking timer
display.

## Invariants

These are the rules a change can silently break. Check a change against them
before calling it done.

**Offline is the normal case.** The app makes no network requests at runtime.
The exercise catalog ships inside the build (§11.12). No backend, no account, no
telemetry.

**Planned and actual are separate.** When an exercise starts, its planned
targets are copied into the `ExerciseSession` (§14.7). History renders from that
snapshot — reading targets back out of a template would let a later edit rewrite
the past. See [ADR-003](./docs/design/architecture/adr/ADR-003-snapshot-planned-targets-on-session-start.md).

**Progression is derived.** A pure function over history, recomputed on demand,
with nothing stored. It reads by `exerciseId`, never `plannedExerciseId`, so
re-importing a corrected file preserves a lifter's history. The newest
`completed` Session feeds it, or a `partial` one in which that exercise was
fully performed (at least its snapshot's planned sets); `in_progress` never does.
`double_progression` judges the first N sets, where N and the rep ceiling come
from the previous Session's own snapshot and the rule and increment from the
exercise being opened, one step at a time (§29). Unplanned exercises get no suggestion.

**Placements and Sessions are independent.** A `Placement` is intent and can be
moved or deleted; a `Session` is what happened. Neither references the other. A
missed day is derived at query time — a past `Placement` with no `Session` of its
Workout on its date or earlier in its Monday-week — and is never written down. See [ADR-002](./docs/design/architecture/adr/ADR-002-dateless-workouts-with-user-owned-placements.md).

**Weight carries its unit.** Store the entered `weight` and `unit` plus a derived
`weightKg`. Every comparison, chart and progression step reads `weightKg`. The
set carries the unit it was logged in, and the Planned Exercise supplies the
default a new set opens on — a seed, not a constraint (§11.7). Distance follows the same rule on its own axis:
the entered `distance` and `distanceUnit` plus a derived `distanceM`. `Unit`
means weight and is never widened to carry distance.

**One module owns measurement.** `src/domain/measurement.ts` is the only place
that states, per measurement type, which value fields a set collects, what the
weight field means, which axis a target is stated on, which axis a record and
an advance are read on, and whether higher or lower is better on it. A second
statement of any of those five anywhere in the tree is a defect, not a
convenience. The type is declared on the `Exercise`, snapshotted onto the
`ExerciseSession`, and never copied onto a `CompletedSet` — so a set cannot
contradict the exercise above it, and no function infers the type from which
fields happen to be populated (§11.7, §39 C·16).

**An accepted Routine takes additions only.** Nothing already stored is renamed,
reordered, retargeted or removed — correcting happens in the import wizard, on a
Routine Draft, before Accept (§11.1). An **active** Routine may gain a Workout,
and any of its Workouts may gain a Planned Exercise. Both are purely additive.
Each import still creates a new Routine, and `Delete Routine` is still refused
while Sessions reference it; archive instead (§37).

What makes an addition safe is the snapshot, not immutability: an Exercise
Session copies its planned targets when the exercise starts (ADR 0002), so no
read path reconstructs a past Session through a template row. Immutability was
never what held history still.

**Identity is a generated ID.** UUID or ULID. An exercise name is a label that
can change (§24).

## Validation

Two tiers, and they behave differently (§11.1):

- **Structural** — Zod schema. Malformed YAML, unknown `version`, missing
  required fields. Rejects the import.
- **Semantic** — hand-written checks, **twelve** of them: `min_reps > max_reps`,
  a backwards target range, both or neither of `reps` / `target`, a range on the
  wrong axis for the exercise it resolves to, RIR out of range, negative rest,
  non-positive sets, an unrecognized progression, two Workouts sharing a
  `suggested_day`, a Routine declaring no Workouts, and a blank Routine name.
  The codes are listed in [docs/FORMAT.md](./docs/FORMAT.md). Loads into wizard
  step 1 flagged, and blocks `Accept` until fixed.

**The semantic tier runs on a Routine Draft.** It is the wizard's validator, and
what it validates is a `RoutineFile` being shaped before Accept. A Workout added
to a Routine already accepted never passes through it: that form checks what it
collects, by building a synthetic single-Workout file and handing it to the same
`validateRoutineFile` — so there is one implementation, not two that must agree.
`suggested_day_shared` is deliberately **not** enforced on that path: two
Workouts on one day is a real programme shape, so the form warns and names the
consequence rather than refusing (DEC-Q1).

## Tests

Domain functions carry unit tests — that is where the product's correctness
lives. Repositories are tested against `fake-indexeddb`. UI is verified by
running it.

## Conventions

Code, identifiers and comments in English. PRD prose stays Spanish.
