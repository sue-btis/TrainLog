# Settings — Verification

Verdict: **Pass with accepted limitations**
Size: medium
Reliability: strict

## Audit Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Declared base | `2826894` |
| Audited head / working tree | `2826894` + uncommitted work on `change/settings` |
| Diff range | `git diff 2826894` — 14 modified files, 2 new (`src/components/ui/switch.tsx`, `docs/changes/2026-08-21-settings/`) |
| Verification date | 2026-08-21 |

Every claim below was re-derived from the diff, a re-run check, or the running
app. The execution report was not taken as evidence for anything.

## Requirement Compliance

| Requirement / AC | Implementation Evidence | Independent Check | Result |
|---|---|---|---|
| R-1 / AC-1a-c | `Settings` gains four optional fields; `resolve()` merges `DEFAULT_SETTINGS` over the stored row and returns `ResolvedSettings` | Read the diff of `settings.ts`: `resolve` is pure and `getSettings` never writes. Re-ran `settings.test.ts`. In the running app, a hand-written legacy row `{id, defaultUnit:'lb'}` rendered as lb + vibration on + sound off + awake on, and the stored row was **still the two-field row** after the read | Pass |
| R-2 / AC-2a-c | `setSetting` does read-modify-write inside `db.transaction('rw', db.settings, …)`; five thin named writers over it | Diff shows no `put` of a freshly-built object anywhere. Unit test writes all five in turn, reopens the database, reads all five back. In the browser, three switches clicked in the same tick produced one row carrying all three changes | Pass |
| R-3 / AC-3 | No schema edit | `git diff 2826894 -- src/db/schema.ts` is **empty**. No `stores()`, `version(n)` or index string anywhere in the diff. The pre-existing database opened without an upgrade through the whole QA run | Pass |
| R-4 / AC-4a-d | Four optional fields on the Zod `settings`; `exportBackup` emits the resolved row | Unit tests: legacy row parses, full row parses, a wrong-typed setting is **refused at `settings.timerSound`** rather than stripped. In the running app: export carried all five fields with `version: 1`; a document with a legacy settings row parsed; a restore left the device's settings byte-identical. `restoreBackup` still scopes its transaction to `RESTORED_TABLES`, which does not include `settings` — read in source, not assumed. Fuzz suite unedited and passing | Pass |
| R-5 / AC-5a-d | `SettingsSection` + `Toggle` over `useSettings`, five controls, save-on-change | AC-5a: all five changed, reload, all five held (`lb`, RIR `2`, three switch states). AC-5b: accessibility tree exposes two `combobox` and three `switch` nodes, each with its name; both selects opened **and committed a value by keyboard alone**; every `<label htmlFor>` resolves to a real control id. AC-5c: `Export backup` and `Export history` still run — the screen reported *"3 sets exported"*. AC-5d: the unit copy states it is a default and converts nothing | Pass |
| R-6 / AC-6a-c | `if (vibrate)` in the fire-once effect | Observed at zero, in the page's own world: vibration **off** + sound on → **0** `navigator.vibrate` calls; vibration **on** + sound off → **1**, same three-pulse pattern. The countdown still rebuilds from `since` — `restRemaining` and the pause/restart/add-time paths are untouched in the diff | Pass |
| R-7 / AC-7a-c | `beep()`, a WebAudio oscillator, behind `if (sound)` | Sound **on** → **1** `AudioContext` constructed at zero; **off** → **0**. No asset added (`src/assets/` is still four font files). The network log for the whole run holds only `localhost:5233` modules and the two self-hosted fonts. `beep` is wrapped in `try/catch`; no console error in the session | Pass |
| R-8 / AC-8a-c | `useWakeLock(session !== undefined && (settings?.keepScreenAwake ?? true))` | **Not observable here.** With a stubbed `navigator.wakeLock.request` and the setting **on**, the count stayed 0 — because `useWakeLock` returns early unless `document.visibilityState === 'visible'` and the pane runs hidden. On and off are therefore indistinguishable in this environment. Code inspection only: one boolean into the hook's `active`, whose effect re-runs on change and whose cleanup releases the sentinel | **Accepted limitation** |
| R-9 / AC-9a-c | `?? defaultRir ?? 0` in `openingValues`, threaded from settings | With the default at 2: an unplanned Leg Press with no history opened at **RIR 2** and in **lb** (both settings), while a planned Front Squat opened at **RIR 1** — its own `plannedMinRir` — so the default never overrode the plan. AC-9b holds by the same expression with `null`. `0` as a stored default also survives, since `??` treats it as a value | Pass |
| R-10 / AC-10a-b | §32's theme row removed, the rejection recorded | `grep -rn "dark:\|\.dark\b\|prefers-color-scheme" src/` → **no matches**. `theme.css` is not in the diff. §32 now lists five settings and states why the sixth is gone | Pass |
| R-11 / AC-11 | No request added | Network log for the entire QA run: dev-server modules and fonts only, all `localhost`. `pnpm build` regenerated the service worker (23 precache entries) | Pass (dev). Production offline behaviour is the service worker's and is unchanged by this diff |
| R-12 / AC-12a-b | §38 gains a `Data \| Settings ✅` row and its closing line narrows to two items; `CONTEXT.md` gains **Settings** | Both read in the diff. The CONTEXT entry states the invariant that matters — settings are defaults, belong to the device, and are carried by a backup but not restored | Pass |

