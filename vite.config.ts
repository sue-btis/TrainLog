import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

/**
 * Two dev modes, because the app is designed for a phone but developed on a
 * desktop.
 *
 * `pnpm dev` serves plain HTTP on localhost — which is itself a secure context,
 * so everything works, including `newId()`.
 *
 * `pnpm dev:phone` binds every interface and serves HTTPS, so the app can be
 * opened on a real phone over the local network. HTTPS is a requirement there,
 * not a preference: `newId()` is `crypto.randomUUID()`, and the Web Crypto API
 * exists only in a secure context. Over plain `http://<lan-ip>` every screen
 * would render and every write that generates an id — importing a routine,
 * starting a session — would throw.
 *
 * The certificate is self-signed, so a phone warns once before trusting it.
 * Accepting that warning still yields a secure context, which is the point.
 * Neither mode reaches the build: `basicSsl` configures the dev server only and
 * is a devDependency that never ships.
 */
export default defineConfig(({ mode }) => {
  const phone = mode === 'phone';

  return {
    plugins: [react(), tailwindcss(), ...(phone ? [basicSsl()] : [])],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      // Loopback only unless a phone needs to reach it.
      host: phone,
    },
  };
});
