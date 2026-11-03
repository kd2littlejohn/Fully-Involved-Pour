import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['*.test.js', 'party/*.test.js', 'barcode/*.test.js'],
    // Most suites drive the Firestore emulator with many sequential calls,
    // and test files share it in parallel; 5s is too tight on CI runners.
    testTimeout: 30000,
    // Every file shares ONE emulator. Run files one at a time: under
    // parallel load the emulator's pessimistic transaction locks time out
    // and transactions fail with "Transaction is invalid or closed" in
    // unrelated suites. Tests inside a file still run their own
    // concurrent calls (e.g. 10 simultaneous ballots).
    fileParallelism: false,
  },
})
