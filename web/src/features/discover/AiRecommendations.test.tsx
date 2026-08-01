import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiRecommendations } from './AiRecommendations'

const mockRecommend = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../../data/repositories/ai', () => ({
  recommendBottles: (...args: unknown[]) => mockRecommend(...args),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles: [{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }] } }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderPanel() {
  return render(
    <MemoryRouter>
      <AiRecommendations />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockRecommend.mockReset()
  mockNavigate.mockReset()
})

describe('AiRecommendations', () => {
  it('fetches and lists recommendations when the button is clicked', async () => {
    mockRecommend.mockResolvedValue([
      { name: 'Elijah Craig Barrel Proof', distillery: 'Heaven Hill', type: 'Bourbon', reason: 'High-proof and oak-forward, like your top picks.' },
    ])
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: /Get AI Recommendations/ }))

    expect(mockRecommend).toHaveBeenCalledWith(expect.stringContaining('Eagle Rare'))
    expect(await screen.findByText('Elijah Craig Barrel Proof')).toBeInTheDocument()
    expect(screen.getByText('Heaven Hill')).toBeInTheDocument()
    expect(screen.getByText('High-proof and oak-forward, like your top picks.')).toBeInTheDocument()
  })

  it('navigates to a prefilled Add Bottle form when adding a recommendation to the wishlist', async () => {
    mockRecommend.mockResolvedValue([
      { name: 'Redbreast 12', distillery: 'Midleton', type: 'Irish', reason: 'A rich sherry-cask pour worth trying.' },
    ])
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: /Get AI Recommendations/ }))
    await userEvent.click(await screen.findByRole('button', { name: '+ Add to Wishlist' }))

    expect(mockNavigate).toHaveBeenCalledWith('/bottles/new', {
      state: {
        defaultStatus: 'wishlist',
        prefill: { name: 'Redbreast 12', distillery: 'Midleton', type: 'Irish' },
      },
    })
  })

  it('shows a message when there are no recommendations yet', async () => {
    mockRecommend.mockResolvedValue([])
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: /Get AI Recommendations/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/don't have enough of a taste profile/)
  })

  it('shows an error message when the request fails', async () => {
    mockRecommend.mockRejectedValue(new Error('The AI sommelier is unavailable right now.'))
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: /Get AI Recommendations/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The AI sommelier is unavailable right now.')
  })
})
