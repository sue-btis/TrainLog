# ADR-005 — A versioned JSON backup, with optional password encryption

Status: Accepted
Date: 2026-10-30
Decision owners: Josue
Accepted by: Josue, 2026-10-30, «ADR-002 Sin fecha,ADR-003 Snapshot,ADR-004 IndexedDB/Dexie,ADR-005 Backup»
Related: FR-075–FR-082, NFR-008, NFR-009, BR-021, BR-022, ADR-001
Reversibility: one-way — every backup file already in the wild must keep restoring.

## Context

Under ADR-001, the backup file is the only copy of the data that lives off the
device. Lifters store it wherever they like: a cloud drive, an email to themselves.
An old file has to restore in a newer app, and a file that lands in a third-party
store should not expose training data.

## Decision Drivers

- Backward compatibility across versions (NFR-009, FR-082).
- A newer file is refused rather than truncated (FR-081).
- Confidentiality when a password is set (NFR-008, FR-076).
- No dependency beyond the platform (CON-001).

## Options Considered

### Option A — Plain JSON only

- Benefits:
  - Readable and simple.
- Costs/risks:
  - Exposes the data wherever the file is stored.
- Ruled out by: FR-076.

### Option B — Encryption through a third-party library or format

- Benefits:
  - A ready-made format.
- Costs/risks:
  - An extra dependency, and its own compatibility risk.

### Option C — A JSON document with a declared `version`, optionally wrapped in a Web Crypto envelope

- How it works: a key is derived from the password with PBKDF2-HMAC-SHA-256
  (600,000 iterations) and a random 16-byte salt. The data is encrypted with
  AES-GCM-256 and a random 12-byte IV.
- Benefits:
  - Platform-native.
  - Tamper-evident.
  - The envelope states its own parameters, within bounds.
- Costs/risks:
  - A forgotten password makes the file unrecoverable.

## Decision

Option C.

- Format: the backup document is at version 3 (`src/domain/backup/document.ts`).
- Restore checks: it validates the whole file before any write, refuses versions
  newer than the app, and fills defaults for fields that older versions lack.
- What restore replaces: the eight training stores, in one transaction. Settings
  are exported but never restored.
- Safety backup: a backup of the current data is saved before every restore.
- Encrypted envelope: the format is `trainlog-encrypted-backup`, version 1.

## Consequences

### Positive

- A backup stored on a cloud drive reveals nothing without its password.

### Negative / Trade-offs

- Each change to the stored schema must bump the backup version, and must keep
  every earlier version restorable.

## Verification / Revisit Trigger

- The backup tests cover a round-trip at each version, the refusal of a newer
  version, a wrong password, and tampering.
- Revisit the iteration count when OWASP guidance changes.