## Automated Checks

| Command / Check | Result | Covers | Evidence / Notes |
|---|---|---|---|
| `pnpm typecheck` | Pass | all | clean, both projects |
| `pnpm lint` | Pass | all | clean |
| `pnpm test` | Pass | all | 26 files, 362 tests |
| `pnpm build` | Pass | R-11 | service worker regenerated; the pre-existing >500 kB chunk warning is unchanged by this diff |
| `vitest --coverage` on `src/db/repositories/settings.ts` | Pass | R-1, R-2 | 100% statements, lines and functions; no branches in the file |
| `vitest --coverage` on `src/domain/backup/schema.ts` | Pass | R-4 | 100% lines, 94.11% branches. The two uncovered branches are at lines 287 and 473 — a symbol path segment and a non-`Error` throw — both pre-existing and outside this change's lines |
| `npx stryker run --mutate src/domain/backup/schema.ts` | Pass | R-4 | **83.19%**, above the repo's own `break: 80`. 198 killed, 40 survived, 0 timeouts. **No survivor falls in the changed region (lines 246–262)** — every mutant injected into the new settings shape was killed. Survivors are pre-existing: enum literals and error-message strings |

## QA

Run against `pnpm dev --port 5233`, viewport 375×812, IndexedDB seeded by
importing `docs/examples/routine.yaml` through the wizard.

1. Open `/more` on a fresh database.
   Expected: five controls at their defaults, matching today's behaviour.
   **Actual:** kg · No default · vibration on · sound off · keep awake on.
2. Change all five, reload.
   Expected: every value held.
   **Actual:** lb · 2 · off · on · off, all present after the reload.
3. Write a legacy row `{id:'settings', defaultUnit:'lb'}` by hand, reload.
   Expected: lb plus the defaults for the four later settings, and the row left alone.
   **Actual:** exactly that; the stored row was still two fields afterwards.
4. Start a session, add an unplanned exercise with no history.
   Expected: opens on the settings RIR and the settings unit.
   **Actual:** RIR 2, lb. The planned Front Squat opened on RIR 1, its own target.
5. Log a set, let the rest reach zero with vibration off / sound on.
   Expected: no buzz, one beep.
   **Actual:** 0 vibrate calls, 1 AudioContext.
6. Repeat with vibration on / sound off.
   Expected: one buzz, no beep.
   **Actual:** 1 vibrate call, 0 AudioContext.
7. Export a backup, restore it.
   Expected: the document carries all five settings; the device's settings do not move.
   **Actual:** both confirmed; `version` still 1.
8. Press `Export backup` and `Export history` on `/more`.
   Expected: the data actions still work.
   **Actual:** *"3 sets exported."*

Not run: the wake-lock check of AC-8 — see Limitations.

## Ownership and Scope

| Workstream | Assigned Write Set | Actual Files | Compliant? |
|---|---|---|---:|
| Settings (single owner) | The 15 paths in the spec's Change Surface | Exactly those 15 | Yes |

