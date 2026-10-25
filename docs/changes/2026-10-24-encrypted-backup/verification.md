# Encrypted backup — Verification

Verdict: Pass (independent reviewer: Pass with decision findings F-1..F-3; all three fixed and re-checked by the writer). Acceptance by Josue: accepted 2026-10-24.
Base: `84f7bb8` (`origin/feat/shareable-backup/Josue`); changes uncommitted on `feat/encrypted-backup/Josue`.
Size: medium. Reliability: strict.

## Checks run (final state)
| Check | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm lint` | 0 errors; 2 warnings, both the pre-existing `ImportWizard.tsx` exhaustive-deps |
| `pnpm test` | 995 passed / 45 files (adds seven encryption tests) |
| `pnpm build` | pass |

## Independent review (reviewer agent, medium)
Confirmed R-1..R-6: PBKDF2-SHA-256 at 600 000 iterations, fresh 16-byte salt and 12-byte IV per file from `getRandomValues`, AES-256-GCM with a non-extractable key, no new dependency; zod envelope with iteration bounds checked before deriving; minimum length and confirm field; reminder stays plain; wrong password writes nothing; plain backups, `parseBackup`, restore and the safety copy untouched; domain imports only zod and Web platform globals; no logging, password never stored.

| ID | Finding | Resolution |
|---|---|---|
| F-1 | Salt/IV of any length passed validation; a broken IV read as a wrong password. | Decoded lengths checked (16/12 bytes) → "damaged" error. |
| F-2 | A damaged-file error from unlock appeared at the page bottom. | Shown inside the unlock form. |
| F-3 | Only the lower iteration bound was tested. | Test covers the ceiling, bad base64, a short IV and a missing field. |

## Real-UI scenario (dev server :5235, 375×812, real clicks and typing, generated test passwords)
- Mismatched passwords → "The two passwords differ. Type the same one twice."
- Matching → file `trainlog-backup-2026-10-24-encrypted.json` (download fallback; share stubbed off), envelope PBKDF2/SHA-256/600 000/AES-GCM, no exercise or routine name in the file.
- Restore: the file is recognised as encrypted and prompts for the password; a wrong one → "That password does not open this backup. Nothing was restored."; the right one → the usual confirmation (1 routine, 1 session, 1 set) → restored. No console errors.

## Visual pass (after Josue asked about style)
The encrypted backup got its own ruled subsection with a Head and one sentence, matching Restore, so its form no longer reads as part of Save backup. At 320 px the submit label wrapped; shortened to "Encrypt & save" and kept on one line (48 px tall, no horizontal scroll).

## Not verified / accepted limitations
- Real Web Share on a phone; on iOS the key derivation may outlive the tap's activation, in which case the file downloads instead.
- The safety copy before a restore stays a plain download on the same phone.
