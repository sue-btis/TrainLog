# Settings — Spec

Status: Ready for implementation
Size: medium
Reliability: strict
Base: `master` at `2826894`, clean working tree.

## Goal

A lifter can set how the app behaves for them: which unit a routine file inherits
when it names none, what RIR the readouts open on when nothing else is known,
whether the rest timer buzzes, whether it beeps, and whether the screen is held
awake during a session.

Done when: **More** carries a **Settings** section holding those five controls;
each one is persisted immediately and read back after a reload; and the three
that gate gym-mode behaviour actually gate it. All of it works with the network
off.

This closes §32, the second of the three items §38 lists as outside MVP 0.1.

## Evidence and Current Behavior

Verified by inspection at `2826894`:

- **`Settings` is one row with one field.**
  `interface Settings { id: 'settings'; defaultUnit: Unit }`
  ([`types.ts:260`](../../../src/domain/types.ts)). The table is
  `settings: 'id'` ([`schema.ts:127`](../../../src/db/schema.ts)) — keyed by primary key
  only, no secondary index. Growing the row with **non-indexed** fields needs no
  `stores()` change and no Dexie version.
- **The writer replaces the whole row.**
  `setDefaultUnit` calls `db.settings.put({ id, defaultUnit })`
  ([`settings.ts:26`](../../../src/db/repositories/settings.ts)). Left as it is, saving the
  unit would erase every other setting. **This is the one real defect the change
  must not reproduce.**
- **The reader already supplies defaults.** `getSettings` returns
  `?? { id, defaultUnit: DEFAULT_UNIT }` when no row exists
  ([`settings.ts:18`](../../../src/db/repositories/settings.ts)) — but only for the whole-row
  case. A row written before this change exists and lacks the new fields, so the
  per-field default has to be applied on read, not only on absence.
- **`settings` travels in the backup and is never restored.**
  `BackupDocument.settings` ([`document.ts:72`](../../../src/domain/backup/document.ts)),
  `RESTORED_TABLES` excludes it on purpose (`document.ts:78`), and
  `restoreBackup` keeps it outside the transaction's scope
  ([`backup.ts:134`](../../../src/db/repositories/backup.ts)). `exportBackup` substitutes
  `{ id: 'settings', defaultUnit: 'kg' }` when the row is absent
  ([`backup.ts:81`](../../../src/db/repositories/backup.ts)).
- **The Zod shape is closed and exact.**
  `z.object({ id: z.literal('settings'), defaultUnit: unit })`
  ([`schema.ts:246`](../../../src/domain/backup/schema.ts)). Zod strips unknown keys rather
  than rejecting them, so a *newer* document parses on an older build with the
  new settings silently dropped — acceptable, since restore ignores settings
  entirely. The reverse — an **older** document, carrying only `defaultUnit` —
  must keep parsing, which is why the new fields are optional here.
- **`parseBackup` is fuzzed.**
  [`schema.fuzz.test.ts`](../../../src/domain/backup/schema.fuzz.test.ts) asserts two
  invariants for arbitrary input: it always returns, and a refusal always
  carries at least one error. Any schema edit is under that contract.
- **`settings.test.ts` asserts the row's exact shape** —
  `expect(await getSettings()).toEqual({ id: 'settings', defaultUnit: DEFAULT_UNIT })`
  ([`settings.test.ts:14`](../../../src/db/repositories/settings.test.ts)). It will fail on the
  new defaults and must be updated as part of the change, not around it.
- **Vibration is unconditional.** `navigator.vibrate?.([220, 120, 220])` at
  [`RestTimer.tsx:77`](../../../src/features/session/RestTimer.tsx), under a comment that names
  the missing §32 setting as the reason no sound exists yet.
- **There is no sound.** No audio asset anywhere in `src/assets/`, no
  `AudioContext` or `Audio` in the tree.
- **The wake lock is unconditional.** `useWakeLock(session !== undefined)`
  ([`SessionScreen.tsx:108`](../../../src/features/session/SessionScreen.tsx)); the hook takes
  one `active` boolean ([`useWakeLock.ts:18`](../../../src/features/session/useWakeLock.ts)) and
  degrades in silence when the API is missing or the request is refused.
