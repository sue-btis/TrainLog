# Shaping — Routine Authoring

Handoff from `shaping-change` to `auditing-change`. Deliberately compact: the
audit re-establishes repository truth for itself and must not inherit this
document's assumptions as facts.

## Desired observable outcome

Three capabilities, which collapse onto one missing seam:

1. **Create user Exercises** — a lifter can name a movement the bundled catalog
   does not carry, and pick it afterwards. PRD §39 item 7 (`⬜`).
2. **Author a Routine from scratch** — a programme that never came from a YAML
   file. Not in any PRD backlog; a new entry point.
3. **Add a Workout to an accepted Routine** — additively, without re-importing.
   PRD §39 item 14 (`⬜`), gated on a product decision now taken (below).

The seam all three need: `domain/routine-file/edit.ts` offers `editExercise`,
`deleteExercise`, `moveExercise`, `toggleSuggestedDay`, `setWeeks` — and no way
to *add* a Workout or an exercise.

## Approved decisions

- **DEC-A — Both readings of "add exercises".** Create user Exercises *and* add
  exercises to a Workout. The first is the enabler for the second: PRD §11.1
  excludes wizard-side adding today precisely because it "requiere un selector
  sobre el catálogo y la creación de ejercicios nuevos".
- **DEC-B — Additive edits in place.** `addWorkout` / `addPlannedExercise` write
  into the existing Routine. Nothing already stored is rewritten or deleted, so
  no past Session's provenance changes. The invariant "Routines are immutable
  once accepted" is **amended, not revoked**: no destructive edits.
- **DEC-C — Reuse the import wizard.** "Start from scratch" seeds a blank
  `RoutineFile` into the existing wizard. One edit → validate → Accept pipeline,
  one atomic `importRoutine` transaction, one Placement generation path.

## Known constraints and exclusions

- **Excluded:** editing or deleting existing Workouts and PlannedExercises
  in an accepted Routine (that is PRD §39 item 14 in full, and DEC-B does not
  authorize it). Renaming and deleting user Exercises are likewise out —
  DEC-A approved *creating* only.
- Offline-only. No network at runtime; the catalog ships in the build (§11.12,
  DEC-007) and catalog Exercises are never written to the `exercises` table.
- Layering is one-directional: `features → db → domain`. `domain/` imports
  neither Dexie nor React.
- Vocabulary in `CONTEXT.md` is binding on identifiers, not only on prose.

## Suspected area

- `src/domain/routine-file/` — `edit.ts` (the missing add operations),
  `schema.ts`, `validate.ts`, `to-domain.ts`.
- `src/domain/catalog/index.ts` — `normalizeExerciseName`, the §26 matching
  that a create-exercise flow must not contradict.
- `src/db/repositories/` — `workouts.ts`, `plannedExercises.ts`, `routines.ts`
  (all three documented read-only today), `exercises.ts` (no create), `import.ts`.
- `src/features/import/` — `state.ts`, `ImportWizard.tsx`, `ExercisesStep.tsx`,
  `FileStep.tsx`.
- `src/features/exercises/ExerciseCatalogScreen.tsx`,
  `src/features/routines/RoutineDetailScreen.tsx`, `src/App.tsx`.
- Docs: `AGENTS.MD`, `CONTEXT.md`, `docs/PRD.md` (§11.1, §11.2, §14.2, §39),
  `docs/adr/`.

## Contradiction the audit must resolve

`docs/PRD.md` §39 item 14 asserts that "Routines are immutable once accepted"
*holds up* ADR 0002's snapshot. [ADR 0002](../../adr/0002-snapshot-planned-targets-on-session-start.md)
asserts the reverse in its own Consequences: "Templates become safely editable,
so no Routine versioning is needed."

DEC-B is taken on ADR 0002's reading. The audit must confirm from code — not
from prose — that no read path reconstructs a past Session's planned targets by
joining back into `plannedExercises`, which is what would make DEC-B unsafe.

## Unresolved, for the spec

- **Placement generation on DEC-B.** Adding a Workout to an active Routine:
  are Placements generated for it, over which dates, and does the existing
  rotation shift? `generatePlacements` runs once at import today.
- **Semantic validation of an empty draft.** A from-scratch Routine starts with
  zero Workouts and cannot be `Accept`ed in that state; `validateRoutineFile`
  has no issue code for it today.
- **Whether `SCHEMA_VERSION` or `BACKUP_VERSION` move.** Provisionally no —
  all three features write rows into the nine tables that already exist and are
  already exported. The audit confirms or refutes.

## Classification

- Size: **large**
- Reliability: **strict**
