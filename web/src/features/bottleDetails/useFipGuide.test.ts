import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFipGuide } from './useFipGuide'
import type { Bottle } from '../../data/types'
import type { FipGuide } from '../../data/repositories/fipGuide'

const mockGetFipGuide = vi.fn()

vi.mock('../../data/repositories/fipGuide', () => ({
  getFipGuide: (...args: unknown[]) => mockGetFipGuide(...args),
}))

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace Distillery', status: 'open' }

function guide(overrides: Partial<FipGuide> = {}): FipGuide {
  return {
    bottleKey: 'eagle-rare-10-year__buffalo-trace-distillery',
    whySpecial: 'A classic.',
    bestFor: 'Everyday sipping.',
    value: 'Fair.',
    buyIf: 'You want reliability.',
    skipIf: 'You want something rare.',
    verdict: 'Worth it.',
    story: '',
    availability: '',
    flavorProfile: [],
    intensity: null,
    generatedAt: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  mockGetFipGuide.mockReset()
})

describe('useFipGuide', () => {
  it('starts loading, then resolves to ready with the guide', async () => {
    const theGuide = guide()
    mockGetFipGuide.mockResolvedValue(theGuide)
    const { result } = renderHook(() => useFipGuide(bottle))

    expect(result.current.state).toBe('loading')

    await waitFor(() => expect(result.current.state).toBe('ready'))
    expect(result.current.guide).toEqual(theGuide)
  })

  it('resolves to none when the bottle is not confidently recognized', async () => {
    mockGetFipGuide.mockResolvedValue(undefined)
    const { result } = renderHook(() => useFipGuide(bottle))

    await waitFor(() => expect(result.current.state).toBe('none'))
    expect(result.current.guide).toBeUndefined()
  })

  it('resolves to none if the lookup itself throws', async () => {
    mockGetFipGuide.mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useFipGuide(bottle))

    await waitFor(() => expect(result.current.state).toBe('none'))
  })

  it('re-fetches when the bottle identity changes but not for an unrelated field edit', async () => {
    mockGetFipGuide.mockResolvedValue(guide())
    const { rerender } = renderHook(({ b }) => useFipGuide(b), { initialProps: { b: bottle } })
    await waitFor(() => expect(mockGetFipGuide).toHaveBeenCalledTimes(1))

    rerender({ b: { ...bottle, price: 999 } })
    expect(mockGetFipGuide).toHaveBeenCalledTimes(1)

    rerender({ b: { ...bottle, name: 'Eagle Rare 17 Year' } })
    await waitFor(() => expect(mockGetFipGuide).toHaveBeenCalledTimes(2))
  })
})
