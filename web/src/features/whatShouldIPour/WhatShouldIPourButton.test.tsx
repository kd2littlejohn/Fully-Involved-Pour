import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WhatShouldIPourButton } from './WhatShouldIPourButton'
import type { Bottle, Pour } from '../../data/types'

const mockUseUserData = vi.fn()
const mockExplainPourRecommendation = vi.fn()

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../../data/repositories/pourRecommendationExplanation', () => ({
  explainPourRecommendation: (...args: unknown[]) => mockExplainPourRecommendation(...args),
}))

function minFip(rating: number) {
  return { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: rating, noseAromas: [], palateFlavors: [] }
}

const bold: Bottle = { id: 'bold', name: 'Bookers Bourbon', status: 'open', proof: 126.9, flavors: ['Black Pepper', 'Oak'] }
const mild: Bottle = { id: 'mild', name: 'Weller Special Reserve', status: 'open', proof: 90 }
const vault: Bottle = { id: 'vault', name: 'Eagle Rare 10', status: 'sealed', proof: 90 }
const wishlist: Bottle = { id: 'wishlist', name: 'Pappy 23', status: 'wishlist' }

const pours: Pour[] = [
  { id: 'p1', bottleId: 'bold', date: '2026-07-01', rating: 9.0, fip: minFip(9.0) },
  { id: 'p2', bottleId: 'mild', date: '2026-07-01', rating: 8.0, fip: minFip(8.0) },
]

function mockData(bottles: Bottle[], pourList: Pour[] = []) {
  mockUseUserData.mockReturnValue({
    userDoc: { bottles, pours: pourList, memories: [], infinityBottles: [], customLibrary: [] },
  })
}

beforeEach(() => {
  mockExplainPourRecommendation.mockReset()
  mockExplainPourRecommendation.mockResolvedValue(null)
})

