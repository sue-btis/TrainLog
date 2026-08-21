# PWA — manifest, service worker, offline precache — Spec

Status: Ready for implementation
Size: medium
Reliability: strict
Base: `change/gym-mode` at `4d6ed5d`, clean working tree

## Goal

The app installs on a phone and runs entirely offline from the first launch.

Done when: `pnpm build && pnpm preview` serves an app that Chrome offers to
install; after one visit, with the network cut, every route
(`/today`, `/calendar`, `/routines`, `/routines/:id`, `/exercises/:id`,
`/import`, `/session`) loads, renders with its real typography, and a full
session can be logged — with zero network requests at runtime.

## Evidence and Current Behavior

Verified by inspection at `4d6ed5d`:

- **Nothing PWA exists.** `src/pwa/` — the directory AGENTS.MD declares in the
  architecture tree — is absent. `public/` is empty. `index.html` has no
  `<link rel="manifest">`, no `theme-color`, no `apple-touch-icon`.
  `vite.config.ts` loads only `react()`, `tailwindcss()` and, in `phone` mode,
  `basicSsl()`.
- **`vite-plugin-pwa` is not installed**, despite being committed by the stack
  (PRODUCT.md § Stack, AGENTS.MD § Architecture, `docs/PRD.md` § PWA).
  `npm view vite-plugin-pwa` → `1.3.0`, peer
  `vite: ^3 || ^4 || ^5 || ^6 || ^7 || ^8`. The repo is on `vite@8.2.1`.
  **Compatible — verified, not assumed.** Its own peers name
  `@vite-pwa/assets-generator@^1.0.0` as the icon toolchain.
- **Fonts are self-hosted woff2**, four files in `src/assets/fonts/`, referenced
  by `@font-face` `url()` in `src/styles/theme.css:14,25,37,49`. Vite emits them
  as hashed assets. Workbox's default `globPatterns`
  (`js,css,html,ico,png,svg`) **excludes `woff2`** — the default configuration
  would ship an app that renders offline in a fallback face.
- **Routing is `BrowserRouter`** (`src/App.tsx:26`) with deep paths
  (`/routines/:routineId`, `/exercises/:exerciseId`). Offline navigation to a
  deep path only resolves if the service worker falls back to `index.html`.
- **Theme tokens** (`src/styles/theme.css:61`): `--color-board: #f0f5f5` is the
  page background (`--color-background: var(--color-board)`, line 112);
  `--color-card: #FEFEFD`. DESIGN.md fixes five semantic hues.
- **Two dev modes** (`vite.config.ts`): `dev` (HTTP localhost) and `dev:phone`
  (HTTPS via `basicSsl`, all interfaces). Both are dev-server only.
- **Exercise catalog ships in the JS bundle** (`src/domain/catalog/index.ts`,
  PRD §11.12) — it is not a separately fetched asset and needs no precache rule
  of its own.
- The working tree is clean; the gym-mode work is committed. **No overlap.**

## Scope

Included:

- `vite-plugin-pwa` as a devDependency, configured for `generateSW`.
- A Web App Manifest with every field PRD §33 requires.
- Precache covering the app shell, JS, CSS, **woff2 fonts** and icons.
- SPA navigation fallback so deep routes resolve offline.
- Placeholder icon set (192, 512, maskable 512, apple-touch-icon) generated from
  a single SVG built out of DESIGN.md tokens.
- iOS install metadata in `index.html`.

Excluded:

- Push notifications (PRD line 797 — out of MVP).
- Any runtime network request, background sync, cloud, account.
- Runtime caching strategies for remote origins — there are no remote origins.
- Update-prompt UI (superseded by DEC-2).
- Any change to feature, db or domain code.
- Brand identity. The icon is a placeholder; "TrainLog" remains a working name
  (PRODUCT.md § Brand Commitments).

## Decisions and Assumptions

- **DEC-1 — Icons are a declared placeholder.** A single `public/icon.svg`, drawn
  only from DESIGN.md tokens, rasterised to the required sizes. It establishes no
  brand and must be labelled as a placeholder in the repo. *(User-approved.)*
- **DEC-2 — `registerType: 'autoUpdate'`.** No prompt UI. A service-worker
  takeover may reload the tab mid-session; the risk is bounded because every set
  persists as it is logged (NFR-03) and a session resumes from IndexedDB (§35).
  *(User-approved.)*
- **DEC-3 — PWA config lives in `src/pwa/`**, imported by `vite.config.ts`, so
  the directory AGENTS.MD declares actually exists. The file must be plain data
  (no Node and no DOM API calls) because it is type-checked under both
  `tsconfig.json` (`lib: DOM`, `types: vite/client`) and `tsconfig.node.json`
  (`lib: ES2023`, `types: node`).
- **DEC-4 — `@vite-pwa/assets-generator` as a devDependency**, run on demand via
  a `package.json` script, with the generated PNGs committed. Rationale: PNG
  rasterisation is not something a few lines of application code can do, the tool
  is `vite-plugin-pwa`'s own named peer, and it never reaches the build output.
- **Assumption A-1** — the service worker stays disabled in dev
  (`devOptions.enabled` left at its default `false`), so neither `pnpm dev` nor
  `pnpm dev:phone` changes behavior. *Stop if* enabling it turns out to be
  required for any acceptance check; offline verification runs against
  `pnpm preview`, not the dev server.

