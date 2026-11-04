import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// The deploy uploads files without git history, so the build date identifies the build.
const built = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  // Shown in Settings, and used to tell an iPhone app that is older than this site needs.
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version} · ${built} UTC`),
    __NATIVE_BUILD__: JSON.stringify(pkg.ios.build),
    __NATIVE_VERSION__: JSON.stringify(pkg.ios.version),
  },
  // The natural voice runs in a module worker (transformers.js needs import.meta).
  worker: { format: 'es' },
  plugins: [
    react(),
    VitePWA({
      // The iPhone app serves files from the bundle; a service worker has nothing to do there.
      disable: process.env.CAP === '1',
      registerType: 'autoUpdate',
      includeAssets: ['icons/*', 'songs/*', 'fonts/*'],
      manifest: {
        name: "Leonor",
        short_name: "Leonor",
        description: 'Learn the songs you love from short videos, one pattern at a time, then play them.',
        lang: 'en',
        start_url: '/',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#f8f7f3',
        theme_color: '#f8f7f3',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,mid,woff2}'],
        // The natural voice's worker (transformers.js) is large: fetched when the voice is first used, not precached.
        globIgnores: ['**/kokoroWorker-*.js'],
        runtimeCaching: [
          {
            // Piano samples: large and immutable, keep them offline once heard.
            urlPattern: ({ url }) => url.hostname === 'smpldsnds.github.io' || url.hostname === 'danigb.github.io',
            handler: 'CacheFirst',
            options: { cacheName: 'piano-samples', expiration: { maxEntries: 400 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'images.unsplash.com',
            handler: 'CacheFirst',
            options: { cacheName: 'covers', expiration: { maxEntries: 60 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  server: { host: true },
});
