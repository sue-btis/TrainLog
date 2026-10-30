# System Design Review

This file is review evidence and workflow state for the current baseline only. It is not a canonical product, architecture, schema or contract authority. A new baseline rewrites it and carries over every finding that is still `OPEN`, `ACCEPTED` or `BLOCKED`, with its ID. Resolved and invalid findings stay in git history.

## Review State

- Baseline ID: `RV-001`
- Current review mode: `baseline`
- Reviewer: an independent subagent that did not author the package, 2026-10-30
- Reconciliation cycles used: `0`
- Maximum automatic reconciliation cycles: `3`
- Current verdict: `Approved for build planning`
- Escalate exit: `none`

## Mechanical Checks

| Command | Result |
|---|---|
| `node <reviewing-system-design>/scripts/check-package.mjs <repo root>` | Pass: "Package checks passed.", exit 0 |
| `pnpm typecheck` | Pass, exit 0 |
| `pnpm lint` | Pass, exit 0. There are 0 errors and 2 earlier warnings (`react-hooks/exhaustive-deps`, `src/features/import/ImportWizard.tsx:114,118`). |
| `pnpm test` | Pass: 46 files, 1023 tests, exit 0 |
| `npx -y -p @dbml/cli dbml2sql docs/design/data/schema.dbml` | Pass, exit 0 |
| `structurizr validate -workspace docs/design/architecture/architecture.dsl` (CLI v2025.11.09, run 2026-10-30 after the baseline) | Pass, exit 0. The four views (Context, Containers, Layers, Deployment) render. |
| OpenAPI / AsyncAPI | Not applicable (manifest `not_applicable`) |

## Current Blocking Summary

| Severity | Open | Ready for verification | Resolved | Accepted/Invalid |
|---|---:|---:|---:|---:|
| BLOCKER | 0 | 0 | 0 | 0 |
| MAJOR | 0 | 0 | 0 | 0 |
| MINOR | 0 | 4 | 0 | 0 |
| NOTE | 0 | 2 | 0 | 0 |

## Findings

### F-001 — The authorities say the snapshot is taken when an exercise starts, but the code takes it when the Session starts

- Severity: `MINOR`
- Status: `READY_FOR_VERIFICATION`
- Origin: `BASELINE`
- Classification: `MINOR_INCONSISTENCY`
- Owner: `docs/product/prd.md` (FR-036, BR-002). Also affected: `docs/design/ux/flows.mmd`, ADR-003 and `docs/design/domain.md`.
- Evidence:
  - `startWorkout` snapshots every Planned Exercise at once (`src/domain/session/index.ts:181-205`).
  - The code says targets are "copied when the Session starts" (`src/domain/types.ts:118`).
  - The documents say "when an exercise starts" (PRD FR-036, BR-002, ADR-003, flows node P).
- Why it matters: an implementer could snapshot lazily, which changes what an open Session holds. For example, a Planned Exercise added under FR-023 during an open Session would then join it.
- Required resolution: FR-036, BR-002, flows node P and ADR-003 say that planned targets are snapshotted when the Session starts, and that unplanned exercises are snapshotted when added.

### F-002 — The manifest does not declare the authorities for the file contracts

- Severity: `MINOR`
- Status: `READY_FOR_VERIFICATION`
- Origin: `BASELINE`
- Classification: `COVERAGE_GAP`
- Owner: `docs/spec/manifest.yaml`
- Evidence: `authoritative_sources` has no entry for `docs/FORMAT.md`, although the brief's applicability table says the manifest declares it. The backup document format also has no declared owner.
- Why it matters: these two contracts are the compatibility surfaces behind NFR-009 and NFR-011.
- Required resolution: the manifest declares `docs/FORMAT.md` as the routine-file contract, and names who owns the backup format: ADR-005 or `src/domain/backup/`.

### F-003 — FR-089 leaves out the persistent-storage request made after Accept

- Severity: `MINOR`
- Status: `READY_FOR_VERIFICATION`
- Origin: `BASELINE`
- Classification: `MINOR_INCONSISTENCY`
- Owner: `docs/product/prd.md`
- Evidence: FR-089 says the request happens "after a Session is finished". The code also calls `ensurePersistentStorage()` after a Routine is accepted (`src/features/import/ImportWizard.tsx:214`).
- Why it matters: a rebuild that follows FR-089 would drop one of the protections against eviction.
- Required resolution: FR-089 and the J-001 flow name both triggers.

### F-004 — Where `pwa` sits in the layering is not declared

- Severity: `MINOR`
- Status: `READY_FOR_VERIFICATION`
- Origin: `BASELINE`
- Classification: `DESIGN_GAP`
- Owner: `docs/design/architecture/architecture.dsl`. Also affected: `quality-attributes.md` AR-001.
- Evidence: `features` imports `@/pwa/persistence` in four files (`SessionScreen.tsx:63`, `ImportWizard.tsx:7`, `SettingsScreen.tsx:68`, `StorageWarning.tsx:5`). The DSL models only `pwa -> serviceWorker`.
- Why it matters: build slices that touch durability or updates have no rule for which way a dependency may point.
- Required resolution: the DSL adds a `features -> pwa` relationship, and AR-001 places `pwa` in the layering.

### F-005 — The brief still lists PD-A and PD-B as open

- Severity: `NOTE`
- Status: `READY_FOR_VERIFICATION`
- Origin: `BASELINE`
- Classification: `EDITORIAL`
- Owner: `docs/product/brief.md`
- Evidence: the brief's "Open Product Decisions" still lists both. In PRD §15, PD-004 is Decided and PD-005 is Open.
- Required resolution: the brief points to PRD §15, or marks PD-A as decided.

### F-006 — domain.md calls Effort "session load"

- Severity: `NOTE`
- Status: `READY_FOR_VERIFICATION`
- Origin: `BASELINE`
- Classification: `EDITORIAL`
- Owner: `docs/design/domain.md`
- Evidence: the domain language table reads "Derived session load". BR-018 says Effort is "never called load", and CONTEXT.md lists "Load" under Avoid.
- Required resolution: use the CONTEXT.md wording.

## Cycle History

### Baseline — cycle 0

- BLOCKER open: `0`
- MAJOR open: `0`
- MINOR open: `4`
- NOTE open: `2`
- Verdict: `Approved for build planning`

### Post-baseline corrections — 2026-10-30

- At the stakeholder's request («Sí, corregir»), the author applied all six non-blocking findings in their owning artifacts: prd.md (FR-036, FR-089, BR-002, BR-015), ADR-003, flows.mmd, domain.md, brief.md, manifest.yaml, architecture.dsl and quality-attributes.md.
- These edits were made directly, not through a change folder, because the package had been approved minutes earlier and nothing had yet been built on it.
- After the edits, check-package.mjs passes and dbml2sql exits 0.
- Each finding stays READY_FOR_VERIFICATION until an independent follow-up verification confirms it.
- Verdict unchanged: Approved for build planning.
