/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // We register the service worker ourselves via `virtual:pwa-register`
      // (see src/pwaUpdate.ts) so we control exactly when a waiting update
      // activates and reloads — never injected/auto-registered.
      injectRegister: null,
      manifest: {
        name: 'Fully Involved Pour',
        short_name: 'FI Pour',
        description:
          'Track every bottle, every pour, and the ones that earn a permanent spot on your Core Bar.',
        start_url: '.',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#080706',
        theme_color: '#080706',
        icons: [
          { src: 'logo-badge-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'logo-badge-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'logo-badge-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Runtime caching strategy (network-first pages, Firebase bypass, etc.)
      // is finalized in the deployment-polish phase, once the deploy pipeline
      // itself is decided — see plan §Deploy pipeline. Defaults are fine for now.
      workbox: {
        // Dev-mode mock-auth fixture chunks (see src/data/devMode.ts) are
        // never imported at runtime in a production build, but the default
        // precache glob would otherwise still have every visitor's service
        // worker fetch and cache them on install. Exclude them explicitly.
        globIgnores: ['**/mockAuth-*.js', '**/mockData-*.js'],
      },
    }),
  ],
})
