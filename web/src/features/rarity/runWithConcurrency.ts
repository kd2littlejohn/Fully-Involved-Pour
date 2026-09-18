// A small promise pool — no concurrency-limiting helper exists anywhere
// else in this codebase (checked before adding this). Runs `worker` over
// `items` with at most `concurrency` in flight at once, calling
// `onResult` as each one resolves (so a caller can persist/flush
// incrementally rather than waiting for the whole batch) and respecting
// `isCancelled()` between items so an unmounted page stops starting new
// work (already-started work still finishes and still reports its result).
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
  onResult?: (item: T, result: R) => void,
  isCancelled?: () => boolean,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function runOne(): Promise<void> {
    while (nextIndex < items.length) {
      if (isCancelled?.()) return
      const index = nextIndex
      nextIndex += 1
      const item = items[index]!
      const result = await worker(item)
      results[index] = result
      onResult?.(item, result)
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => runOne())
  await Promise.all(workers)
  return results
}

export const RARITY_REVIEW_CONCURRENCY = 4
