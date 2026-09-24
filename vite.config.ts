import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*', 'songs/*'],
      manifest: {
        name: "Hugo's Piano",
        short_name: "Hugo's Piano",
        description: 'Learn your songs with falling notes or the score, at your own pace.',
        lang: 'en',
        start_url: '/',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#0f0d0b',
        theme_color: '#0f0d0b',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,mid}'],
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
