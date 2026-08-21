import type { VitePWAOptions } from 'vite-plugin-pwa';

/**
 * Service worker and Web App Manifest configuration (PRD §33).
 *
 * Plain data on purpose. This file is imported by `vite.config.ts`, so it is
 * type-checked under `tsconfig.node.json` as well as `tsconfig.json`; calling a
 * Node API or a DOM API here would fail one of the two.
 *
 * Colours are the board token from `src/styles/theme.css`, not a value chosen
 * here — the manifest paints the splash screen and the address bar, and those
 * are the same surface the app renders on.
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  /**
   * A new deployment takes over without asking. Safe here specifically because
   * every set is on disk the moment it is logged (NFR-03) and a session resumes
   * from IndexedDB (§35), so a reload mid-session costs nothing.
   */
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],

  manifest: {
    name: 'TrainLog',
    short_name: 'TrainLog',
    description: 'Run a declared training programme, offline.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#f0f5f5',
    background_color: '#f0f5f5',
    icons: [
      { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      {
        src: 'maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },

  workbox: {
    /**
     * `woff2` is the entry that matters and the one Workbox's default pattern
     * omits. The four self-hosted Inter and Martian Mono faces are referenced by
     * `@font-face` in `src/styles/theme.css`; without them precached, the first
     * offline launch renders in a fallback face. There is nowhere to fetch them
     * from at runtime — the app makes no network requests (NFR-01).
     */
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

    /**
     * Routing is `BrowserRouter` with deep paths. Offline, a cold load of
     * `/routines/<id>` has no server to rewrite it, so the service worker serves
     * the cached shell and React Router resolves the path.
     */
    navigateFallback: 'index.html',

    /**
     * DEC-2: the waiting worker activates immediately and claims open clients,
     * which is what makes `autoUpdate` actually update.
     */
    skipWaiting: true,
    clientsClaim: true,

    /** No remote origin exists to cache. Anything not precached is a bug. */
    navigationPreload: false,
  },
};
