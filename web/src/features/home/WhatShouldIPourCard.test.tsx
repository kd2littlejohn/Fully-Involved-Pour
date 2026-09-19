import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WhatShouldIPourCard } from './WhatShouldIPourCard'
import type { Bottle } from '../../data/types'

const mockUseUserData = vi.fn()
const mockExplainPourRecommendation = vi.fn()

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../../data/repositories/pourRecommendationExplanation', () => ({
  explainPourRecommendation: (...args: unknown[]) => mockExplainPourRecommendation(...args),
}))

const bottles: Bottle[] = [{ id: 'b1', name: 'Eagle Rare', status: 'open' }]

beforeEach(() => {
  mockExplainPourRecommendation.mockReset().mockResolvedValue(null)
  mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } })
})

function renderCard(bottleList: Bottle[] = bottles) {
  return render(
    <MemoryRouter>
      <WhatShouldIPourCard bottles={bottleList} pours={[]} />
    </MemoryRouter>,
  )
}

describe('WhatShouldIPourCard', () => {
  it('shows an honest empty state when there is nothing pourable', () => {
    renderCard([{ id: 'w1', name: 'Wishlist Bottle', status: 'wishlist' }])
    expect(screen.getByText('Add a sealed or opened bottle to your bar to get a recommendation.')).toBeInTheDocument()
  })

  it('recommends the only eligible bottle with a View Bottle link', () => {
    renderCard()
    expect(screen.getAllByText('Eagle Rare').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'View Bottle' })).toHaveAttribute('href', '/collection/b1')
  })

  it('still offers a way to choose by mood underneath the default pick', () => {
    renderCard()
    expect(screen.getByRole('button', { name: /^What Should I Pour\?/ })).toBeInTheDocument()
  })

  it('picks again without erroring when Show Me Another is pressed', async () => {
    renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Show Me Another' }))
    expect(screen.getAllByText('Eagle Rare').length).toBeGreaterThan(0)
  })
})