- **RIR's last-resort default is a hardcoded `0`.** `openingValues` prefers, in
  order: the set just logged, the planned `plannedMinRir`, then last session's
  opening set, then `0`
  ([`ExerciseView.tsx:302`](../../../src/features/session/ExerciseView.tsx)). A settings default
  changes only that last branch — an unplanned exercise with no history.
- **The unit already flows through a hook.** `useDefaultUnit`
  ([`queries.ts:175`](../../../src/features/data/queries.ts)) over `getDefaultUnit`, consumed by
  `SessionScreen.tsx:83` and read directly by `ImportWizard.tsx:116`. The
  pattern for reading a setting into the UI exists; nothing writes one.
- **More is already declared as the home for this.**
  *"Settings (§32) will live here too. Only the data actions exist today."*
  ([`MoreScreen.tsx:17`](../../../src/features/more/MoreScreen.tsx)), and the restore copy
  already promises *"Your default unit stays as you have it here"* — a sentence
  that is currently a lie, because there is no "here".
- **The control vocabulary exists.** `Select` is already re-skinned
  ([`select.tsx`](../../../src/components/ui/select.tsx)); `WELL`, `RULED`, `LABEL`, `ROW_LIST`,
  `ROW`, `FIELD_BASE`, `STEPPER`, `FOCUS_RING` in
  [`styles.ts`](../../../src/features/ui/styles.ts). **`Switch` does not exist yet**, but
  DESIGN.md:764 already specifies its skin: *track `bg-well`, thumb `bg-card
  shadow-dome`, checked `bg-actual-ink`*.
- **Dark mode is refused by DESIGN.md, not merely absent.** The No-Dark-Variant
  Rule (DESIGN.md:825-827): *"Dark was rejected from the use scene… Settings
  offers no theme control."* `theme.css` declares one palette, in `@theme`, with
  no `.dark` block and no `prefers-color-scheme`.
- **CONTEXT.md has no entry for Settings.** AGENTS.MD requires a term settled
  during a change to be added there in the same change.
- Working tree clean at `2826894`. **No overlap with unrelated work.**

## Scope

Included:

- Four fields added to `Settings`: default RIR, timer vibration, timer sound,
  keep screen awake.
- A per-field write that cannot erase its neighbours, replacing the whole-row
  `put`.
- A **Settings** section on `/more` with the five controls.
- The three gates: vibration and sound in `RestTimer`, wake lock in
  `SessionScreen`.
- The default-RIR fallback in `openingValues`.
- A `Switch` control, skinned as DESIGN.md:764 specifies.
- A WebAudio beep, generated in code — no audio file.
- `docs/PRD.md`: §32 loses the theme row; §38 records Settings as done.
- `CONTEXT.md`: the `Settings` entry.

Excluded:

- **Any theme control, and any dark palette.** DEC-1. `theme.css` is not
  touched and no `.dark` block is introduced.
- **Notifications** (§11.6 puts them outside the MVP).
- **Per-exercise unit editing.** Unit is fixed per Exercise (AGENTS.MD, §11.7);
  this setting is only the default a routine file inherits when it names none.
- **Retroactive effects.** Changing the default unit does not rewrite any
  Exercise, Routine, snapshot or logged set.
- **Restoring settings from a backup.** §18's list is unchanged; the device
  keeps its own preferences (`document.ts:78`).
- **A settings route, screen or nav tab.** It is a section of More.
- **A `SCHEMA_VERSION` bump, a new index, or a new table.**
- **Progress Dashboard (§11.11)** and **Exercise Catalog as a screen (§11.12)**
  — the other two items outside MVP 0.1.
- **`BACKUP_VERSION` bump.** See A-1.

## Decisions and Assumptions

