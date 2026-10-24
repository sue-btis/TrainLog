# Rename and delete user exercises — Audit

Focused read of the surfaces a rename or delete can break. Method: `grep` over `src/` (no language server in this session).

## Current behaviour
- Identity is `Exercise.id` (UUID for user exercises, slug for catalog). History, progression, snapshots and Placements never key on the name (AGENTS.MD, PRD §24).
- The name is still load-bearing in one place: `findExerciseByName` (`src/domain/catalog/index.ts:35`) matches a YAML row without `exercise_id` to a stored user Exercise by normalized name (§26). `exercise_id` only resolves catalog slugs (`src/domain/routine-file/to-domain.ts:64-73`), so a hand-written YAML can reach a user Exercise **only by name**.
- Catalog exercises live in the build (§11.12); they are not stored rows and cannot be renamed or deleted.
- The only edit today is `correctExerciseMeasurement` (`src/db/repositories/exercises.ts:110`), refused for catalog exercises and once sets exist.

## Consumers of the name match (`grep -rn findExerciseByName src`)
- `src/db/repositories/exercises.ts:76` — `createUserExercise` duplicate check.
- `src/domain/routine-file/to-domain.ts:72` — import resolution.
- `src/domain/routine-file/offer.ts:27,35` — wizard offers: de-duplicates user exercises and decides whether a file spelling is already covered.

## Storage
- Dexie `exercises: 'id'` (`src/db/schema.ts:37`); a new non-indexed property needs no version bump.
- Backup: `exercise` zod object (`src/domain/backup/schema.ts:142`) — non-strict, unknown keys are stripped. An optional field keeps old backups valid; an older app restoring a new backup drops the field.
- References to an Exercise: `plannedExercises.exerciseId` (not indexed; `schema.ts:35`), `exerciseSessions.exerciseId` (indexed; `schema.ts:39`). Placements reference Workouts, not Exercises.

## Findings that shape the spec
- F-1 Renaming without memory splits history on the next by-name import (the §26 "consecuencia aceptada"). Decision DEC-1 keeps former names as aliases.
- F-2 A rename must not take a name (or alias) another exercise answers to, or the matcher becomes ambiguous.
- F-3 Delete is only safe with zero `exerciseSessions` and zero `plannedExercises` referencing the id; anything else orphans history or an accepted Routine (which takes additions only).
- F-4 Unrelated: `CATALOG_CATEGORIES` already existed when the volume change added `CATEGORIES` (different order). Out of scope here; noted for a follow-up.
