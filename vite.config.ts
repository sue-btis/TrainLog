import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from './src/pwa/config.ts';

export default defineConfig(({ mode }) => {
  // Phone mode uses HTTPS for browser APIs that require a secure context.
  const phone = mode === 'phone';

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA(pwaOptions),
      ...(phone ? [basicSsl()] : []),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      host: phone,
    },
    preview: {
      port: 4173,
      host: phone,
    },
  };
});
