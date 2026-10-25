# Shareable backup and post-session reminder

Status: Ready for implementation
Size: quick
Reliability: lean
Implementation effort: medium
Triggered artifacts: none

Goal: a backup reaches somewhere that is not this phone in two taps — the
phone's own share sheet, where the lifter picks Drive, iCloud Files, email to
self — and the app asks for one at the moment data was just added: the finish
screen of a session, when the last backup is a week old or there is none.

Evidence facts:
- Entry point: `src/features/settings/SettingsScreen.tsx:93` (`exportJson`); finish screen `src/features/history/SessionDetailScreen.tsx:35` (`justFinished`).
- Covering tests: none for the export UI (UI is verified by running it); `src/domain/backup/*.test.ts` cover the document.
- Consumers of altered contracts: no contract altered. The backup document, `lastBackupAt` setting and restore are unchanged.

Scope:
- Include: `saveBackup()` in `src/features/settings/` — builds the same document, offers it through the Web Share API with a file when `navigator.canShare` accepts it, falls back to the existing download otherwise or when the browser refuses the share; a cancelled share records nothing. Settings' button uses it. A reminder on the finish screen with a Save backup button when `lastBackupAt` is null or 7+ days old.
- Exclude: encryption, automatic backups, any network request by the app, changing the 14-day warning in Settings, the safety copy before restore (stays a download).

Acceptance:
- AC-1 Where file sharing is supported, Save backup opens the share sheet with `trainlog-backup-<date>.json`; completing it records `lastBackupAt`.
- AC-2 Cancelling the share records nothing and shows no error.
- AC-3 Where sharing is unsupported or refused, the file downloads as before and `lastBackupAt` is recorded.
- AC-4 The finish screen shows the reminder only when the last backup is 7+ days old or missing; saving from it hides it.

Change surface:
- Expected: `src/features/settings/saveBackup.ts`, `src/features/settings/SettingsScreen.tsx`, `src/features/settings/BackupReminder.tsx`, `src/features/history/SessionDetailScreen.tsx`.
- Do not touch: backup schema, repositories, restore.

Canonical design:
- Affected authorities: AGENTS.MD "Offline is the normal case" is preserved — the app sends nothing; the lifter chooses the destination in the OS sheet. DESIGN.md buttons.
- Required synchronization: none.

Quality:
- Tests: `backupIsDue(lastBackupAt, now)` unit test (null, 6 days, 7 days).
- Static/build: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- QA: dev server — finish a session with no backup, see the reminder, save (download fallback in desktop Chromium), reminder disappears; Settings button same.

Done when: finishing a session with no recent backup offers Save backup, and saving records the backup date.

Stop if:
- Sharing a file requires a permission or a network call.
