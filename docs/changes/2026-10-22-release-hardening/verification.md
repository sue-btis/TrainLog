# Release hardening (lote B) — Verification

Verdict: Pass (self-verified, one writer). Acceptance by Josue: pending.
Base: `22a4114`; changes uncommitted in the working tree.

## Checks run
| Check | Result |
|---|---|
| `pnpm lint` | 0 errors; 1 pre-existing warning (`ImportWizard.tsx:114` exhaustive-deps) |
| `pnpm typecheck` | pass |
| `pnpm test` | 896 passed / 39 files (3 new in `safeRestore.test.ts`) |
| `pnpm build` | pass; precache 304 entries (was 303) |

## Acceptance
- AC-1 pass: `safeRestore.test.ts` — download receives the pre-restore rows before tables change; a throwing download leaves data untouched; empty DB downloads nothing.
- AC-2 pass (by inspecting `dist/sw.js`): `skipWaiting()` only runs inside the `SKIP_WAITING` message handler; no `clientsClaim`; `index.html` precache/navigate fallback present.
- AC-3 pass: entry chunk `index-*.js` **1,234.99 kB (gzip 371.58 kB) → 916.76 kB (gzip 276.66 kB)**; new `ProgressScreen-*.js` 319.86 kB (gzip 95.06 kB) holding recharts, listed in the SW precache.
- AC-4 pass.

## Deviations
- Added devDependency `workbox-window` (7.4.1): `virtual:pwa-register/react` imports it and the build failed without it (vite-plugin-pwa's documented peer for the prompt pattern).
- `UpdatePrompt` copy is "New version available." with a Reload button.

## Not verified
Nothing was run in a browser: the update notice appearing after a real redeploy, the Progress fallback and chunk fetch while offline, the actual file download during restore. The restore safety file's save location is up to the browser.
