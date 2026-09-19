import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { HomePage } from './HomePage'
import type { Bottle, Pour } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()
const mockUseLastBlindSummary = vi.fn()
const mockExplainPourRecommendation = vi.fn()
const mockUseFriends = vi.fn()
const mockUseNotifications = vi.fn()
const mockUseSharedBlindActivity = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../../features/home/useLastBlindSummary', () => ({
  useLastBlindSummary: () => mockUseLastBlindSummary(),
}))

vi.mock('../../data/repositories/pourRecommendationExplanation', () => ({
  explainPourRecommendation: (...args: unknown[]) => mockExplainPourRecommendation(...args),
}))

vi.mock('../../features/friends/useFriends', () => ({
  useFriends: (...args: unknown[]) => mockUseFriends(...args),
}))

vi.mock('../../features/friends/useNotifications', () => ({
  useNotifications: (...args: unknown[]) => mockUseNotifications(...args),
}))

vi.mock('../../features/friends/useSharedBlindActivity', () => ({
  useSharedBlindActivity: (...args: unknown[]) => mockUseSharedBlindActivity(...args),
}))

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

function signIn(bottles: Bottle[], pours: Pour[] = []) {
  mockUseAuth.mockReturnValue({ user: { uid: 'u1', displayName: 'Kevin' }, loading: false })
  mockUseUserData.mockReturnValue({
    userDoc: { bottles, pours, memories: [], infinityBottles: [], customLibrary: [], people: [] },
    loading: false,
    signedIn: true,
  })
  mockUseLastBlindSummary.mockReturnValue({ summary: undefined, loading: false })
}

beforeEach(() => {
  mockExplainPourRecommendation.mockReset().mockResolvedValue(null)
  mockUseFriends.mockReturnValue({ friends: [], loading: false, reload: vi.fn() })
  mockUseNotifications.mockReturnValue({ notifications: [], loading: false, markRead: vi.fn() })
  mockUseSharedBlindActivity.mockReturnValue({ items: [], loading: false })
})

