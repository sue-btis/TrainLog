# Pre-release polish — Audit

Base: `master`-derived branch `change/routine-export` at `3f7dd02`, tree clean in `src/`.
Method: direct read plus `grep` for consumers (no language server used; lists may include unrelated matches).

## Findings

| # | Entry point | Consumers (grep) | Existing tests |
|---|---|---|---|
| 1 | `format.ts` `programmingLine` appends `exercise.unit` unconditionally and prints bare `{rest}s` | `TodayScreen.tsx:254`, `RoutineDetailScreen.tsx:167`. `ExercisesStep.tsx:588` defines its **own** local `programmingLine` (file model, already `rest Ns`, no unit) — not affected | none for `programmingLine`; `snapshotLine` tested |
| 1b | `ExerciseView.tsx` `Cell` (`before.weight×before.reps`), `ghostLabel`, set aria-label (`for ${set.reps} reps`) | only inside `ExerciseView.tsx` | none |
| 1c | `PreviousPanel.tsx:53` renders `suggestion.weight suggestion.unit`; `LoadSuggestion.axis`/`value` exist and `progressAxisOf` can be `load\|reps\|duration\|distance\|pace` | `PreviousPanel.tsx` only | none |
| 2 | `example.ts` says `version: 1`; `FileStep.tsx:58` hint says `version: 1`; wizard takes files via `chooseFile(File)` and `ImportRoutineButton` hand-off (`takeHandedOffFile`) | `EXAMPLE_YAML` (re-export in `fixtures.ts`) is used by `parse.test.ts` (asserts `version` 1, replaces `'version: 1'`) and `to-domain.test.ts` | parse/to-domain tests |
| 3 | `ensurePersistentStorage` called only at `SessionScreen.tsx:200`, `ImportWizard.tsx:202`; `main.tsx` has no call | — | none |
| 4 | `index.html` has `<title>` only; `public/` has `pwa-512x512.png`, `icon.svg` | — | — |
| 5 | `csv.ts` `escape` only quotes `",\n\r` | `toCsv` only | `csv.test.ts` |
| 6 | `backup.ts` `exportBackup` reads 8 tables via `Promise.all` plus `getSettings()` (reads `db.settings`) | backup export UI | `backup.test.ts` `exportBackup` block |

## Contradictions / unknowns

- Brief says "reuse `setLine`" for `programmingLine`; `setLine` formats a `CompletedSet`, not a programme. Reuse applies to ghost/aria text; `programmingLine` instead gates the unit on `collects(measurement, 'weight')` (the measurement module owns this fact).
- `getSettings()` touches a table; the transaction must include `db.settings` (check its table name in implementation).
- Known-limits claims (item 7) are checked against `App.tsx` routes: no session list route, no settings action to clear data.
