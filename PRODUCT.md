# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Committed by the repository, not open: Vite · React · TypeScript · React Router ·
Tailwind CSS v4 · shadcn/ui (Radix, re-skinned to DESIGN.md — never its default skin) ·
Dexie over IndexedDB with `dexie-react-hooks` · Zod · `vite-plugin-pwa` · Vitest with
`fake-indexeddb`. Deploys as static files to any host. Layering is binding —
`features → db → domain`, and `domain/` imports from neither (AGENTS.MD).

## Users

Lifters who train from structured programming — weight, reps and RIR — who revise their
own routines periodically and need to see what they did last time before deciding what to
do now. The primary user is the author; the intended audience is that person plus lifters
they know personally. There is no self-serve public audience: the app must be
self-explanatory to someone already comfortable with programmed training, but it is not
being sold to strangers and needs no marketing surface.

The usage scene is fixed and narrow: **gym → phone → installed PWA → no reliable
internet.** Standing, one hand occupied, between sets, under time pressure.

## Product Purpose

A training programme is declared in a structured YAML file; the app executes it in the
gym, records what was actually performed, and derives the next load from that record. The
file is the programme's authority — the app is its runtime.

Success is that a whole training block runs through the app without a network request,
without a set going unrecorded, and without the lifter ever having to remember or
recompute a load themselves.

## Positioning

Two things are kept strictly apart, and every other feature falls out of the separation:

- **Planned** — what the programme said.
- **Actual** — what was performed.

History renders from a snapshot of the plan taken when the exercise started, so editing a
routine never rewrites the past. Progression is a pure function over actual history,
recomputed on demand and never stored, read by `exerciseId` so re-importing a corrected
file preserves a lifter's record. Workouts carry no dates: a **Placement** is user-owned
intent that can be moved or deleted, a **Session** is what happened, and neither
references the other — so training Tuesday instead of Monday is not an exception the app
handles, it is how the model works.

A competitor cannot truthfully copy this while also storing progression state, dating its
templates, or requiring an account.

## Operating Context

- The lifter authors or edits a YAML routine file outside the app.
- Import runs through a two-step wizard: review exercises, then confirm suggested days and
  weeks. Structural errors reject the import; semantic errors load flagged and block
  `Accept` until fixed.
- Accepting generates Placements onto a calendar the user then controls directly.
- Training happens from **Today** → start Workout → snapshot targets → log sets
  (weight/reps/RIR) → rest timer → finish.
- The rest timer must survive a locked phone. Every set persists as it is logged, so an
  interrupted session resumes from IndexedDB.
- Data leaves only by explicit backup, restore, or CSV export.

## Capabilities and Constraints

Confirmed and specified in [docs/PRD.md](./docs/PRD.md); the glossary in
[CONTEXT.md](./CONTEXT.md) is binding on identifiers as well as prose.

- **MVP scope:** routine import with review step, routine management, calendar the user
  controls, Today, workout execution, rest timer with wake lock, set logging, previous
  performance, double progression, per-exercise history, progress dashboard, shipped
  exercise catalog, backup/restore, CSV export, installable and fully offline.
- **Deliberately out of scope:** accounts, cloud sync, social features, nutrition,
  wearables, AI coaching.
- **Offline is the normal case.** No runtime network requests, no backend, no telemetry.
  The exercise catalog ships inside the build.
- **An accepted Routine takes additions only.** Correcting happens in the wizard, before
  Accept; each import creates a new Routine. An active Routine may gain a Workout, and a
  Workout may gain a Planned Exercise — nothing stored is renamed, reordered, retargeted
  or removed. Deleting a Routine referenced by Sessions is refused — archive instead.
- **Weight carries its unit.** Store entered `weight` + `unit` plus derived `weightKg`;
  every comparison, chart and progression step reads `weightKg`. Unit is fixed per
  Exercise.
- **Identity is a generated ID** (UUID/ULID). An exercise name is a mutable label.
- **Missed is derived, never stored** — a past Placement with no Session.
- Only `completed` Sessions feed progression. Unplanned exercises get no suggestion.

Load-bearing decisions are recorded in [docs/adr/](./docs/adr/).

## Brand Commitments

- **"TrainLog" is a working name, not committed.** Nothing downstream may treat it as
  fixed identity; a rename is possible.
- No logo, palette, typography, or other brand asset exists. Future visual work is free to
  establish them — and must not imply any that were not created.
- Existing written voice (README, CONTEXT, AGENTS) is terse, concrete and declarative, and
  is the only established voice reference.
- **Pinned aesthetic preference (user, standing):** whitish palette, soft mass with real depth,
  some glass, rounded forms, colourful, animated. Binding on future visual work.
  **Amended 2026-08-20:** the concave half of neumorphism is rejected. Nothing is carved into the
  board; objects sit *on* it under a single soft drop. Surfaces are near-white on a board a full
  step darker — never a stack of near-identical greys.
- **Committed visual world:** Dose Card — a whitish board, a clear film, and convex domes you press
  one at a time. Soft depth from a single drop in the board's own hue, frosted glass containers, fully rounded
  cells, and a five-hue semantic set where colour names a state: blue Planned, green Actual, violet
  Progression, red Missed, amber Live. Depth has two positions only: raised is pressable, flat is
  settled. Recorded in [DESIGN.md](./DESIGN.md); first built surface is
  `design/preview.html`. **Supersedes Cloud Quarry** (chamfered cut-edges, blue-only), which the
  user replaced on 2026-08-18 as incompatible with the rounded, multi-colour brief.
- **The glossary outranks the world.** CONTEXT.md governs all user-facing language; the
  dose card supplies material and structure only. The UI says Session, Set, Exercise, RIR.
- Code, identifiers and comments in English. PRD prose stays Spanish.

## Evidence on Hand

- Full product specification: [docs/PRD.md](./docs/PRD.md) (48 sections, referenced as
  `§n`).
- Binding glossary: [CONTEXT.md](./CONTEXT.md).
- Two architectural decision records: [docs/adr/](./docs/adr/).
- Repository rules and invariants: [AGENTS.MD](./AGENTS.MD).
- A real example routine file in the README and PRD §12.

**No application code exists yet.** There are no screenshots, no users, no testimonials,
no metrics, no press, and no deployment. Future work must not fabricate any of these.

## Product Principles

1. **Offline is normal, not an exception.**
2. **Logging a set must be faster than writing it down by hand.**
3. **Previous performance is visible whenever it is useful.**
4. **Planned and actual are separate entities — the past is never rewritten.**
5. **The routine file describes programming; the app executes it.**
6. **Progression is deterministic, derived, and explainable to the lifter.**
7. **The data is the user's and stays portable; no infrastructure is required.**
8. **During a set, nothing that does not serve the current set may compete for attention.**

## Accessibility & Inclusion

Binding, not advisory:

- **One-hand operation and large targets.** Primary controls sit in comfortable thumb
  zones; weight/reps/RIR use large inputs with +/− and presets over text entry, defaulting
  to the previous value or the progression suggestion.
- **Sunlight and glare legibility.** The screen is read at arm's length, mid-set, in bright
  or badly lit rooms. Contrast and type size must hold under those conditions.
- **WCAG 2.2 AA across the whole app**, not just the training screens.