## Requirements and Acceptance

| ID | Required Behavior | Acceptance |
|---|---|---|
| R-1 | The build emits a manifest carrying `name`, `short_name`, `icons`, `start_url`, `display`, `theme_color`, `background_color` (PRD §33). `theme_color` and `background_color` are `#f0f5f5`, the board token — not an arbitrary value (PRD §7: tokens are the source). | AC-1: `dist/manifest.webmanifest` exists and contains all seven keys; both colours read `#f0f5f5`. |
| R-2 | The app is installable. `index.html` links the manifest and carries `theme-color` plus an `apple-touch-icon` so iOS install works. | AC-2: under `pnpm preview` on localhost, Chrome offers install; the icon renders on the home screen on a real phone. |
| R-3 | The precache manifest includes every asset the shell needs offline: `index.html`, the JS and CSS bundles, **all four woff2 fonts**, and the icons. | AC-3: the generated precache manifest lists ≥4 `.woff2` entries and `index.html`. A default `globPatterns` fails this. |
| R-4 | Deep routes resolve offline. A cold navigation to `/routines/<id>` with no network serves the cached shell and React Router takes over. | AC-4: with the network offline in DevTools, reloading `/exercises/<id>` renders the screen, not a browser error page. |
| R-5 | Runtime makes no network requests (NFR-01, PRD §9). | AC-5: after the first load, DevTools Network shows no request leaving the service worker to the network during a full session flow. |
| R-6 | A new deployment is picked up without user action (DEC-2). | AC-6: the build runs under `registerType: 'autoUpdate'` with registration injected automatically; `dist/sw.js` carries `skipWaiting`/`clientsClaim` semantics. |
| R-7 | Dev workflows are unchanged. | AC-7: `pnpm dev` and `pnpm dev:phone` still start and serve; no service worker is registered in dev. |
| R-8 | `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` all pass. | AC-8: all four commands exit 0. |

## Contracts and Risk Controls

**Changed:**

- Build output gains `dist/manifest.webmanifest`, `dist/sw.js`,
  `dist/workbox-*.js` and the icon files.
- `index.html` gains manifest / theme-color / apple-touch-icon head tags.
- `package.json` gains two devDependencies and one script.

**Preserved:**

- `features → db → domain` layering. `src/pwa/` imports from none of them and
  none of them import it.
- No runtime dependency is added. Both new packages are devDependencies and
  neither appears in the client bundle.
- No change to IndexedDB schema, repositories, domain functions or any screen.
- Offline-first invariant: the service worker only ever serves precached
  same-origin assets. No fetch handler reaches the network for app data.

**Risk control (the one that matters):** `globPatterns` is the single point where
this change fails silently — it builds, deploys and passes every screen check
while being broken in the gym. AC-3 exists specifically to catch that, and must
be run as a command, not read.

## Quality Obligations

- **Tests:** none in `vitest`. This change contains no domain logic; AGENTS.MD
  puts correctness tests in `domain/` and verifies UI by running it. A vitest
  case shelling out to a build would be slower and less honest than AC-3.
- **Build assertion (required, scripted):**

  ```bash
  pnpm build && grep -c "woff2" dist/sw.js && grep -c "index.html" dist/sw.js
  ```

  First count must be ≥ 4, second ≥ 1. If Workbox emits the precache manifest to
  a separate file, assert against that file instead.
- **Static/build:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- **QA (required, on a real phone over HTTPS):** install the app, enable airplane
  mode, run one full session — Today → start → log sets → rest timer → finish —
  and reload a deep route mid-flight.
- **Coverage/mutation:** not applicable; no new logic under test.

## Change Surface

Expected edits:

- `package.json` — `vite-plugin-pwa`, `@vite-pwa/assets-generator`, `pwa:assets` script
- `pnpm-lock.yaml`
- `vite.config.ts` — register `VitePWA(pwaOptions)`
- `src/pwa/config.ts` — **new**, the plugin options
- `index.html` — head tags
- `public/icon.svg` — **new**, placeholder source
- `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon-180x180.png`, `public/favicon.ico` — **new**, generated
- `pwa-assets.config.ts` — **new**, if the generator requires it
- `AGENTS.MD` / `CONTEXT.md` — only if a term is settled during the work
- `docs/changes/2026-08-20-pwa/` — execution and verification records

Do not touch:

- `src/domain/**`, `src/db/**`, `src/features/**`, `src/components/**`
- `src/styles/theme.css` — the icon reads token values, it does not add any
- Dev-server behavior in `vite.config.ts` (`server`, `basicSsl`, mode handling)

## Planning Decision

Plan required: **No.**

Reason: one write set, one owner, no sequencing beyond install → configure →
generate icons → verify. No migration, no rollout, no integration gate between
parts. A plan would only restate the change surface.

## Stop Conditions

Stop and report rather than invent, if:

- `vite-plugin-pwa@1.3.0` fails against `vite@8.2.1` in practice despite the
  declared peer range;
- the precache manifest cannot be made to include the woff2 fonts without a
  runtime caching rule — that would be a network request at runtime and
  contradicts NFR-01;
- installing the icon generator requires a runtime dependency or fails to produce
  PNGs on this machine — report and ask, do not hand-roll a rasteriser;
- making the app installable appears to require touching feature, db or domain
  code;
- a decision beyond DEC-1..DEC-4 becomes necessary.
