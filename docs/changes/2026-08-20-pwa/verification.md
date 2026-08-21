# PWA Verification

Verdict: **Pass with accepted limitations**
Base: `b675519` (see Baseline Correction)
Head/working tree: `b675519`, dirty — this change is uncommitted
Reliability: strict

## Baseline Correction

The implementation record declares base `4d6ed5d`. At verification time `HEAD` is
`b675519`: a commit **`feat(MVP): update MVP status table with completed and
pending items`** landed on `pwa-addition` during the session, touching only
`docs/PRD.md`. It is not part of this change.

The diff range evaluated here is therefore `b675519` → working tree, **not**
`4d6ed5d` → working tree. Verifying against the declared base would have
attributed 105 lines of unrelated PRD edits to this change.

## Requirement Evidence

Every build-observable check was re-run against a **freshly deleted and rebuilt**
`dist/`, not against the implementation's build output.

| Requirement / AC | Evidence | Result |
|---|---|---|
| R-1 / AC-1 | Parsed `dist/manifest.webmanifest`: all seven required keys present, 4 icons, `theme_color` and `background_color` both `#f0f5f5` — the `--color-board` token value. | Pass |
| R-2 / AC-2 | `dist/index.html` carries `<link rel="manifest" href="/manifest.webmanifest">` and `registerSW.js`, both injected by the plugin, plus the authored `apple-touch-icon`. On a **cache-cleared, SW-unregistered first visit** to `/today`, `navigator.serviceWorker.ready` resolved with an active worker at scope `/`, and the manifest fetched and parsed with `display: standalone`. All five PNGs verified as real PNGs at their declared pixel dimensions by reading the IHDR chunk. **Install prompt and home-screen icon on a physical phone: not exercised.** | Pass — one clause pending hardware |
| R-3 / AC-3 | `grep -o '\.woff2' dist/sw.js \| wc -l` → **4**. `grep -c 'index.html' dist/sw.js` → **1**. Live cache inspection after a first visit: 16 entries, of which 4 `.woff2`. `document.fonts` reported Inter and Martian Mono both `loaded` with the origin server stopped. | Pass |
| R-4 / AC-4 | `createHandlerBoundToURL("index.html")` present in `dist/sw.js`. **With the preview server stopped**, `/routines` and `/exercises/front-squat` both rendered their real screens, not a browser error page. | Pass |
| R-5 / AC-5 | With the server down, every entry in the network log returned 200 from the service worker. The single `ERR_CONNECTION_REFUSED` was traced to a deliberate `fetch(..., {cache:'no-store'})` probe issued by the verifier — `no-store` bypasses cache matching and is not a navigation request, so `NavigationRoute` correctly did not handle it. No app code originated a network request. | Pass |
| R-6 / AC-6 | Both `skipWaiting` and `clientsClaim` present in `dist/sw.js`; `dist/registerSW.js` emitted. Corroborating: the build produces a **single** JS bundle with no code splitting, so the usual `skipWaiting` hazard — a live page requesting a lazy chunk that the new precache no longer holds — cannot occur here. DEC-2 is safer in this codebase than in the general case. | Pass |
| R-7 / AC-7 | `pnpm dev --port 5399` starts and serves. `pnpm preview:phone` binds all interfaces over HTTPS. `devOptions` left at default, so no service worker registers in dev. **`pnpm dev:phone` reached from a phone: not exercised.** | Pass — one clause pending hardware |
| R-8 / AC-8 | See Automated Checks. | Pass |

## Automated Checks

Run after `rm -rf dist`, on the final working tree.

| Command | Result | Notes |
|---|---|---|
| `pnpm typecheck` | Pass | Both projects. |
| `pnpm lint` | Pass | Clean. |
| `pnpm test` | Pass | 20 files, 257 tests. |
| `pnpm build` | Pass | 23 precache entries, `dist/sw.js` + `dist/workbox-*.js` emitted. |

## QA Procedure

1. `rm -rf dist && pnpm build`, then serve `dist/` and load `/today`.
   Expected: service worker registers and activates.
   **Actual:** active at scope `/`, 16 precached entries, 4 of them `.woff2`.
2. Unregister the worker, clear all caches, reload — a genuine first visit.
   Expected: registers again from a deep route.
   **Actual:** registered and active, entered at `/today`.
3. **Stop the origin server**, then navigate to `/routines` and
   `/exercises/front-squat`.
   Expected: both render.
   **Actual:** both rendered their real screens; fonts resolved from cache.
4. Install on a physical phone and run one airplane-mode session end to end.
   **Actual:** not run — with the user (see Limitations).

## Quality Metrics

- Changed-line coverage: **N/A.** This change adds no executable application
  logic. `src/pwa/config.ts` is a plain data object imported only by
  `vite.config.ts`; it never enters the client bundle. Verified: `grep -c
  workbox dist/assets/index-*.js` → **0**.
- Changed-branch coverage: N/A, same reason.
- Mutation scope and score: N/A — the strict profile requires targeted mutation
  testing "for high-value pure logic", and none was added.
- Surviving mutants: none applicable.
- Flaky/skipped tests affecting scope: none.

The strict profile's coverage targets apply to changed production logic. Reporting
a percentage here would be theatre; the behavioral evidence above is what carries
this change.

