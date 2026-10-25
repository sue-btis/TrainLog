# Open-source guides: format reference, contributing, README refresh

Status: Ready for implementation
Size: quick
Reliability: lean
Implementation effort: medium
Triggered artifacts: none

Goal: someone arriving at the repository without the author can write a routine
file and open a correct pull request using English documents only, and the
README describes what the app does today.

Evidence facts:
- Entry point: the format is enforced by `src/domain/routine-file/schema.ts:32` (exercise), `:54` (file), `:107` (`parseRoutineFile`) and the semantic codes at `src/domain/routine-file/validate.ts:7`; measurement shapes in `src/domain/measurement.ts`. Stale README section at `README.MD:94`.
- Covering tests: `src/domain/routine-file/validate.test.ts` and `to-domain.test.ts` already read YAML from `docs/` and validate it.
- Consumers of altered contracts: no contract altered (documentation only).

Decisions (Josue, 2026-10-24):
- DEC-1 The code is the authority. `docs/FORMAT.md` says it is derived from the parser; a test keeps its examples parsing and validating. PRD §12 stays the product spec, unchanged.
- DEC-2 Fix AGENTS.MD's "eight" semantic checks to the twelve `validate.ts` has, in this change.

Scope:
- Include: `docs/FORMAT.md` (fields, defaults, the nine measurements and their target axis, exercise resolution incl. former names, structural vs semantic validation with every code, progression); a test that extracts every `yaml` block from FORMAT.md and requires it to parse and validate clean; `CONTRIBUTING.md` (setup, checks, layering and invariants pointing at AGENTS.MD, branch convention, language and vocabulary rules, licences); README "What it does", "Known limits" and Documentation table brought up to date; the AGENTS.MD count.
- Exclude: translating the PRD; changing any code path or format behaviour.

Acceptance:
- AC-1 Every `yaml` block in FORMAT.md parses and has no semantic issue (test).
- AC-2 FORMAT.md lists every exercise field in `schema.ts`, every measurement in `MEASUREMENTS`, and every `SemanticIssueCode`.
- AC-3 README no longer claims exercises cannot be created, renamed or deleted, and lists the features shipped since (stopwatch, by-routine comparison, weekly volume, shareable and encrypted backups, storage warning).
- AC-4 CONTRIBUTING states nothing that contradicts AGENTS.MD or the README's licence section.
- AC-5 AGENTS.MD states twelve semantic checks.

Change surface:
- Expected: `docs/FORMAT.md`, `src/domain/routine-file/format-doc.test.ts`, `CONTRIBUTING.md`, `README.MD`, `AGENTS.MD`.
- Do not touch: production code, PRD.

Quality: the new test; `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; a read-through of each claim against the cited source file.

Done when: `pnpm test` runs the FORMAT.md examples green and the README, CONTRIBUTING and AGENTS.MD agree with the code.

Stop if: documenting a field reveals the code and PRD disagree in a way that needs a product decision (record it; do not resolve it in docs).
