import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts's main test block on purpose: these tests
// run against the Firestore emulator (via @firebase/rules-unit-testing),
// need a Node environment (not jsdom), and only make sense when invoked
// through `npm run test:rules` at the repo root, which wraps this in
// `firebase emulators:exec`. Never picked up by the default `vitest run`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.rules.test.ts'],
    testTimeout: 20000,
    hookTimeout: 60000,
  },
})
