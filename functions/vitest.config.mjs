import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['*.test.js', 'party/*.test.js', 'barcode/*.test.js'],
    // Most suites drive the Firestore emulator with many sequential calls,
    // and test files share it in parallel; 5s is too tight on CI runners.
    testTimeout: 30000,
  },
})