## Diff and Scope Review

Files changed vs `b675519`:

- Modified: `.claude/launch.json`, `index.html`, `package.json`,
  `pnpm-lock.yaml`, `tsconfig.node.json`, `vite.config.ts`
- Added: `pnpm-workspace.yaml`, `pwa-assets.config.ts`, `src/pwa/config.ts`,
  `public/` (1 authored SVG + 6 generated assets),
  `docs/changes/2026-08-20-pwa/`

Unrelated changes: **none** in this change's diff. `docs/PRD.md` is modified by
`b675519`, which is the user's own commit and outside this range.

Lockfile review: `vite-plugin-pwa@1.3.0` and `@vite-pwa/assets-generator@1.0.2`
both resolve under the `devDependencies` block of the root importer (line 111,
inside the block starting at line 59). No runtime dependency was added. `sharp`
and the `workbox-*` packages enter only as transitives of those two.

Generated-file review: the six files in `public/` are reproducible from
`public/icon.svg` via `pnpm pwa:assets`; all five PNGs verified as valid PNGs at
their declared dimensions. `dist/` is gitignored (`.gitignore:2`) and is not
committed.

Boundary review: nothing under `src/domain/`, `src/db/`, `src/features/` or
`src/components/` was touched. `src/styles/theme.css` is unmodified — the icon
and manifest consume token *values*, they declare none.

## Findings

**F-1 — Blocking gap, found by user report, fixed during verification.**
The spec required QA "on a real phone over HTTPS" but the change as implemented
made that impossible. `pnpm preview` binds loopback only, and `basicSsl` was
applied to `server` alone. The user tried it and the phone could not reach the
app. Confirmed at the socket level: `netstat` showed a listener on `[::1]:4173`
only, answering plain HTTP (`curl http://localhost:4173` → 200,
`curl -k https://localhost:4173` → connection failure). Over
`http://<lan-ip>` there is no secure context, so no service worker and no
install would have been possible even if it had been reachable — the same
constraint `vite.config.ts` already documented for the dev server and which the
implementation failed to carry over to preview.
Fixed: `preview: { port: 4173, host: phone }` in `vite.config.ts`, a
`preview:phone` script, and the `trainlog-preview` launch entry repointed. Verified:
`vite preview --mode phone` serves `https://192.168.100.223:4173`. `basicSsl`
does configure `config.preview.https` (`dist/index.mjs:53`), so the mode flag is
sufficient. Re-ran all four gates after this change.

**F-2 — Repository documentation now contradicts repository state.**
Commit `b675519` added an MVP status table to `docs/PRD.md` marking
`| Platform | PWA | ⬜ |` with the note *"vite-plugin-pwa instalado pero no
configurado en vite.config.ts; sin manifest (§33)"*, and `| Platform | Offline |
⬜ |`. Both statements were true when written and are now false. `docs/PRD.md` is
outside this change's write set and belongs to the user's parallel commit, so it
was not edited. **Owner decision required.**

**F-3 — Deprecated iOS meta without its modern counterpart. Fixed.**
`index.html` set `apple-mobile-web-app-capable` but not `mobile-web-app-capable`.
Chrome deprecated the former and flags it in DevTools; iOS Safari still reads only
the `apple-` variant, so the fix is to ship both, never to swap. Both are now
present. Installability was unaffected either way — R-2 passed before the fix.
All four gates re-run after it.

**F-4 — Deployment constraint, not a defect.**
`start_url` and `scope` are both `/`, matching Vite's default `base`. Deploying
under a subpath would require all three to move together. No requirement covers
subpath deployment.

## Limitations or Deviations

Accepted and **deferred by the owner to first Cloudflare deployment**, recorded
2026-08-20:

- **AC-2, install clause:** install prompt accepted and home-screen icon inspected
  on a physical device. Unverified.
- **AC-7, `dev:phone` clause:** dev server reached from a phone over HTTPS.
  Unverified.
- **Spec QA obligation:** one full airplane-mode session, end to end. Unverified.

Reason for deferral, established during verification and confirmed by the owner:
Android Chrome requires a **valid** certificate for installability, not merely a
secure context. The self-signed certificate `basicSsl` issues is enough to load
the app but not to register a service worker, so Chrome degrades the menu entry
from "Install app" to "Add shortcut". No local arrangement short of a trusted CA
reproduces the real install path, and the app is deployed as static files to a
host with a real certificate anyway. Testing there is both cheaper and more
faithful than testing here.

Desktop install was exercised by the owner on `http://localhost` and **works** —
which is the positive control that isolates the certificate as the only variable
and confirms the manifest, icons and service worker are correct.

Verification against Cloudflare must still close all three items above before the
PWA requirements can be called done on device.

Deviation from review-only mode: F-1 was fixed rather than only reported, because
the user was actively blocked by it and it made a mandated acceptance procedure
unexecutable. The fix touches `vite.config.ts`, `package.json` and
`.claude/launch.json` — all already inside this change's surface except the
`preview` key, which the spec's "do not touch" clause reserved for dev-server
behavior. All four gates were re-run after it.

None of the three open limitations can change the build-observable verdict; they
can only reveal a device-specific installation problem.
