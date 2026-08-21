import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { FriendCard } from './FriendCard'
import type { FriendProfile } from './useFriends'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()
const mockSendRecommendation = vi.fn()
const mockCreateNotification = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../../data/repositories/recommendations', () => ({
  sendRecommendation: (...args: unknown[]) => mockSendRecommendation(...args),
}))

vi.mock('../../data/repositories/notifications', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}))

const friend: FriendProfile = { uid: 'friend-1', username: 'kevin', displayName: 'Kevin Littlejohn' }

function renderCard() {
  return render(
    <MemoryRouter>
      <FriendCard friend={friend} />
    </MemoryRouter>,
  )
}

describe('FriendCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { uid: 'me' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: {
        username: 'me',
        bottles: [{ id: 'b1', name: 'Eagle Rare', status: 'open' }],
        pours: [],
        memories: [],
        infinityBottles: [],
        customLibrary: [],
      },
      profile: { displayName: 'Me' },
    })
    mockSendRecommendation.mockResolvedValue({ id: 'rec-1' })
  })

  it('links the card body to the friend’s profile', () => {
    renderCard()
    expect(screen.getByRole('link', { name: /Kevin Littlejohn/ })).toHaveAttribute('href', '/friends/u/kevin')
  })

  it('offers View Profile, Invite to Blind, and Recommend Bottle from the contextual menu', async () => {
    renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }))

    expect(screen.getByRole('menuitem', { name: 'View Profile' })).toHaveAttribute('href', '/friends/u/kevin')
    expect(screen.getByRole('menuitem', { name: 'Invite to Blind' })).toHaveAttribute('href', '/blind')
    expect(screen.getByRole('menuitem', { name: 'Recommend Bottle' })).toBeInTheDocument()
  })

  it('opens the bottle picker and sends a recommendation to this friend', async () => {
    renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Recommend Bottle' }))

    expect(screen.getByText('Recommend a Bottle to Kevin Littlejohn')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Eagle Rare' }))
    await userEvent.click(screen.getByRole('button', { name: 'Send Recommendation' }))

    expect(mockSendRecommendation).toHaveBeenCalledWith(expect.objectContaining({ recipientId: 'friend-1', bottleName: 'Eagle Rare' }))
    expect(screen.getByText('Recommendation Sent')).toBeInTheDocument()
  })
})