| ID | Decision | Authority |
|---|---|---|
| DEC-1 | **No theme control and no dark palette.** DESIGN.md wins the conflict with §32, and §32 is corrected to match rather than left contradicting the design system. | User, on the documented conflict between §32 and DESIGN.md:825-827 |
| DEC-2 | **Timer sound is a WebAudio beep**, synthesised at fire time. No audio asset, no network request. | User; AGENTS.MD's offline invariant — an asset would be one more thing the service worker has to be right about |
| DEC-3 | Settings is a **section of More**, not a route or a sixth tab. | `MoreScreen.tsx:17` already states it; `SECTIONS` stays four entries as the session-history change also required |
| DEC-4 | **Default RIR is nullable** (`number | null`, default `null`). §32 marks it *optional*, and "no opinion" is a real answer that `0` cannot express — `0` means *to failure*, which is a strong claim to make on a lifter's behalf. | §32 ("Default RIR — optional"); RIR semantics in §30 |
| DEC-5 | Each control **persists on change**, with no Save button. | NFR-03's rule for sets applies the same way here: the app never holds a lifter's intent in memory waiting for a confirmation |
| DEC-6 | Vibration, sound and wake lock **default to the current behaviour**: vibration on, wake lock on, sound off. Nobody's gym mode changes until they change it. | The change must not alter behaviour for a lifter who never opens Settings |

Assumptions:

- **A-1: no `BACKUP_VERSION` bump is needed.** The new fields are optional in
  the Zod shape, so a v1 document still parses; and restore ignores `settings`
  entirely, so a document from a newer build loses nothing that would have been
  written. **Stop if** implementation finds a path where a settings field
  reaches the database through restore — then settings *is* restored data, the
  version question reopens, and this spec is wrong about §18.
- **A-2: no Dexie version is needed.** The new fields are not indexed and
  `stores()` declares only `id`. A row written before this change is read
  through per-field defaults rather than upgraded. **Stop if** any new field
  needs an index, or if a `.filter()`/`.where()` over settings appears.
- **A-3: `useWakeLock`'s `active` argument is the only gate needed.** Passing
  `session !== undefined && keepAwake` re-runs its effect when the setting
  changes, and its cleanup releases the sentinel. **Stop if** turning the
  setting off mid-session leaves the screen awake — that is a hook change, not
  a caller change.
- **A-4: a beep needs no user-gesture unlock in practice.** The timer is only
  ever reached after the lifter has pressed to log a set, so the page has an
  activation by then. **Stop if** the beep is refused on iOS in QA; the fallback
  is to create/resume the `AudioContext` on the logging press, stated here so it
  is not improvised into a global audio singleton.

