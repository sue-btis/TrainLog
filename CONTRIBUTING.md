# Contributing to TrainLog

Thanks for looking. TrainLog is a small, opinionated app: an offline training
log whose programme is a YAML file you own. Contributions that keep it that way
are welcome.

## Setup

You need Node 24 and pnpm (the versions CI uses, see
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml)).

```bash
pnpm install
pnpm dev
```

`pnpm dev:phone` serves over HTTPS so a phone on the same network can open it.

## Before you open a pull request

Run what CI runs; all four must pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

UI changes are verified by running them: open the dev server at phone width
(375 px, and check 320 px) and try the change. Say in the pull request what you
checked and what you could not.

## Where things go

[AGENTS.MD](./AGENTS.MD) holds the repository's rules in full. In short:

- **Layers point one way:** `features → db → domain`. `src/domain/` is pure
  TypeScript and imports neither Dexie nor React; everything deterministic —
  parsing, validation, scheduling, progression — lives there with unit tests.
- **`src/db/` is the only code that touches IndexedDB.** Repositories are tested
  against `fake-indexeddb`.
- **Offline is the normal case.** The app makes no network request at runtime: no
  backend, no account, no telemetry, no remote fonts. A change that needs the
  network will not be merged.
- **Planned and actual stay apart.** History renders from the plan snapshotted
  when an exercise started, never from the current template.
- **Progression is derived, never stored.**
- **One module owns measurement:** what a set records and how a record is read
  is stated only in `src/domain/measurement.ts`.

## Words and language

- Use the vocabulary in [CONTEXT.md](./CONTEXT.md), in identifiers as well as
  prose: `Workout`, `Session`, `Placement` — not "day", "workout session" or
  "scheduled workout".
- Code, identifiers, comments and the product spec
  ([docs/product/prd.md](./docs/product/prd.md)) are in English.
- Comments explain why, not what.

## The routine file format

[docs/FORMAT.md](./docs/FORMAT.md) describes it. If you change the parser or the
validator, update that guide in the same pull request; a test parses its
examples, and fails when a semantic check is added without being documented.

## Design

[DESIGN.md](./DESIGN.md) is the visual system. Use its tokens rather than
arbitrary colours, radii, shadows or type sizes, and keep every interactive
control at least 48 px tall.

## Branches and pull requests

- Branch from `development`, named `<type>/<description>/<your-name>`, where type
  is one of `feat`, `fix`, `docs`, `refactor`, `chore`, `test`.
- Open the pull request against `development`. `master` only receives merges
  from `development`, and the live demo deploys from `master`.
- Larger changes keep their spec and verification under
  [docs/changes/](./docs/changes/), one folder per change.

## Licences

- Code is under the [MIT licence](./LICENSE).
- The exercise figures in `public/exercise-art/` derive from Everkinetic artwork
  through [Workout Guide](https://github.com/bryllim/workout-guide) and are
  **CC BY-SA 4.0**. Figures you add or change there are shared under the same
  licence. See the README's *Credits*.