describe('WhatShouldIPourButton', () => {
  it('shows an empty state when there are no open or sealed bottles', async () => {
    mockData([wishlist])
    render(<WhatShouldIPourButton />)

    await userEvent.click(screen.getByRole('button', { name: /^What Should I Pour\?/ }))

    expect(screen.getByText('Nothing to recommend yet.')).toBeInTheDocument()
  })

  it('shows all six mood options', async () => {
    mockData([bold, mild, vault])
    render(<WhatShouldIPourButton />)

    await userEvent.click(screen.getByRole('button', { name: /^What Should I Pour\?/ }))

    for (const label of ['Something Familiar', 'Something Special', "Haven't Had Lately", 'Sweet', 'High Proof', 'Surprise Me']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('recommends a bottle with an explanation after picking a mood', async () => {
    mockData([bold, mild, vault], pours)
    render(<WhatShouldIPourButton />)

    await userEvent.click(screen.getByRole('button', { name: /^What Should I Pour\?/ }))
    await userEvent.click(screen.getByRole('button', { name: 'High Proof' }))

    expect(screen.getByText('Bookers Bourbon')).toBeInTheDocument()
    expect(screen.getByText('Why this one?')).toBeInTheDocument()
  })

  it('marks a sealed recommendation clearly and never claims a prior pour', async () => {
    mockData([vault], [])
    render(<WhatShouldIPourButton />)

    await userEvent.click(screen.getByRole('button', { name: /^What Should I Pour\?/ }))
    await userEvent.click(screen.getByRole('button', { name: "Haven't Had Lately" }))

    expect(screen.getByText('Eagle Rare 10')).toBeInTheDocument()
    expect(screen.getByText('Sealed — opening a new bottle')).toBeInTheDocument()
    expect(screen.getByText('Still sealed — not yet poured')).toBeInTheDocument()
    expect(screen.getByText(/never opened this bottle/)).toBeInTheDocument()
  })

  it('Show Me Another moves to a different eligible bottle', async () => {
    mockData([bold, mild], pours)
    render(<WhatShouldIPourButton />)

    await userEvent.click(screen.getByRole('button', { name: /^What Should I Pour\?/ }))
    await userEvent.click(screen.getByRole('button', { name: 'High Proof' }))
    expect(screen.getByText('Bookers Bourbon')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Show Me Another' }))
    expect(screen.getByText('Weller Special Reserve')).toBeInTheDocument()
  })

  it('Choose a different mood returns to the mood picker', async () => {
    mockData([bold, mild], pours)
    render(<WhatShouldIPourButton />)

    await userEvent.click(screen.getByRole('button', { name: /^What Should I Pour\?/ }))
    await userEvent.click(screen.getByRole('button', { name: 'High Proof' }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose a different mood' }))

    expect(screen.getByText('What are you in the mood for?')).toBeInTheDocument()
  })

  it('Pour This opens the existing Pour Story flow with the bottle preselected', async () => {
    mockData([bold, mild], pours)
    render(<WhatShouldIPourButton />)

    await userEvent.click(screen.getByRole('button', { name: /^What Should I Pour\?/ }))
    await userEvent.click(screen.getByRole('button', { name: 'High Proof' }))
    await userEvent.click(screen.getByRole('button', { name: 'Pour This' }))

    expect(screen.getByText('Add a Pour Story — Bookers Bourbon')).toBeInTheDocument()
  })

  it('reveals instantly with the deterministic reasons, then swaps in the AI explanation once it resolves — never blocking the reveal', async () => {
    mockData([bold, mild, vault], pours)
    mockExplainPourRecommendation.mockResolvedValue('High Proof calls for Bookers Bourbon tonight — a bold, cask-strength pour.')
    render(<WhatShouldIPourButton />)

    await userEvent.click(screen.getByRole('button', { name: /^What Should I Pour\?/ }))
    await userEvent.click(screen.getByRole('button', { name: 'High Proof' }))

    // Reveals immediately with the real deterministic text — no spinner gate.
    expect(screen.getByText('Bookers Bourbon')).toBeInTheDocument()
    expect(screen.getByText(/proof/i)).toBeInTheDocument()

    expect(await screen.findByText('High Proof calls for Bookers Bourbon tonight — a bold, cask-strength pour.')).toBeInTheDocument()
  })

  it('keeps showing the deterministic reasons, unchanged, if the AI explanation call fails', async () => {
    mockData([bold, mild, vault], pours)
    mockExplainPourRecommendation.mockRejectedValue(new Error('network error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<WhatShouldIPourButton />)

    await userEvent.click(screen.getByRole('button', { name: /^What Should I Pour\?/ }))
    await userEvent.click(screen.getByRole('button', { name: 'High Proof' }))

    expect(screen.getByText('Why this one?')).toBeInTheDocument()
    expect(mockExplainPourRecommendation).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('resets the explanation when a new recommendation is revealed via Show Me Another', async () => {
    mockData([bold, mild], pours)
    mockExplainPourRecommendation.mockResolvedValueOnce('Bookers explanation.').mockResolvedValueOnce('Weller explanation.')
    render(<WhatShouldIPourButton />)

    await userEvent.click(screen.getByRole('button', { name: /^What Should I Pour\?/ }))
    await userEvent.click(screen.getByRole('button', { name: 'High Proof' }))
    expect(await screen.findByText('Bookers explanation.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Show Me Another' }))

    expect(screen.queryByText('Bookers explanation.')).not.toBeInTheDocument()
    expect(await screen.findByText('Weller explanation.')).toBeInTheDocument()
  })

  it('Surprise Me rolls a die animation before revealing a recommendation', async () => {
    mockData([bold, mild], pours)
    render(<WhatShouldIPourButton />)

    await userEvent.click(screen.getByRole('button', { name: /^What Should I Pour\?/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Surprise Me' }))

    // Mid-roll: the die is animating, no recommendation shown yet.
    expect(screen.getByText(/Rolling for tonight/)).toBeInTheDocument()
    expect(screen.queryByText('Why this one?')).not.toBeInTheDocument()

    expect(await screen.findByText('Why this one?', {}, { timeout: 2000 })).toBeInTheDocument()
  })
})
