import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PalateMatchBadge } from './PalateMatchBadge'
import type { Bottle } from '../../data/types'
import type { PalateMatchResult } from './scoring'

const mockUseUserData = vi.fn()
const mockComputePalateMatch = vi.fn()
const mockExplainPalateMatch = vi.fn()

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('./scoring', () => ({
  computePalateMatch: (...args: unknown[]) => mockComputePalateMatch(...args),
}))

vi.mock('../../data/repositories/palateMatchExplanation', () => ({
  explainPalateMatch: (...args: unknown[]) => mockExplainPalateMatch(...args),
}))

const bottle: Bottle = { id: 'b1', name: 'New Bourbon', status: 'wishlist', type: 'Bourbon', proof: 92 }

function match(overrides: Partial<PalateMatchResult> = {}): PalateMatchResult {
  return { score: 92, confidence: 'high', status: 'scored', reasons: ['Its flavor profile lines up with your highest-rated pours.'], ...overrides }
}

beforeEach(() => {
  mockUseUserData.mockReturnValue({ userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } })
  mockComputePalateMatch.mockReset()
  mockExplainPalateMatch.mockReset()
})

describe('PalateMatchBadge', () => {
  it('shows "Still Learning Your Palate" verbatim when there is not enough evidence to score', () => {
    mockComputePalateMatch.mockReturnValue(match({ score: null, status: 'still-learning', confidence: 'low', reasons: [] }))
    render(<PalateMatchBadge bottle={bottle} />)

    expect(screen.getByText('Still Learning Your Palate')).toBeInTheDocument()
    expect(screen.queryByText(/% Match/)).not.toBeInTheDocument()
  })

  it('shows the score and confidence once scored', () => {
    mockComputePalateMatch.mockReturnValue(match({ score: 92, confidence: 'high' }))
    render(<PalateMatchBadge bottle={bottle} />)

    expect(screen.getByText(/92% Match/)).toBeInTheDocument()
    expect(screen.getByText(/High Confidence/)).toBeInTheDocument()
  })

  it('never shows a fabricated percentage alongside "Still Learning"', () => {
    mockComputePalateMatch.mockReturnValue(match({ score: null, status: 'still-learning', confidence: 'low', reasons: [] }))
    render(<PalateMatchBadge bottle={bottle} />)

    expect(screen.queryByText(/null%/)).not.toBeInTheDocument()
  })

  it('fetches and shows the explanation on demand when "Why It Fits" is tapped, only once', async () => {
    mockComputePalateMatch.mockReturnValue(match())
    mockExplainPalateMatch.mockResolvedValue('A strong, well-grounded fit for your palate.')
    render(<PalateMatchBadge bottle={bottle} />)

    expect(mockExplainPalateMatch).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /Why It Fits/ }))

    expect(mockExplainPalateMatch).toHaveBeenCalledWith({
      bottleName: 'New Bourbon',
      score: 92,
      confidence: 'high',
      reasons: ['Its flavor profile lines up with your highest-rated pours.'],
    })
    expect(await screen.findByText('A strong, well-grounded fit for your palate.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Why It Fits/ })).not.toBeInTheDocument()
  })

  it('does not show a "Why It Fits" action when there are no reasons to explain', () => {
    mockComputePalateMatch.mockReturnValue(match({ reasons: [] }))
    render(<PalateMatchBadge bottle={bottle} />)

    expect(screen.queryByRole('button', { name: /Why It Fits/ })).not.toBeInTheDocument()
  })

  it('degrades gracefully and silently if the explanation call fails', async () => {
    mockComputePalateMatch.mockReturnValue(match())
    mockExplainPalateMatch.mockRejectedValue(new Error('network error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<PalateMatchBadge bottle={bottle} />)

    await userEvent.click(screen.getByRole('button', { name: /Why It Fits/ }))

    expect(await screen.findByRole('button', { name: /Why It Fits/ })).toBeInTheDocument()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
