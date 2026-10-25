# Encrypted backup

Status: Ready for implementation
Size: medium
Reliability: strict
Implementation effort: medium
Parent: `docs/changes/2026-10-24-shareable-backup/` (builds on `saveBackup`)
Triggered artifacts: audit.md (strict: sensitive data, cryptography)

Goal: a lifter can protect a backup with a password before it leaves the phone,
so a cloud folder or inbox holding it cannot read it; restoring such a file asks
for the password.

Evidence facts: see `audit.md`.

Decisions (Josue, 2026-10-24):
- DEC-1 Optional per backup; plain backups keep working unchanged.

## Required behaviour
- R-1 `src/domain/backup/encryption.ts`: `encryptBackupText(text, password)` → envelope JSON; `isEncryptedBackup(text)`; `decryptBackupText(text, password)` → the original text, or `WrongPasswordError` when authentication fails.
- R-2 Algorithm: PBKDF2-HMAC-SHA-256 with a random 16-byte salt and 600 000 iterations (OWASP Password Storage Cheat Sheet figure) derives an AES-256-GCM key; a random 12-byte IV; all via Web Crypto. No dependency added.
- R-3 Envelope: `{ format: "trainlog-encrypted-backup", version: 1, kdf: { name, hash, iterations, salt }, cipher: { name, iv }, data }`, binary fields base64. Validated with zod; iterations outside 100 000–10 000 000 are refused before deriving.
- R-4 Password: at least 8 characters, typed twice when encrypting.
- R-5 Settings: "Save encrypted backup" opens password + confirm fields and saves through the same share/download path, file `trainlog-backup-<date>-encrypted.json`. The post-session reminder stays plain.
- R-6 Restore: an encrypted file prompts for the password before the existing confirmation; a wrong password says so and writes nothing.

## Acceptance
- AC-1 Round trip: encrypt then decrypt returns the exact text.
- AC-2 A wrong password or a tampered byte fails with `WrongPasswordError` / refusal; nothing is restored.
- AC-3 A plain backup is not taken for an encrypted one, and restores as before.
- AC-4 In the app: save encrypted (download fallback), restore it with the right password → confirmation shows the same summary; wrong password → refused.
- AC-5 The encrypted file contains no readable training data (no exercise names in the file).

## Preserved
Backup document, `BACKUP_VERSION`, `parseBackup`, restore, safety copy, reminder.

## Quality
- Tests: domain round trip, wrong password, tamper, plain-vs-encrypted detection, iteration bounds, AC-5 (envelope contains no plaintext).
- Static/build: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- Review: independent reviewer (strict).

Done when: in the running app an encrypted backup is saved and restored with its password, and refused without it.

## Stop if
- A dependency would be needed for the cryptography.
- Encryption requires changing the backup document.