## Requirements and Acceptance

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-1 | `Settings` carries five fields: `defaultUnit`, `defaultRir: number \| null`, `timerVibration: boolean`, `timerSound: boolean`, `keepScreenAwake: boolean`. Reading settings from a database whose row predates them yields the defaults for the missing fields, without writing anything. | AC-1a: with a row of exactly `{ id, defaultUnit: 'lb' }` on disk, `getSettings()` returns `lb` plus vibration `true`, sound `false`, keep-awake `true`, RIR `null`. AC-1b: that read leaves `db.settings.count()` and the stored row unchanged. AC-1c: on an empty database `getSettings()` returns every default and still writes nothing. |
| R-2 | Writing one setting preserves the others. | AC-2a: set the unit to `lb`, then turn vibration off, then reopen the database — the unit is still `lb` and vibration is still off. AC-2b: the table holds exactly one row after any number of writes. AC-2c: no exported writer takes a whole `Settings` object in a way that lets a caller drop a field. |
| R-3 | `SCHEMA_V1`, `SCHEMA_VERSION` and the Dexie version count are unchanged. | AC-3: `git diff` touches no `stores()` call, no `version(n)` call, and no index string. A database created by the previous build opens without an upgrade. |
| R-4 | `parseBackup` accepts a document whose `settings` holds only `defaultUnit`, and one that holds all five. `BACKUP_VERSION` is unchanged. | AC-4a: a backup exported at `2826894` still restores. AC-4b: a backup exported after this change parses, and restoring it still leaves the device's settings untouched. AC-4c: the fuzz suite's two invariants still hold. AC-4d: `exportBackup` on a database with no settings row emits the full default row, not a partial one. |
| R-5 | `/more` shows a **Settings** section with five controls: default unit (kg/lb), default RIR (a number or none), timer vibration, timer sound, keep screen awake. Each change persists immediately and is reflected after a reload. | AC-5a: changing each control and reloading the app shows the changed value. AC-5b: every control is reachable and operable by keyboard and carries an accessible name; the switches expose their on/off state to assistive technology. AC-5c: the three data actions on More still work unchanged. AC-5d: the section states that the unit is only a default for routine files that name none, so it is not mistaken for a converter. |
| R-6 | The rest timer buzzes only when timer vibration is on. | AC-6a: with it off, reaching zero calls `navigator.vibrate` not at all. AC-6b: with it on, the current three-pulse pattern is unchanged. AC-6c: the timer's countdown, pause, restart and add-time behaviour is untouched — §35 correctness does not move. |
| R-7 | The rest timer beeps when timer sound is on, and is silent when off. The beep is synthesised; no audio file is added and no request is made. | AC-7a: with sound on, reaching zero produces an audible tone; with it off, nothing. AC-7b: no file under `src/assets/` is added and the network panel records no request. AC-7c: a browser that refuses audio produces no error the lifter can see and no unhandled rejection. |
| R-8 | The screen is held awake during a session only when keep-screen-awake is on, and turning it off during a session releases the lock. | AC-8a: with it off, opening a session requests no wake lock. AC-8b: turning it off mid-session releases the sentinel; turning it back on re-acquires it. AC-8c: a browser without the API still degrades in silence. |
| R-9 | When nothing else is known, the RIR readout opens on the default RIR; when it is `null`, on the current `0`. The existing preference order is otherwise unchanged. | AC-9a: for an unplanned exercise with no history and a default of `2`, the readout opens at RIR 2. AC-9b: with the default `null` it opens at 0, as today. AC-9c: a planned exercise still opens on `plannedMinRir`, and a repeat set still opens on the set just logged — the default never overrides either. |
| R-10 | No theme control exists, `theme.css` gains no `.dark` block or `prefers-color-scheme` rule, and §32 no longer lists a theme setting. | AC-10a: grep for `dark:`, `.dark` and `prefers-color-scheme` under `src/` returns nothing new. AC-10b: §32 lists the five shipped settings and no theme, with one line recording that dark was rejected by DESIGN.md. |
| R-11 | No runtime network request is introduced, and every control works offline. | AC-11: with the service worker active and the network cut, each control changes, persists and survives a reload. |
| R-12 | `docs/PRD.md` §38 and `CONTEXT.md` state the truth after this change. | AC-12a: §38's closing line drops Settings from the not-started list, and the table records it as done with its evidence. AC-12b: `CONTEXT.md` defines `Settings` — the single row of device preferences, defaults only, never restored from a backup. |

## Contracts and Risk Controls

**Changed contracts.** `Settings` gains four optional-on-disk fields, always
present after a read. `settings.ts` gains per-field writers and loses the
whole-row `put`. The Zod `settings` object gains four optional fields.
`db/index.ts` re-exports the new writers; `queries.ts` gains a settings hook.
All additive except the writer, whose replacement is the point of R-2.

**Preserved contracts.** `SCHEMA_V1`, `SCHEMA_VERSION`, `BACKUP_VERSION`,
`RESTORED_TABLES`, every other type in `src/domain/types.ts`, `SECTIONS`' four
entries, and the whole of gym mode's timing behaviour. `dexie` stays imported
only inside `src/db`; `domain/` gains no import from either layer above it.

**Risk controls:**

1. **The partial write is the change's one data-loss path.** A whole-row `put`
   that forgets a field silently resets a preference the lifter set — the kind
   of bug nobody reports and everybody re-does. AC-2a tests it directly.
2. **The read must default per field, not per row.** Every existing install has
   a row with one field in it; treating "row exists" as "row is complete" yields
   `undefined` gates, and `undefined` is falsy — vibration and the wake lock
   would switch themselves off for every current user. AC-1a is that test.
3. **Backwards compatibility of the backup shape.** A lifter's only copy of
   their training is a JSON file on their phone. A required field added to the
   Zod shape would refuse every backup taken before today (AC-4a).
4. **Defaults preserve today's behaviour** (DEC-6). A settings screen that
   silently changes gym mode for someone who never opened it is a regression
   wearing a feature's clothes.

## Quality Obligations

- **Tests** (`src/db/repositories/settings.test.ts`, against `fake-indexeddb`):
  AC-1a (legacy row → defaults), AC-1b/AC-1c (reads write nothing), AC-2a
  (independent writes survive a reopen), AC-2b (one row). The existing exact-shape
  assertion is updated to the new default row.
