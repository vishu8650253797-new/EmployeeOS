import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Deterministic content hash so the precache entry only changes (and the
// service worker only re-fetches it) when offline.html's content actually
// changes — not on every unrelated build.
const offlineHtmlPath = fileURLToPath(new URL('./public/offline.html', import.meta.url));
const offlineHtmlRevision = createHash('md5').update(readFileSync(offlineHtmlPath)).digest('hex');

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // We control the update prompt ourselves (via virtual:pwa-register,
      // wired through the existing toast system) rather than silently
      // reloading an open tab out from under the user.
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'EmployeeOS — Employee & HR Management',
        short_name: 'EmployeeOS',
        description: 'EmployeeOS — Modern Employee & HR Management Platform',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f8f9fb', // matches --color-canvas
        theme_color: '#274de4', // matches --color-brand-600 / favicon.svg
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache only the built app shell's own static assets — no HTML
        // is precached (cleanupOutdatedCaches below keeps this from ever
        // going stale across deploys), and nothing here touches /api.
        globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
        // index.html is deliberately NOT precached (see note below) —
        // offline.html is added explicitly instead, with a content hash as
        // its revision so updates to it are picked up correctly.
        additionalManifestEntries: [{ url: '/offline.html', revision: offlineHtmlRevision }],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // vite-plugin-pwa defaults navigateFallback to 'index.html', which
        // registers a Workbox NavigationRoute that would unconditionally
        // intercept every in-app navigation — even while online — and
        // serve the precached shell instead of hitting the network. That's
        // unrelated to PWA installability and risks serving stale HTML
        // (and interfering with auth redirects), so it's explicitly
        // disabled here. Online navigation is left completely untouched;
        // the explicit NetworkOnly route below only supplies the offline
        // fallback page when a navigation request genuinely fails (i.e.
        // the device has no connection).
        navigateFallback: undefined,
        runtimeCaching: [
          {
            // This HR app's data is never cached for offline use — this
            // rule is a deliberate, explicit no-op (defense in depth) so
            // no other runtime-caching rule can ever accidentally match
            // an API response, rather than relying on absence of a rule.
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkOnly',
            options: {
              plugins: [
                {
                  handlerDidError: async () => caches.match('/offline.html'),
                },
              ],
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5100',
        changeOrigin: true,
      },
    },
  },
  // Used when the app is started with `vite preview` (e.g. on Render).
  // Vite blocks requests whose Host header isn't localhost or explicitly
  // allow-listed here, to prevent DNS-rebinding attacks — without this,
  // a public deployment gets a 403 "Blocked request" on every page.
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 4173,
    allowedHosts: ['employeeos-1.onrender.com'],
  },
});
