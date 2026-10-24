# Rename and delete user exercises

Status: Ready for implementation
Size: medium
Reliability: strict
Implementation effort: medium
Triggered artifacts: audit.md (strict: persisted field, backup schema, identity matching)

Goal: in the Exercise catalog screen a lifter can rename an exercise they
created, and the import keeps finding it by any name it has had; and can delete
one they created that nothing uses. Closes the remaining half of PRD backlog
item 7.

Evidence facts: see `audit.md` (entry `src/features/exercises/ExerciseCatalogScreen.tsx:214`; tests `src/db/repositories/exercises.test.ts`, `src/domain/catalog/index.test.ts`; consumers of the name match listed there).

Decisions (Josue, 2026-10-23):
- DEC-1 A rename remembers the former name; by-name matching accepts it.
- DEC-2 Delete only an exercise with no logged history and no Planned Exercise; otherwise refuse and say why.

## Required behaviour
- R-1 `Exercise` gains optional `previousNames: readonly string[]` (absent = none). No Dexie version bump; backup accepts it as optional.
- R-2 `findExerciseByName` matches catalog names, then user current names, then user `previousNames`. A current name always wins over an alias.
- R-3 `renameUserExercise(id, name)`: user exercises only; trims; refuses blank; refuses a name that resolves to a *different* exercise (catalog, current name or alias); adds the old name to `previousNames`, drops the new name from it if present; same normalized name is a no-op apart from casing.
- R-4 `deleteUserExercise(id)`: user exercises only; refuses when any `exerciseSessions` or `plannedExercises` row references it; otherwise deletes the row.
- R-5 UI: each user exercise row offers Rename (inline field, commit on Enter/blur) and Delete (two-press destructive, DESIGN.md). Refusals show the repository's message. Catalog rows show neither.

## Acceptance
- AC-1 Rename "Pogo Jumps" → "Pogo Hops": the row and all history show the new name; a YAML row "Pogo Jumps" resolves to the same id.
- AC-2 Renaming to "Front Squat" (catalog) or to another user exercise's name or alias is refused with a message naming the conflict.
- AC-3 Deleting an exercise with sets or in a Routine is refused; deleting an unused one removes it.
- AC-4 A backup taken after a rename restores the alias; a backup without the field still restores.
- AC-5 Catalog exercises cannot be renamed or deleted (no control; repository refuses).

## Preserved
History, progression, snapshots and Placements (all by id). Wizard offers keep one entry per user exercise.

## Quality
- Tests: catalog alias precedence; repository rename/delete (fake-indexeddb) for AC-1..AC-3, AC-5; backup schema accepts with and without `previousNames`.
- Static/build: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- QA: dev server — create, rename, import a YAML with the old name, delete an unused one.

Done when: in the running app a renamed exercise is matched by a YAML using its old name, and an unused exercise can be deleted while a used one is refused.

## Stop if
- Matching needs a Dexie index on names.
- A refusal cannot be decided inside one transaction.
