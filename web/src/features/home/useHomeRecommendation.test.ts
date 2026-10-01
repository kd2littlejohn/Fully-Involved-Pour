import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useHomeRecommendation } from './useHomeRecommendation'
import type { Bottle } from '../../data/types'

const mockExplainPourRecommendation = vi.fn()

vi.mock('../../data/repositories/pourRecommendationExplanation', () => ({
  explainPourRecommendation: (...args: unknown[]) => mockExplainPourRecommendation(...args),
}))

const eagleRare: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open' }
const wellerTwelve: Bottle = { id: 'b2', name: 'Weller 12', status: 'sealed' }

beforeEach(() => {
  localStorage.clear()
  mockExplainPourRecommendation.mockReset().mockResolvedValue(null)
})

describe('useHomeRecommendation', () => {
  it('is not loaded until a uid is known', () => {
    const { result } = renderHook(() => useHomeRecommendation(undefined, [eagleRare], []))
    expect(result.current.loaded).toBe(false)
    expect(result.current.result).toBeUndefined()
  })

  it('picks the only eligible bottle once a uid is known', async () => {
    const { result } = renderHook(() => useHomeRecommendation('u1', [eagleRare], []))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.result?.bottle.id).toBe('b1')
  })

  it('reports an honest empty pick when nothing is eligible, without throwing', async () => {
    const wishlist: Bottle = { id: 'w1', name: 'Wishlist Bottle', status: 'wishlist' }
    const { result } = renderHook(() => useHomeRecommendation('u1', [wishlist], []))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.result).toBeNull()
  })

  it('persists the pick across a full unmount + remount — the actual reported bug', async () => {
    const { result, unmount } = renderHook(() => useHomeRecommendation('u1', [eagleRare, wellerTwelve], []))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    const firstPick = result.current.result?.bottle.id
    unmount()

    // Simulates navigating away and back: a brand-new hook instance, same
    // uid/bottles, as if HomePage had remounted from scratch.
    const { result: second } = renderHook(() => useHomeRecommendation('u1', [eagleRare, wellerTwelve], []))
    await waitFor(() => expect(second.current.loaded).toBe(true))
    expect(second.current.result?.bottle.id).toBe(firstPick)
  })

  it('preserves the fetched explanation across unmount + remount (no re-fetch)', async () => {
    mockExplainPourRecommendation.mockResolvedValue('A real, cached explanation.')
    const { result, unmount } = renderHook(() => useHomeRecommendation('u1', [eagleRare], []))
    await waitFor(() => expect(result.current.explanation).toBe('A real, cached explanation.'))
    expect(mockExplainPourRecommendation).toHaveBeenCalledTimes(1)
    unmount()

    const { result: second } = renderHook(() => useHomeRecommendation('u1', [eagleRare], []))
    await waitFor(() => expect(second.current.loaded).toBe(true))
    expect(second.current.explanation).toBe('A real, cached explanation.')
    // Still exactly once — remounting must not re-request it.
    expect(mockExplainPourRecommendation).toHaveBeenCalledTimes(1)
  })

  it('does not change the pick on an unrelated bottles/pours update while mounted', async () => {
    const { result, rerender } = renderHook(({ bottles }) => useHomeRecommendation('u1', bottles, []), {
      initialProps: { bottles: [eagleRare, wellerTwelve] },
    })
    await waitFor(() => expect(result.current.loaded).toBe(true))
    const firstPick = result.current.result?.bottle.id

    // A background update that adds a third bottle — unrelated to whichever
    // bottle is currently shown, so it must not replace the pick.
    const thirdBottle: Bottle = { id: 'b3', name: 'Blanton\'s', status: 'open' }
    rerender({ bottles: [eagleRare, wellerTwelve, thirdBottle] })

    expect(result.current.result?.bottle.id).toBe(firstPick)
  })

  it('regenerates automatically once the previously-picked bottle becomes unavailable', async () => {
    const { result, rerender } = renderHook(({ bottles }) => useHomeRecommendation('u1', bottles, []), {
      initialProps: { bottles: [eagleRare] },
    })
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.result?.bottle.id).toBe('b1')

    // The picked bottle is finished (no longer open/sealed) — simulates the
    // user finishing it, or it being removed, while Home stays mounted.
    const finished: Bottle = { ...eagleRare, status: 'finished' }
    rerender({ bottles: [finished, wellerTwelve] })

    await waitFor(() => expect(result.current.result?.bottle.id).toBe('b2'))
  })

  it('does not regenerate across a remount when the pick is still available, even with other bottles added', async () => {
    const { result, unmount } = renderHook(() => useHomeRecommendation('u1', [eagleRare], []))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    unmount()

    const thirdBottle: Bottle = { id: 'b3', name: 'Blanton\'s', status: 'open' }
    const { result: second } = renderHook(() => useHomeRecommendation('u1', [eagleRare, thirdBottle], []))
    await waitFor(() => expect(second.current.loaded).toBe(true))
    expect(second.current.result?.bottle.id).toBe('b1')
  })

  it('showAnother picks a different eligible bottle on request', async () => {
    const { result } = renderHook(() => useHomeRecommendation('u1', [eagleRare, wellerTwelve], []))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    const firstPick = result.current.result?.bottle.id

    result.current.showAnother()

    await waitFor(() => expect(result.current.result?.bottle.id).not.toBe(firstPick))
  })

  it('keeps picks independent per signed-in user', async () => {
    const { result: userA } = renderHook(() => useHomeRecommendation('user-a', [eagleRare], []))
    await waitFor(() => expect(userA.current.loaded).toBe(true))

    const onlyWeller: Bottle = { id: 'b2', name: 'Weller 12', status: 'sealed' }
    const { result: userB } = renderHook(() => useHomeRecommendation('user-b', [onlyWeller], []))
    await waitFor(() => expect(userB.current.loaded).toBe(true))

    expect(userA.current.result?.bottle.id).toBe('b1')
    expect(userB.current.result?.bottle.id).toBe('b2')
  })

  it('an older in-flight explanation request never overwrites a newer pick', async () => {
    let resolveFirst: (text: string) => void = () => {}
    const firstPromise = new Promise<string>((resolve) => {
      resolveFirst = resolve
    })
    mockExplainPourRecommendation.mockReturnValueOnce(firstPromise).mockResolvedValueOnce('Explanation for the new pick.')

    const { result } = renderHook(() => useHomeRecommendation('u1', [eagleRare, wellerTwelve], []))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(mockExplainPourRecommendation).toHaveBeenCalledTimes(1)

    // Request another pick before the first explanation has resolved.
    result.current.showAnother()
    await waitFor(() => expect(mockExplainPourRecommendation).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.explanation).toBe('Explanation for the new pick.'))

    // The stale first request finally resolves — it must not clobber the
    // explanation that belongs to the current (second) pick.
    resolveFirst('Stale explanation for the old pick.')
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.explanation).toBe('Explanation for the new pick.')
  })
})
