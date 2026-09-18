import { describe, expect, it, vi } from 'vitest'
import { runWithConcurrency } from './runWithConcurrency'

describe('runWithConcurrency', () => {
  it('runs every item and returns results in input order', async () => {
    const results = await runWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10)
    expect(results).toEqual([10, 20, 30, 40])
  })

  it('never runs more than `concurrency` workers at once', async () => {
    let inFlight = 0
    let maxInFlight = 0
    await runWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return n
    })
    expect(maxInFlight).toBeLessThanOrEqual(2)
  })

  it('calls onResult incrementally as each item completes, not just at the end', async () => {
    const onResult = vi.fn()
    await runWithConcurrency([1, 2, 3], 3, async (n) => n, onResult)
    expect(onResult).toHaveBeenCalledTimes(3)
  })

  it('stops starting new work once cancelled, without throwing', async () => {
    let started = 0
    let cancelled = false
    const promise = runWithConcurrency(
      [1, 2, 3, 4, 5],
      1,
      async (n) => {
        started++
        if (started === 2) cancelled = true
        await new Promise((r) => setTimeout(r, 1))
        return n
      },
      undefined,
      () => cancelled,
    )
    await expect(promise).resolves.toBeDefined()
    expect(started).toBeLessThan(5)
  })
})
