# TrainLog — repo rules

Offline-first training PWA. A YAML file declares the programme; the app executes
it, records what happened, and derives progression from that record.

- [CONTEXT.md](./CONTEXT.md) — the glossary. Binding on identifiers, not just prose.
- [docs/PRD.md](./docs/PRD.md) — product spec. Sections are referenced as `§11.3`.
- [docs/adr/](./docs/adr/) — why the two load-bearing decisions were made.

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
the past. See [ADR 0002](./docs/adr/0002-snapshot-planned-targets-on-session-start.md).

**Progression is derived.** A pure function over history, recomputed on demand,
with nothing stored. It reads by `exerciseId`, never `plannedExerciseId`, so
re-importing a corrected file preserves a lifter's history. Only `completed`
sessions feed it. `double_progression` judges the first N sets where N is the
planned count (§29). Unplanned exercises get no suggestion.

**Placements and Sessions are independent.** A `Placement` is intent and can be
moved or deleted; a `Session` is what happened. Neither references the other. A
missed day is derived at query time — a past `Placement` with no `Session` —
and is never written down. See [ADR 0001](./docs/adr/0001-dateless-workouts-with-user-owned-placements.md).

**Weight carries its unit.** Store the entered `weight` and `unit` plus a derived
`weightKg`. Every comparison, chart and progression step reads `weightKg`. Unit
is fixed per Exercise (§11.7).

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
- **Semantic** — hand-written checks, **eight** of them: `min_reps > max_reps`,
  RIR out of range, negative rest, non-positive sets, an unrecognized
  progression, two Workouts sharing a `suggested_day`, a Routine declaring no
  Workouts, and a blank Routine name. Loads into wizard step 1 flagged, and
  blocks `Accept` until fixed.

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
