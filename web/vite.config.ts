/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Opt-in HTTPS for the dev server, so a phone on the same Wi-Fi can open
// it with camera access (the Scan Barcode PoC, docs/BARCODE_POC.md).
// Point both variables at a local certificate; unset, nothing changes.
const devHttps =
  process.env.FIP_DEV_HTTPS_CERT && process.env.FIP_DEV_HTTPS_KEY
    ? { cert: readFileSync(process.env.FIP_DEV_HTTPS_CERT), key: readFileSync(process.env.FIP_DEV_HTTPS_KEY) }
    : undefined

export default defineConfig({
  server: devHttps ? { https: devHttps, host: true } : undefined,
  // Scan Barcode Phase 0 preview builds only (.github/workflows/
  // barcode-preview.yml sets FIP_BARCODE_POC=true): compiles the dev-only
  // Barcode PoC page into a build for a temporary preview channel. A plain
  // `npm run build` defines it as the literal false, so the page is dropped
  // from every production build exactly as before.
  define: {
    __FIP_BARCODE_POC__: JSON.stringify(process.env.FIP_BARCODE_POC === 'true'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    // *.rules.test.ts files run against the Firestore emulator via a
    // separate config (vitest.rules.config.ts, `npm run test:rules` at the
    // repo root) — excluded here so a plain `vitest run` never tries to hit
    // an emulator that isn't running.
    exclude: [...configDefaults.exclude, '**/*.rules.test.ts'],
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
        background_color: '#11161C',
        theme_color: '#11161C',
        icons: [
          // FIP monogram app icons, rendered from src/assets/brand/*.svg.
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
