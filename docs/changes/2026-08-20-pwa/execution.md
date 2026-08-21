# PWA Execution

## Baseline

| Field | Value |
|---|---|
| Repository | `C:/Users/Josue Escobar/Documents/projects/mine/TrainLog` |
| Branch | `pwa-addition` |
| Planned base | `4d6ed5d` |
| Current start commit | `4d6ed5d` |
| Working tree before edits | Clean except untracked `docs/changes/2026-08-20-pwa/` (this change's own spec) |
| Pre-existing relevant changes | None |

## Preflight Verdict

**Safe.**

The spec named `change/gym-mode` as the branch; the checkout is on `pwa-addition`
at the identical commit `4d6ed5d`. Same tree, different label — recorded as a
deviation, not a blocker. No file in the change surface had uncommitted edits.

## Execution Topology

Quick direct — single sequential write set, no subagents, no worktrees.

## Executed Work

| Task | REQ IDs | Status | Files Changed | Checks | Evidence |
|---|---|---|---|---|---|
| Install toolchain | R-8 | Completed | `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | `pnpm install` | `vite-plugin-pwa 1.3.0`, `@vite-pwa/assets-generator 1.0.2`, both devDependencies |
| Placeholder icon + rasterisation | R-1, R-2 | Completed | `public/icon.svg`, `pwa-assets.config.ts`, 6 generated files in `public/` | `pnpm pwa:assets` | `pwa-64x64`, `pwa-192x192`, `pwa-512x512`, `maskable-icon-512x512`, `apple-touch-icon-180x180`, `favicon.ico` |
| Manifest + service worker config | R-1, R-3, R-4, R-6 | Completed | `src/pwa/config.ts`, `vite.config.ts` | `pnpm build` | `dist/manifest.webmanifest`, `dist/sw.js`, 23 precache entries |
| Head metadata | R-2 | Completed | `index.html` | `pnpm build` | manifest link + registerSW injected by the plugin; theme-color, icons, apple-touch-icon authored |
| Offline verification harness | R-4, R-5 | Completed | `.claude/launch.json` | `pnpm preview` on 4183 | see Requirement Status |

## Integration Gates

| Gate | Owner | Diff Inspected? | Checks | Result |
|---|---|---:|---|---|
| Final | this session | Yes | `pnpm typecheck && pnpm lint && pnpm test && pnpm build` | All exit 0. 20 test files, 257 tests passed. |

## Requirement Status

| Requirement | Implementation | Acceptance Evidence | Status |
|---|---|---|---|
| R-1 manifest fields | `src/pwa/config.ts` `manifest` | AC-1: `dist/manifest.webmanifest` carries `name`, `short_name`, `icons`, `start_url`, `display`, `theme_color`, `background_color`; both colours `#f0f5f5`. | Completed |
| R-2 installable | `index.html` head + generated icons | AC-2: manifest + registerSW injected into `dist/index.html`; SW registered and active at `http://localhost:4183/`, `navigator.serviceWorker.controller` truthy. **Install prompt and home-screen icon on a physical phone not yet exercised.** | Completed — one acceptance clause unverified |
| R-3 precache covers shell + fonts | `workbox.globPatterns` extended with `woff2` | AC-3: `grep -o '\.woff2' dist/sw.js \| wc -l` → **4**; `grep -c 'index.html' dist/sw.js` → **1**. Live cache contents confirm all four faces plus CSS, JS, manifest and icons. | Completed |
| R-4 deep routes offline | `workbox.navigateFallback: 'index.html'` | AC-4: **with the preview server stopped**, `/routines` and `/exercises/front-squat` both rendered their real screens. `createHandlerBoundToURL("index.html")` present in `dist/sw.js`. | Completed |
| R-5 no runtime network | No runtime caching rule; nothing to fetch | AC-5: with the server down, every request in the network log returned 200 from the service worker. The single `ERR_CONNECTION_REFUSED` was a deliberate `fetch(..., {cache:'no-store'})` probe issued by the verifier, not app code. | Completed |
| R-6 autoUpdate | `registerType: 'autoUpdate'`, `skipWaiting`, `clientsClaim` | AC-6: both `skipWaiting` and `clientsClaim` present in `dist/sw.js`; `dist/registerSW.js` emitted. | Completed |
| R-7 dev unchanged | `devOptions` left at default (disabled) | AC-7: `pnpm dev --port 5399` starts and serves. `pnpm dev:phone` untouched — `basicSsl` and `host`/`port` handling unmodified. **`dev:phone` not booted in this session.** | Completed — one acceptance clause unverified |
| R-8 checks pass | — | AC-8: `pnpm typecheck`, `pnpm lint`, `pnpm test` (257 passed), `pnpm build` all exit 0. | Completed |

## Deviations

Five, all additive and none touching behavior the spec froze.

1. **Branch label.** Executed on `pwa-addition`, not `change/gym-mode`. Identical
   commit.
2. **`pnpm-workspace.yaml` added** — outside the declared change surface.
   Required: pnpm 11 blocks `sharp`'s install script by default, which made
   `pnpm pwa:assets` fail outright. The file sets `allowBuilds: { sharp: true }`.
   Note: pnpm itself created this file during `pnpm add`, carrying a placeholder
   `allowBuilds: sharp: "set this to true or false"`. It was overwritten before
   being read. It was untracked and absent from `HEAD`, and the surviving content
   shows it held only pnpm's own placeholder — nothing authored was lost, but the
   overwrite was careless and is recorded rather than glossed.
3. **`tsconfig.node.json` modified** — outside the declared change surface.
   `pwa-assets.config.ts` added to `include` so the new root config file is
   type-checked at all, and `allowImportingTsExtensions: true` added so
   `vite.config.ts` can import `./src/pwa/config.ts` with its extension. Without
   the extension Vite 8 warns that the import is unsupported by the
   `configLoader: 'native'` it plans to default to.
4. **`.claude/launch.json` modified** — a `trainlog-preview` entry so offline
   behavior can be verified against a real build. Tooling only; not shipped.
5. **`pwa-64x64.png` also generated**, beyond the sizes the spec enumerated. It
   is part of the `minimal2023` preset and is referenced by the manifest.

## Ownership / Contract Conflicts

None. No file under `src/domain/`, `src/db/`, `src/features/` or
`src/components/` was touched, and `src/styles/theme.css` is unmodified — the
icon and the manifest read token *values*, they do not declare new ones.

No runtime dependency was added. Both new packages are devDependencies and
neither appears in `dist/assets/index-*.js`.

## Blockers

None.

## Independent Verification Readiness

**Ready**, with two acceptance clauses that can only close on hardware:

- R-2: install prompt accepted and home-screen icon inspected on a physical
  phone.
- R-7: `pnpm dev:phone` booted and reached from a phone over HTTPS.

Both are covered by the spec's QA obligation, which also requires one full
airplane-mode session end to end.
