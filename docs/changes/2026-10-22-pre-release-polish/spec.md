# Pre-release polish — Spec

Status: Approved by Josue (lote A)
Size: medium
Reliability: strict
Implementation effort: medium
Base: `3f7dd02`. Artifacts: `audit.md`, `spec.md`, `verification.md`. No plan (one writer), no execution.md (self-verified).

## Goal

Fix visible defects before the repo goes public. Seven independent items; out of scope: lote B, progression basing, internal-file removal.

## Requirements

- REQ-1 `programmingLine` shows the weight unit only for measurements that collect `weight`, and writes rest as `rest Ns`.
- REQ-2 Session ghost values (`Cell`, `ghostLabel`) and the set aria-labels use `setLine` so no `null` reps or `0×null` appears for any measurement.
- REQ-3 `PreviousPanel` "suggested" is formatted by the suggestion's axis.
- REQ-4 First-run offers "Try an example routine" on Today's empty state and in `FileStep`, loading a bundled **version 2** YAML through the existing wizard (`chooseFile`/hand-off). The in-app example and the `FileStep` hint say version 2 (1 still accepted).
- REQ-5 `ensurePersistentStorage` is requested once at app start.
- REQ-6 `index.html` carries description, Open Graph and Twitter tags.
- REQ-7 `toCsv` neutralises text cells starting with `=`, `+`, `-`, `@` (also tab/CR) by prefixing `'`.
- REQ-8 `exportBackup` reads all tables in one read transaction.
- REQ-9 README gains "Known limits" and a live-demo placeholder line.

## Decisions

- og:image: `/pwa-512x512.png` (served from `public/`), relative. Scrapers need an absolute URL, which depends on the demo domain not yet known; revisit when the demo link exists.
- Example routine: reuse `EXAMPLE_ROUTINE_YAML` switched to `version: 2` — single source. Adding a second exercise broke `to-domain.test.ts` fixtures, so it stays one exercise.
- Tests keyed to `EXAMPLE_YAML` that assert version 1 are updated to 2.

## Acceptance

- AC-1 `programmingLine` for `duration` → `3×45–60s · rest 60s` (no unit); for `weight_reps` keeps unit.
- AC-2 `setLine`-based ghost for a duration set contains no `null`.
- AC-3 CSV: exercise `=cmd` exports as `'=cmd`; ordinary names unchanged.
- AC-4 `exportBackup` still passes its tests (transaction wrapping).
- AC-5 `pnpm lint`, `typecheck`, `test`, `build` pass.
