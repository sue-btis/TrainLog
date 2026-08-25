# Shaping — Exercise Measurement

Handoff from `shaping-change` to `auditing-change`. Deliberately compact: the
audit re-establishes repository truth for itself and must not inherit this
document's assumptions as facts.

## Desired observable outcome

A hybrid athlete can log and read every kind of work their programme contains,
not only weight × reps. Three capabilities plus one enabler:

1. **An Exercise declares how it is measured** — one of eight types:
   `weight_reps`, `bodyweight_reps`, `weighted_bodyweight`,
   `assisted_bodyweight`, `duration`, `duration_weight`, `distance_duration`,
   `weight_distance`.
2. **A set collects the fields its type asks for, and only those.** A plank logs
   seconds; a run logs distance and time; neither is asked for a rep count.
3. **Every derived figure knows which axis it reads and which way is better.**
   Two of the eight invert: less assistance is progress, and a lower pace is
   progress. A running maximum is the wrong answer for both.
4. **Enabler — bodyweight over time.** Without it, `weighted_bodyweight` and
   `assisted_bodyweight` progress only against themselves and are comparable to
   nothing else.

Not in any PRD backlog. §39 group C is *"Modelo de ejecución — cada uno cambia
qué es una serie"*, and this is that group's largest member by some distance.

## Approved decisions

- **DEC-A — All eight types.** The product targets a hybrid athlete, so the four
  duration/distance types are in scope rather than deferred as cardio.
- **DEC-B — The discriminator lives on `Exercise`.** Not on `PlannedExercise`
  and not on `CompletedSet`, for the reason `unit` already lives there (§11.7):
  a machine in pounds does not change unit between sets, and a plank does not
  become a rep exercise on Tuesday.
- **DEC-C — Bodyweight is recorded over time**, as its own dated value.
- **DEC-D — Volume is never summed across types.** Kilogram-reps, reps, seconds
  and metres do not add up; any single total claiming to sum them contains an
  invented conversion. Four accumulators, each in its own unit, never one figure.
- **DEC-E — `effort` is the cross-modal figure, and it already shipped.**
  Foster's session load, mean RPE × minutes, in `domain/session-summary.ts`
  (§39 A·15). Landed ahead of this change on purpose: pure function, no schema.
- **DEC-F — `double_progression` generalizes by axis and sign, not by new rule
  types.** Its shape is already "when the first N sets meet the target on one
  axis, advance the other by `increment`". Both the axis and the sign are
  derivable from `measurement`. §39 item 13 (a strategy contract) stays closed.
- **DEC-G — This change starts only once routine-authoring has landed.** That
  change's spec stop condition 8 forbids any schema, index or version change,
  and its own UI — the create-Exercise form, the wizard picker,
  `addPlannedExercise` — is exactly where this one attaches. The dependency runs
  one way only.

## Known constraints and exclusions

- **Excluded:** rewriting stored history into new types beyond the mechanical
  backfill. Reinterpreting past sets is not a migration, it is a rewrite.
- **Excluded:** GPS, heart rate, route maps or any sensor. The app makes no
  network requests at runtime and reads no device sensor.
- **Excluded:** §39 items 9–11 (warm-up sets, supersets, drop sets), which also
  change what a set is and must not be folded in.
- Offline-only. The catalog ships in the build (§11.12, DEC-007) and catalog
  Exercises are never written to the `exercises` table.
- Catalog slugs are permanent (REQ-023): one may be added, never renamed or
  removed.
- Layering is one-directional: `features → db → domain`. `domain/` imports
  neither Dexie nor React.
- Vocabulary in `CONTEXT.md` is binding on identifiers, not only on prose.
  `Effort` was added there by the DEC-E change; `Load` means kilograms and must
  not be reused for anything here.

## Suspected area

- `src/domain/types.ts` — `Exercise`, `PlannedExercise`, `CompletedSet`.
- `src/domain/catalog/data.ts` (96 rows) and `catalog/index.ts`.
- `src/domain/history.ts` — `better`, `estimateOneRepMaxKg`, `ExercisePoint`,
  `exerciseSeries`, `isRecord`. 71 references to `weightKg` across the tree.
- `src/domain/progression/index.ts` — `doubleProgression`, `suggestLoad`,
  `projectNextLoad`.