- **Tests** (`src/domain/backup/schema.test.ts`): AC-4a (a `settings` object
  with only `defaultUnit` parses) and the full-shape case. The fuzz suite is not
  edited; it must still pass (AC-4c).
- **QA (manual, in the browser)** — AGENTS.MD verifies UI by running it: open
  More, change all five controls, reload, confirm each held. Start a session:
  confirm the wake lock follows the setting (AC-8b), that the timer buzzes and
  beeps per the toggles, and that an unplanned exercise with no history opens on
  the default RIR. Export a backup, restore it, confirm the settings did not
  move. Repeat the persistence check with the network off (AC-11).
- **Static/build:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` —
  all four must pass.
- **Mutation:** none. `stryker.config.json`'s allowlist is `src/domain/**`; this
  change adds no domain module. The file is not edited.

## Change Surface

Expected edits:

| Path | Change |
|---|---|
| `src/domain/types.ts` | The four fields on `Settings` (R-1) |
| `src/db/repositories/settings.ts` | Per-field defaults on read, per-field writes (R-1, R-2) |
| `src/db/repositories/settings.test.ts` | AC-1a–c, AC-2a–b; update the exact-shape assertion |
| `src/db/repositories/backup.ts` | The absent-row substitute becomes the full default row (AC-4d) |
| `src/domain/backup/schema.ts` | Four optional fields on the `settings` object (R-4) |
| `src/domain/backup/schema.test.ts` | AC-4a and the full-shape case |
| `src/db/index.ts` | Re-export the new writers |
| `src/features/data/queries.ts` | A settings hook over `getSettings` |
| `src/components/ui/switch.tsx` (new) | Radix Switch, skinned per DESIGN.md:764 |
| `src/features/more/MoreScreen.tsx` | The Settings section (R-5); amend the header comment |
| `src/features/session/RestTimer.tsx` | Vibration and sound gates (R-6, R-7) |
| `src/features/session/SessionScreen.tsx` | Pass the wake-lock setting (R-8) |
| `src/features/session/ExerciseView.tsx` | The default-RIR fallback (R-9) |
| `docs/PRD.md` | §32 (R-10b), §38 (AC-12a) |
| `CONTEXT.md` | The `Settings` entry (AC-12b) |

Do not touch:

- `src/styles/theme.css` — DEC-1. No `.dark` block, no `prefers-color-scheme`.
- `src/db/schema.ts` — R-3.
- `src/domain/backup/document.ts`'s `BACKUP_VERSION` and `RESTORED_TABLES` — A-1.
- `src/domain/backup/schema.fuzz.test.ts` — it must pass unedited.
- `src/features/shell/` — no route, no tab, no top-bar family (DEC-3).
- `src/features/session/useWakeLock.ts` — A-3: the caller supplies the gate.
- `src/domain/units.ts`, `src/domain/progression/` — no derivation changes.
- `stryker.config.json`.

## Planning Decision

**Plan required: No.**

Reason: one linear sequence with a single owner — type, repository, backup
shape, hook, control, screen, three gates, docs — no contract to freeze before
parallel work, no migration (A-2), no rollout. The two real correctness
constraints (the partial write, the per-field default) are rules this spec
states and tests name, not an ordering problem a plan would solve.

## Stop Conditions

Implementation must stop rather than invent behavior if:

- a new setting would need an index, a `stores()` change or a Dexie version
  (A-2);
- a settings field turns out to reach the database through restore (A-1);
- making the backup accept the new shape requires a `BACKUP_VERSION` bump;
- the wake-lock gate cannot be expressed through `useWakeLock`'s `active`
  argument (A-3);
- the beep needs an audio asset, a library, or a global audio singleton to work
  (DEC-2, A-4);
- any requirement would need a dark palette, a `.dark` block, or a theme
  control (DEC-1) — that is a DESIGN.md decision, not an implementation one;
- a control seems to need a Save button, i.e. a setting cannot be persisted the
  moment it changes (DEC-5);
- changing a setting appears to require rewriting stored Exercises, snapshots or
  sets — settings are defaults, never retroactive;
- unrelated working-tree changes overlap the write set above.
