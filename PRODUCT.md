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

## Product Specification

The product is specified in [docs/product/prd.md](./docs/product/prd.md): scope, journeys,
requirements, business rules and principles. The design package is indexed by
[docs/spec/manifest.yaml](./docs/spec/manifest.yaml), and decisions live in
[docs/design/architecture/adr/](./docs/design/architecture/adr/). The glossary in
[CONTEXT.md](./CONTEXT.md) is binding on identifiers as well as prose.

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
  settled. Recorded in [DESIGN.md](./DESIGN.md). **Supersedes Cloud Quarry** (chamfered cut-edges, blue-only), which the
  user replaced on 2026-08-18 as incompatible with the rounded, multi-colour brief.
- **The glossary outranks the world.** CONTEXT.md governs all user-facing language; the
  dose card supplies material and structure only. The UI says Session, Set, Exercise, RIR.
- Code, identifiers, comments and product docs in English.


## Accessibility & Inclusion

Binding, not advisory:

- **One-hand operation and large targets.** Primary controls sit in comfortable thumb
  zones; weight/reps/RIR use large inputs with +/− and presets over text entry, defaulting
  to the previous value or the progression suggestion.
- **Sunlight and glare legibility.** The screen is read at arm's length, mid-set, in bright
  or badly lit rooms. Contrast and type size must hold under those conditions.
- **WCAG 2.2 AA across the whole app**, not just the training screens.