Files the spec put out of bounds were confirmed untouched by
`git diff 2826894 --stat`: `src/db/schema.ts`, `src/domain/backup/document.ts`,
`src/domain/backup/schema.fuzz.test.ts`, `src/styles/theme.css`,
`src/features/session/useWakeLock.ts`, `stryker.config.json`, `package.json`,
`pnpm-lock.yaml` — all absent from the diff.

## Contract / Integration Review

- **Frozen contract fidelity.** `SCHEMA_V1`, `SCHEMA_VERSION`, `BACKUP_VERSION`,
  `RESTORED_TABLES` and `SECTIONS` are unchanged. `Settings` grew four optional
  fields; the new `ResolvedSettings = Required<Settings>` is what every consumer
  above the repository sees, so optionality cannot leak into a screen.
- **Layering.** `dexie` is still imported only inside `src/db`. `domain/` gained
  no import from `db/` or `features/`. `MoreScreen` reaches the database through
  `@/db` and `useSettings`, never through Dexie.
- **Integration gate.** One combined diff, inspected in full. No generated file,
  migration, project file or lockfile changed.

## Quality Metrics

- Changed-line coverage: 100% on both changed logic files (strict target 90%).
- Changed-branch coverage: 100% on `settings.ts` (no branches), 94.11% on
  `schema.ts` with both gaps pre-existing (strict target 80%).
- Mutation scope/score: `src/domain/backup/schema.ts`, **83.19%** (repo break
  threshold 80, strict default 70). No survivor in the changed lines.
- Flaky/skipped tests affecting scope: none.

## Missing / Partial Requirements

- **R-8 is implemented but unverified by QA.** See Limitations.

## Extra / Unrequested Changes

Two, both recorded in `execution.md` and both re-checked here:

1. **`useDefaultUnit` deleted** from `queries.ts`. `SessionScreen` was its only
   consumer and now reads the whole row; `getDefaultUnit` — which `ImportWizard`
   calls directly — is untouched. Verified by grep: no remaining reference.
2. **The vibration/sound effect takes its settings as dependencies** rather than
   through a ref, because a ref written during render trips
   `react-hooks/refs`. Safe for the reason the code states: the fire-once flag
   makes a re-run after zero a no-op.

## Defect Found and Fixed During Verification

The three toggle labels were written as
`<Label className="type-title normal-case tracking-normal">`. `Label` already
binds `type-label` — the 10px uppercase mono of a section heading — so the
element carried **two competing type utilities**, with CSS source order deciding
the winner and two hand-written utilities undoing the loser's casing and
tracking. It rendered correctly (18px Inter 700, confirmed by computed style),
but only by luck: reordering `theme.css` would silently flip three labels to
10px uppercase mono, and DESIGN.md binds the type scale once for exactly this
reason. `cn`/tailwind-merge cannot help — these are custom `@utility` classes it
does not know conflict.

Fixed by dropping `Label` for all five settings rows in favour of a plain
`<label htmlFor>` carrying one type utility. Re-verified: computed style is
18px Inter for all five, every `htmlFor` resolves, and the accessibility tree
still exposes two named comboboxes and three named switches. Typecheck, lint,
tests and build re-run clean afterwards.

## Security / Tenant / Permission / Compatibility Concerns

None. No auth surface, no network, single local user. The one compatibility
question — an old backup meeting a newer schema — is covered by R-4 and was
exercised both in unit tests and in the running app.

## Limitations or Deviations

- **AC-8 (wake lock) is unverified.** The browser pane runs hidden and
  `useWakeLock` deliberately declines to request a lock unless the document is
  visible, so the setting's on and off states are indistinguishable in this
  environment. **Accepted, pending one check on a real device or a foreground
  window:** open a session with the setting on and confirm the screen stays lit;
  turn it off mid-session and confirm it sleeps again. Owner: the user, before
  merge or on first device install.

## Merge Risk

**Low.**

The change is additive at every contract it touches, the two failure modes that
could have lost a lifter's data — a whole-row write and a backup refused for
being old — are each covered by a unit test *and* an observation in the running
app, and mutation testing found no gap in the changed validation logic. The one
unverified requirement holds the screen awake; its failure mode is a screen that
sleeps between sets, not data loss, and it is one boolean away from what
already shipped.
