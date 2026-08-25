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

---

## Decisions taken after the audit (2026-08-25)

The audit (`audit.md`) raised nine decisions and approved none, as its skill
requires. All nine are now taken. They are recorded here because this is the
document that holds approved decisions; `audit.md` stays a factual snapshot.

**Correction to DEC-B.** Its conclusion stands — the discriminator belongs on
`Exercise`, because a plank does not become a rep exercise on Tuesday — but its
stated reason is false about this repository. `unit` does **not** live on
`Exercise`. It is declared on `PlannedExercise`, snapshotted as
`ExerciseSession.plannedUnit`, and copied onto `CompletedSet.unit`. §11.7 says
the unit is *conceptually* the exercise's; the code declares it on the plan and
makes it travel. That three-place pattern is the precedent DEC-H follows.

- **DEC-H — `measurement` is declared on `Exercise` and snapshotted onto
  `ExerciseSessionBase`.** On the base, not among the `planned*` fields: an
  unplanned exercise has a measurement too, because the type is identity of the
  movement rather than a target of the programme. `SessionHistory` therefore
  already carries it, so `domain/history.ts` and `domain/progression/index.ts`
  keep their signatures. Not copied onto `CompletedSet` — a per-row copy nothing
  reads, free to contradict the ExerciseSession above it. `SetPill` and
  `features/ui/format.ts` take it as a prop.

- **DEC-I — bodyweight is a field on `Session`, not a tenth table.** A new field
  on a table that is already exported, so REQ-070, §17 and `schema.test.ts:147`
  are untouched. Carried forward from the last Session and editable. Sessions
  are dated, so this satisfies DEC-C's "recorded over time" without new
  structure. The ceiling is stated rather than hidden: a rest-day weigh-in has
  nowhere to go until bodyweight tracking becomes its own feature.

- **DEC-J — distance carries its own unit axis.** `DistanceUnit = 'm' | 'km' |
  'mi'` with a derived `distanceM`, mirroring `Unit` and `toKg` exactly. Storing
  metres always would store a number the lifter never typed, which §11.7
  explicitly avoids for weight. One enum covers a run in kilometres and a
  farmer's walk in metres. `Unit` keeps its CONTEXT.md meaning — weight only.

- **DEC-K — the routine file format moves to v2, and v1 stays accepted.** A v1
  file means every exercise is `weight_reps`, which is the same backfill rule
  the stored data follows. `reps` is structurally required in v1 and a routine
  file may mint an Exercise, so the file must be able to declare a measurement;
  that is a format change. `docs/bloque-a-acumulacion.yaml` and
  `docs/bloque-b-intensificacion.yaml` keep importing untouched.

- **DEC-L — the catalog declares a type for all 96 rows in this change, and no
  stored set is rewritten.** Catalog data is build-time and costs no migration
  (DEC-007). This is what makes the backfill lossless: a stored `push-up` set
  holding `weight: 0` reads correctly under the new type without being touched,
  because `bodyweight_reps` does not read that field and `weighted_bodyweight`
  reads 0 as "no added weight" — which is the truth. The reinterpretation comes
  from the Exercise's declaration, never from guessing about a set. This closes
  the audit's DEC-Q5 and DEC-Q7 together; they are one decision.

- **DEC-M — user-created Exercises are backfilled to `weight_reps`.** The only
  type provable from the data. The audit established that nothing distinguishes
  a bodyweight set from a weighted set entered at zero, so any other answer is a
  guess. DEC-O is the correction path.

- **DEC-N — `CSV_HEADER` grows by appending, never by inserting.**
  `…,rir,measurement,duration_s,distance,distance_unit`. Every existing column
  keeps its index, so a positional parser survives. Same additive precedent by
  which `unit` was already added past §19's example.

- **DEC-O — an Exercise's measurement may be corrected while it holds no
  logged sets.** Refused once history exists. Changing a measurement is not a
  rename: it touches no identity and cannot split a history under §26, so the
  verb is narrow and safe. With sets already logged it *is* reinterpretation,
  which this change excludes and §39 item 7 owns. Catalog Exercises are
  build-time and are not editable.

- **DEC-P — a record is the best value on the type's own axis, in that axis's
  better direction.** It reuses the axis-and-sign function DEC-A·3 already
  forces into existence, so it adds no formula. Riegel is rejected for now: a
  new formula and a product claim §11.11 does not make. Estimated 1RM stays
  defined only for the types that have one.

### Still open, deliberately

- §39 has no row for this change. Group C lists items 9–12 and measurement is
  absent, so the spec adds a numbered row and updates the table in the same
  commit, as §39 itself instructs.
- Whether `SCHEMA_VERSION` and `BACKUP_VERSION` both move. The audit validated
  the premise (ASM-3: `z.object` strips unknown keys, which is why
  `backup/schema.ts` reaches for `looseObject` where it must not), but the
  decision belongs in the spec beside the migration it versions.