- `src/domain/backup/schema.ts` + `document.ts` (`BACKUP_VERSION`),
  `src/domain/backup/csv.ts` (`CSV_HEADER`).
- `src/domain/routine-file/` — `schema.ts` (`reps` is structurally required),
  `validate.ts`, `to-domain.ts`, `edit.ts`, `example.ts`, `fixtures.ts`.
- `src/db/schema.ts` — `SCHEMA_VERSION`, and the "exactly nine tables" claim.
- `src/db/repositories/` — `exercises.ts`, `completedSets.ts`, `backup.ts`.
- `src/features/session/` — `SetLogger.tsx`, `SetEditor.tsx`, `ExerciseView.tsx`,
  `PreviousPanel.tsx`; `src/features/ui/SetPill.tsx`, `format.ts`.
- `src/features/progress/ExerciseChart.tsx` — `Metric`, `METRICS`, `READING`.
- Docs: `AGENTS.MD`, `CONTEXT.md`, `docs/PRD.md` (§11.7, §11.11, §14.1, §14.8,
  §19, §26, §27–29, §39), `docs/adr/`.

## Contradictions the audit must resolve

1. **The PRD states the set shape as universal.** §11.7 and §14.8 both list
   `weight`, `unit`, `weightKg`, `reps`, `rir` as what *every* completed set
   stores. This change makes four of the five conditional. That is an amendment
   to both sections, not something to route around in code.

2. **Bodyweight sets are already in history, logged at 0 kg.** `history.ts` says
   so in its own words: *"a bodyweight set logged at 0 kg estimates 0 — a real
   value, not an absent one"*. A backfill that types every stored set
   `weight_reps` is therefore not obviously safe. The audit must establish from
   the data model — not from prose — what is actually distinguishable after the
   fact, and the spec must state what a 0 kg set becomes.

3. **The catalog already carries the workaround, permanently.** `weighted-dip`
   and `weighted-pull-up` exist as entries separate from `dip` and `pull-up`,
   and `plank` is a duration movement with no way to log a duration. REQ-023
   makes all four slugs undeletable. The audit must confirm whether history
   references them, because that decides whether the workaround entries can be
   quietly retyped or must survive alongside the real ones forever.

4. **`CSV_HEADER` is a frozen external contract.** §19's stated purpose is
   *"facilitará análisis externos"*, and the header is a single literal:
   `date,exercise,set,weight,unit,reps,rir`. Changing its shape breaks a file
   somebody else already parses.

## Unresolved, for the spec

- **Where bodyweight lives.** `db/schema.ts` asserts *exactly nine tables,
  matching the backup document of §17 field for field*. A tenth table amends
  REQ-070 and §17. The alternative — snapshotting bodyweight onto `Session` when
  it starts — costs no table and matches ADR 0002's philosophy, but cannot
  answer "what did I weigh on a rest day". Not decided.
- **Whether distance carries its own unit axis** (km/mi) beside weight's kg/lb,
  and whether §11.7's "unit is fixed per Exercise" then means two units.
- **What a record is for the five types with no e1RM.** §11.11 defines records
  only through estimated 1RM. Riegel is the endurance counterpart to Epley and
  was raised in shaping, but nothing about it is approved.
- **Whether existing Exercises can have their type corrected.** There is no edit
  path today: §39 item 7 is `⬜` and routine-authoring excluded rename and
  delete. Without one, a user Exercise created before this change is typed
  forever by the backfill.
- **Whether the catalog declares a type for all 96 rows in this change**, or
  defaults and is corrected over later releases. Catalog data is build-time and
  costs no migration either way (DEC-007), so this is a scope call, not a risk.
- **Whether both `SCHEMA_VERSION` and `BACKUP_VERSION` move.** Provisionally
  both. `z.object` strips unknown keys — verified — so an older build restoring
  a newer backup would silently drop `measurement` rather than refuse the file,
  and only the version gate prevents that. The audit confirms or refutes.

## Classification

- Size: **large**
- Reliability: **critical**

Critical rather than strict, and the trigger is stated in the sizing reference:
irreversible migration. A user's IndexedDB is the only copy of their training
history, this change alters what a stored set *is*, and the backup format moves
with it. Routine-authoring was strict because ASM-1 kept it out of the schema
entirely; that assumption does not survive here.
