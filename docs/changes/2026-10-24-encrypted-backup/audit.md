# Encrypted backup — Audit

Method: reading the files below on `feat/encrypted-backup/Josue` (based on `feat/shareable-backup/Josue`, not yet merged into `development`); `grep` for consumers.

## Current behaviour
- `saveBackup()` (`src/features/settings/saveBackup.ts`) serializes `exportBackup()` to JSON and shares or downloads it. Callers: `SettingsScreen.tsx` (`exportJson`) and `BackupReminder.tsx` — `grep -rn saveBackup src`.
- Restore: `SettingsScreen.tsx` `choose(file)` → `parseBackup(text)` (`src/domain/backup/schema.ts:421`) → confirmation → `restoreWithSafetyBackup` (`src/features/settings/safeRestore.ts`), which first downloads the current data **unencrypted**.
- The backup document carries every routine, session, set and setting, plus bodyweight — personal health data in plain JSON.
- Vitest runs in `node` (`vitest.config.ts`); Node 24 exposes `globalThis.crypto.subtle`, so Web Crypto is testable without a polyfill.

## Findings that shape the spec
- F-1 Encryption has to wrap the serialized text, not change the document: `parseBackup`, `BACKUP_VERSION` and restore stay exactly as they are, and an older build reading an encrypted file must refuse it clearly rather than half-parse it (today it would fail on `version`/schema — acceptable, but the new build should recognise the envelope first).
- F-2 The password is never stored; a forgotten password makes that file unrecoverable (decision DEC-1: encryption is optional per backup).
- F-3 Web Share needs the tap's activation; key derivation adds time before `navigator.share`, so the existing `NotAllowedError` → download fallback matters more for encrypted backups.
- F-4 The safety copy taken before a restore stays a plain download on the same phone; out of scope, noted.
