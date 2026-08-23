import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePalateInterpretation } from './usePalateInterpretation'
import type { PalateProfile } from './palateProfile'

const mockGetPalateInterpretation = vi.fn()
const mockHashPalateProfile = vi.fn()

vi.mock('../../data/repositories/palateInterpretation', () => ({
  getPalateInterpretation: (...args: unknown[]) => mockGetPalateInterpretation(...args),
  hashPalateProfile: (...args: unknown[]) => mockHashPalateProfile(...args),
}))

function profile(overrides: Partial<PalateProfile> = {}): PalateProfile {
  return {
    qualifyingPourCount: 5,
    maturity: 'taking-shape',
    categoryScores: [],
    proofAffinity: undefined,
    topRatedFlavors: [],
    loyalty: undefined,
    finishPreference: undefined,
    mouthfeelPreference: undefined,
    ...overrides,
  }
}

beforeEach(() => {
  mockGetPalateInterpretation.mockReset()
  mockHashPalateProfile.mockReset()
  mockHashPalateProfile.mockReturnValue('hash-1')
})

describe('usePalateInterpretation', () => {
  it('starts loading, then resolves to ready with the interpretation', async () => {
    mockGetPalateInterpretation.mockResolvedValue('You gravitate toward Bourbon.')
    const { result } = renderHook(() => usePalateInterpretation('u1', profile()))

    expect(result.current.state).toBe('loading')

    await waitFor(() => expect(result.current.state).toBe('ready'))
    expect(result.current.interpretation).toBe('You gravitate toward Bourbon.')
  })

  it('resolves to none immediately, without calling the repository, when there is no signed-in user', () => {
    const { result } = renderHook(() => usePalateInterpretation(undefined, profile()))

    expect(result.current.state).toBe('none')
    expect(mockGetPalateInterpretation).not.toHaveBeenCalled()
  })

  it('resolves to none when the repository returns undefined (below the maturity floor, or AI declined)', async () => {
    mockGetPalateInterpretation.mockResolvedValue(undefined)
    const { result } = renderHook(() => usePalateInterpretation('u1', profile()))

    await waitFor(() => expect(result.current.state).toBe('none'))
    expect(result.current.interpretation).toBeUndefined()
  })

  it('resolves to none if the lookup itself throws', async () => {
    mockGetPalateInterpretation.mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => usePalateInterpretation('u1', profile()))

    await waitFor(() => expect(result.current.state).toBe('none'))
  })

  it('re-fetches when the profile hash changes but not for an unrelated re-render', async () => {
    mockGetPalateInterpretation.mockResolvedValue('Interpretation.')
    const { rerender } = renderHook(({ p }) => usePalateInterpretation('u1', p), { initialProps: { p: profile() } })
    await waitFor(() => expect(mockGetPalateInterpretation).toHaveBeenCalledTimes(1))

    // Same hash — a new profile object identity, but nothing meaningful changed.
    rerender({ p: profile() })
    expect(mockGetPalateInterpretation).toHaveBeenCalledTimes(1)

    mockHashPalateProfile.mockReturnValue('hash-2')
    rerender({ p: profile({ maturity: 'developing' }) })
    await waitFor(() => expect(mockGetPalateInterpretation).toHaveBeenCalledTimes(2))
  })
})
