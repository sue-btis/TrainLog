# TrainLog

An offline-first training PWA. You write your programme as a YAML file; the app
runs it in the gym, records what you actually did, and works out your next load
from that record.

Built for one situation: a phone, in a gym, with unreliable signal. No account,
no server, no subscription — your data lives in your browser and leaves only when
you export it.

> **Status: design.** The specification, glossary and architectural decisions are
> written. No application code exists yet.

## The idea

Two things are kept strictly apart:

**Planned** — what the programme said. `Front Squat, 4 × 4-6, RIR 1-2, rest 3:30`

**Actual** — what you did. `75 × 6 @2, 75 × 6 @2, 75 × 5 @1, 75 × 5 @1`

Every other feature falls out of that separation. History is a record of the
actual, never rewritten when a programme changes. Progression is calculated from
the actual, not tracked as a number someone has to maintain. And when you edit a
routine, last month's sessions still say exactly what last month asked of you.

Workouts carry no dates. You import a routine, assign its workouts to days, and
then move them around as real life happens — skipping Monday and squatting on
Tuesday is not an exception the app has to handle, it is just how it works.

## Your routine, as a file

```yaml
version: 1

routine:
  name: "Hybrid Strength - September"
  weeks: 4

  workouts:
    - name: "Push - Quad + Shoulder Strength"
      suggested_days: [monday, friday]

      exercises:
        - name: "Front Squat"
          category: "quadriceps"
          sets: 4
          reps: { min: 4, max: 6 }
          rir:  { min: 1, max: 2 }
          rest_seconds: 210

          progression:
            type: "double_progression"
            increment: 2.5
```

Import it, review it, confirm the days, train.

## Planned for the first version

Routine import with a review step · calendar you control · workout execution with
weight, reps and RIR · rest timer that survives a locked phone · previous
performance shown when you need it · per-exercise history · double progression ·
full backup, restore and CSV export · installable, and fully usable offline.

Deliberately out of scope: accounts, cloud sync, social features, nutrition,
wearables, and AI coaching.

## Documentation

| Document | What it holds |
| --- | --- |
| [docs/PRD.md](./docs/PRD.md) | The full product specification |
| [CONTEXT.md](./CONTEXT.md) | Glossary — the words this project uses, and the ones it avoids |
| [docs/adr/](./docs/adr/) | Architectural decisions and why they were made |
| [AGENTS.MD](./AGENTS.MD) | Rules for working in this repository |

## Stack

React · TypeScript · Vite · React Router · Dexie over IndexedDB · Zod ·
vite-plugin-pwa. Deploys as static files to any host.
