import type { VitePWAOptions } from 'vite-plugin-pwa';

export const pwaOptions: Partial<VitePWAOptions> = {
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
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

    navigateFallback: 'index.html',

    skipWaiting: true,
    clientsClaim: true,

    navigationPreload: false,
  },
};