describe('HomePage', () => {
  it('shows a sign-in prompt when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: false,
    })
    mockUseLastBlindSummary.mockReturnValue({ summary: undefined, loading: false })

    renderHome()

    expect(screen.getByText('Your whiskey journey starts here.')).toBeInTheDocument()
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  })

  it('shows the add-a-bottle empty state when signed in with no bottles', () => {
    signIn([])
    renderHome()
    expect(screen.getByText('Add a bottle to begin building your bar.')).toBeInTheDocument()
  })

  it('shows the full uncropped hero artwork above the greeting', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()
    expect(screen.getByAltText(/Fully Involved Pour/)).toBeInTheDocument()
  })

  it('leads with the What Should I Pour? recommendation as the primary card', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()

    // Appears both as the primary card's own eyebrow and as the embedded
    // "choose by mood" trigger's title — both are legitimate, so this just
    // confirms the primary card rendered at all.
    expect(screen.getAllByText('What Should I Pour?').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Eagle Rare').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'View Bottle' })).toHaveAttribute('href', '/collection/b1')
    expect(screen.getByRole('button', { name: 'Show Me Another' })).toBeInTheDocument()
  })

  it('shows a Maybe Tonight section for a sealed, owned bottle', () => {
    signIn([{ id: 'b1', name: "Blanton's", status: 'sealed', createdAt: 1 }])
    renderHome()

    expect(screen.getByText('Maybe Tonight')).toBeInTheDocument()
    expect(screen.getAllByText("Blanton's").length).toBeGreaterThan(0)
  })

  it('shows an Open Bottles carousel with a View All link into the filtered My Bar view', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1, fillLevel: 'half' }])
    renderHome()

    const heading = screen.getByText('Open Bottles')
    const section = heading.closest('section')
    expect(section).not.toBeNull()
    expect(within(section as HTMLElement).getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/collection?filter=open')
  })

  it('does not show an Open Bottles section when nothing is open', () => {
    signIn([{ id: 'b1', name: 'Sealed Bottle', status: 'sealed', createdAt: 1 }])
    renderHome()
    expect(screen.queryByText('Open Bottles')).not.toBeInTheDocument()
  })

  it('shows a real pour count on the Continue Your Journey card', () => {
    const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1, openedDate: '2026-06-01' }
    const pour: Pour = {
      id: 'p1',
      bottleId: 'b1',
      date: '2026-07-01',
      rating: 8.6,
      memory: 'Great catch-up.',
      fip: { nose: 2, palate: 3, finish: 1.6, complexity: 1, value: 1, total: 8.6, noseAromas: [], palateFlavors: [] },
    }
    signIn([bottle], [pour])
    renderHome()

    expect(screen.getByText('Continue Your Journey')).toBeInTheDocument()
    expect(screen.getByText('1 pour')).toBeInTheDocument()
    expect(screen.getAllByText('Great catch-up.').length).toBeGreaterThan(0)
  })

  it('hides the Continue Your Journey section when there is no featured bottle or blind result', () => {
    signIn([{ id: 'b1', name: 'Sealed Bottle', status: 'sealed', createdAt: 1 }])
    renderHome()
    expect(screen.queryByText('Continue Your Journey')).not.toBeInTheDocument()
  })

  it('shows the Last Blind Result inside Continue Your Journey once resolved', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    mockUseLastBlindSummary.mockReturnValue({
      summary: {
        room: {
          id: 'room-1',
          code: 'ABC123',
          name: 'Double Oak Showdown',
          hostUid: 'u1',
          hostUsername: 'Kevin',
          sessionType: 'live',
          knowledgeMode: 'single',
          pourCount: 2,
          state: 'revealed',
          createdAt: 1,
          revealedAt: 100,
          participantCount: 2,
        },
        winningBottleName: 'Pursuit Double Oaked Rye',
        score: 9.3,
      },
      loading: false,
    })

    renderHome()

    expect(screen.getByText('Continue Your Journey')).toBeInTheDocument()
    expect(screen.getByText('You picked the winner!')).toBeInTheDocument()
    expect(screen.getByText('Pursuit Double Oaked Rye')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Details' })).toHaveAttribute('href', '/blind/room-1/reveal')
  })

  it("shows an empty state for Friends' Recent Pours when the user has no friends", () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()

    expect(screen.getByText("Friends' Recent Pours")).toBeInTheDocument()
    expect(screen.getByText('Whiskey is better shared.')).toBeInTheDocument()
  })

  it("shows friend activity rows in Friends' Recent Pours when there is activity", () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    mockUseFriends.mockReturnValue({ friends: [{ uid: 'f1', displayName: 'Dave', username: 'dave' }], loading: false, reload: vi.fn() })
    mockUseNotifications.mockReturnValue({
      notifications: [
        {
          id: 'n1',
          recipientId: 'u1',
          actorId: 'f1',
          actorDisplayName: 'Dave',
          actorUsername: 'dave',
          type: 'tagged-in-pour',
          refId: 'moment-1',
          read: false,
          createdAt: Date.now(),
          refBottleName: 'Weller 12',
        },
      ],
      loading: false,
      markRead: vi.fn(),
    })

    renderHome()

    expect(screen.getAllByText(/Dave/).length).toBeGreaterThan(0)
  })

  it('shows a Palate Insight empty-state card when there is not enough tasting data', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()

    expect(screen.getByText('Your Palate')).toBeInTheDocument()
    expect(screen.getByText('Keep logging pours and your palate trends will appear here.')).toBeInTheDocument()
  })

  it('shows the Collection Snapshot with real totals', () => {
    signIn([
      { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 },
      { id: 'b2', name: 'Weller 12', status: 'sealed', createdAt: 1 },
      { id: 'b3', name: 'Blanton\'s', status: 'wishlist', createdAt: 1 },
    ])
    renderHome()

    const heading = screen.getByText('Collection Snapshot')
    const section = heading.closest('section')
    expect(section).not.toBeNull()
    const scoped = within(section as HTMLElement)
    expect(scoped.getByText('3')).toBeInTheDocument() // total
    expect(scoped.getAllByText('1')).toHaveLength(2) // open, sealed
  })
})
