# Storage warning on Today

Status: Ready for implementation
Size: quick
Reliability: lean
Implementation effort: medium
Triggered artifacts: none

Goal: Today warns when this browser may clear the training data — the app runs in a browser tab, or it is installed but persistent storage was not granted — instead of saying so only in Settings.

Evidence facts:
- Entry point: `src/features/today/TodayScreen.tsx:78` (Today's render); durability read in `src/pwa/persistence.ts:21` and shown today only by `Durability` in `src/features/settings/SettingsScreen.tsx`.
- Covering tests: none (UI is verified by running it); `readStorageDurability` and `isInstalled` are unchanged.
- Consumers of altered contracts: no contract altered.

Scope:
- Include: a `planned`-tone alert at the top of Today with a link to Settings. Not installed → "Add TrainLog to your home screen". Installed and `best-effort` → "This browser may clear your training". Installed and `persisted` or `unsupported` → nothing.
- Exclude: dismissing the warning (it stops once the condition is fixed), changing when persistence is requested.

Acceptance:
- AC-1 Browser tab: the home-screen warning shows.
- AC-2 Installed, not persisted: the clear-risk warning shows.
- AC-3 Installed and persisted: no warning.

Quality: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; dev-server walkthrough of the three states.

Done when: Today shows the right warning, or none, for each of the three states.

Stop if: the warning needs a stored "dismissed" flag.
