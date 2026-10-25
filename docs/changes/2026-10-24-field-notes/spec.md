# Import wizard field reference matches the parser

Status: Ready for implementation
Size: quick
Reliability: lean
Implementation effort: medium
Parent: `docs/changes/2026-10-24-open-source-guides/` (findings F-2, F-3)
Triggered artifacts: none

Goal: the field reference the import wizard shows ("What a routine file looks like" → "the fields") says what the parser actually requires and does.

Evidence facts:
- Entry point: `FIELD_NOTES` in `src/domain/routine-file/example.ts`, rendered by `src/features/import/FileStep.tsx:149`.
- Covering tests: `src/domain/routine-file/example.test.ts` (demo routine only; nothing covered `FIELD_NOTES`).
- Consumers of altered contracts: `FIELD_NOTES` — only `FileStep.tsx` (`grep -rn FIELD_NOTES src`). Shape unchanged.

Scope:
- Include: `progression` required; `reps` optional with a new `target` entry ("reps or target, never both"); a `measurement` entry; `version` no longer claims version 1 is read differently; `weeks` no longer claims a range the importer does not check; `unit` described as the default a new set opens on (AGENTS.MD "Weight carries its unit"); `name` describes catalog-then-own matching; `progression` describes advancing on load or on the target axis. A test that every exercise field the parser reads is listed, and that each entry is marked required exactly when the parser refuses a file without it.
- Exclude: the README's version sentence (lives on `docs/open-source-guides/Josue`, fixed there).

Acceptance:
- AC-1 For every listed field except `target`, removing it from a valid file makes `parseRoutineFile` fail iff the entry says required.
- AC-2 The listed exercise fields equal the fields a full exercise row carries, plus `target`.
- AC-3 The wizard shows the corrected entries.

Done when: the test passes and the wizard's field list reads as above.
