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

// The AXE Insight card's data hook is covered by its own tests.
const mockUseAxeInsight = vi.fn()
vi.mock('../../features/axeInsights/useAxeInsight', () => ({
  useAxeInsight: (...args: unknown[]) => mockUseAxeInsight(...args),
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
  localStorage.clear() // the real WhatShouldIPourCard persists its pick per uid — see useHomeRecommendation
  mockExplainPourRecommendation.mockReset().mockResolvedValue(null)
  mockUseFriends.mockReturnValue({ friends: [], loading: false, reload: vi.fn() })
  mockUseNotifications.mockReturnValue({ notifications: [], loading: false, markRead: vi.fn() })
  mockUseSharedBlindActivity.mockReturnValue({ items: [], loading: false })
  mockUseAxeInsight.mockReturnValue({ view: null, explanation: null, loading: false, freshness: 'current' })
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

  it('shows the uncropped hero artwork above the greeting', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()
    expect(screen.getByAltText(/Fully Involved Pour/)).toBeInTheDocument()
  })

  it('shows the brand line in the hero as real text, before the greeting', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()
    const share = screen.getByText('Share More.')
    expect(screen.getByText('Discover More.')).toBeInTheDocument()
    expect(screen.getByText('Savor More.')).toBeInTheDocument()
    expect(screen.getByText('Discover new favorites, savor the experience, and capture the moments worth sharing.')).toBeInTheDocument()
    const greeting = screen.getByRole('heading', { level: 1 })
    expect(share.compareDocumentPosition(greeting) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("leads with Tonight's Pick as the primary card", () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()

    expect(screen.getByRole('heading', { name: 'Tonight’s Pick' })).toBeInTheDocument()
    const pick = within(screen.getByRole('region', { name: 'Tonight’s Pick' }))
    expect(pick.getByRole('link', { name: 'View Eagle Rare' })).toHaveAttribute('href', '/collection/b1')
    expect(pick.getByRole('button', { name: 'Another Pick' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask AXE why' })).toBeInTheDocument()
  })

  it('lays the dashboard out in the approved order', () => {
    const bottles: Bottle[] = [
      { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1, openedDate: '2026-06-01' },
      { id: 'b2', name: 'Weller 12', status: 'open', createdAt: 2, openedDate: '2026-05-01' },
      { id: 'b3', name: 'Blanton’s', status: 'sealed', createdAt: 3 },
      { id: 'b4', name: 'Stagg', status: 'sealed', createdAt: 4 },
    ]
    signIn(bottles, [
      { id: 'p1', bottleId: 'b1', date: '2026-07-01', rating: 8.6, fip: { nose: 2, palate: 3, finish: 1.6, complexity: 1, value: 1, total: 8.6, noseAromas: [], palateFlavors: [] } },
    ])
    renderHome()

    const order = ['Tonight’s Pick', 'Quick actions', 'Continue Your Journey', 'Open Bottles', 'Maybe Tonight', 'Your Bar Snapshot', 'AXE Insight']
    const nodes = [
      screen.getByRole('heading', { name: 'Tonight’s Pick' }),
      screen.getByRole('navigation', { name: 'Quick actions' }),
      screen.getByText('Continue Your Journey'),
      screen.getByText('Open Bottles'),
      screen.getByText('Maybe Tonight'),
      screen.getByText('Your Bar Snapshot'),
      screen.getAllByText('AXE Insight')[0]!,
    ]
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i - 1]!.compareDocumentPosition(nodes[i]!) & Node.DOCUMENT_POSITION_FOLLOWING, `${order[i - 1]} before ${order[i]}`).toBeTruthy()
    }
  })

  it('offers Pour, Ask AXE and My Bar as quick actions', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()
    const quick = within(screen.getByRole('navigation', { name: 'Quick actions' }))
    expect(quick.getByRole('button', { name: 'Pour' })).toBeInTheDocument()
    expect(quick.getByRole('button', { name: 'Ask AXE' })).toBeInTheDocument()
    expect(quick.getByRole('link', { name: 'My Bar' })).toHaveAttribute('href', '/collection')
  })

  it("shows Maybe Tonight alternatives without repeating Tonight's Pick", () => {
    signIn([
      { id: 'b1', name: 'Blanton’s', status: 'sealed', createdAt: 1 },
      { id: 'b2', name: 'Stagg', status: 'sealed', createdAt: 2 },
    ])
    renderHome()

    const picked = within(screen.getByRole('region', { name: 'Tonight’s Pick' })).getByRole('link', { name: /^View / }).getAttribute('href')
    const section = screen.getByText('Maybe Tonight').closest('section') as HTMLElement
    const alternatives = within(section).getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(alternatives).not.toContain(picked)
    expect(alternatives.length).toBeGreaterThan(0)
  })

  it('hides Maybe Tonight when the only pourable bottle is already Tonight’s Pick', () => {
    signIn([{ id: 'b1', name: 'Blanton’s', status: 'sealed', createdAt: 1 }])
    renderHome()
    expect(screen.queryByText('Maybe Tonight')).not.toBeInTheDocument()
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
    expect(screen.getByText('Last tasted Jul 1, 2026 · 1 pour')).toBeInTheDocument()
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

  it("no longer shows Friends' Recent Pours on Home (that activity lives on Friends)", () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()
    expect(screen.queryByText("Friends' Recent Pours")).not.toBeInTheDocument()
    expect(mockUseNotifications).not.toHaveBeenCalled()
  })

  it('replaces the long Your Palate section with one AXE Insight card', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()
    expect(screen.queryByText('Your Palate')).not.toBeInTheDocument()
    expect(screen.getAllByText('AXE Insight')).toHaveLength(1)
    expect(screen.getByText('Your journey starts with a pour.')).toBeInTheDocument()
    expect(mockUseAxeInsight).toHaveBeenCalledWith('u1', expect.any(Array), expect.any(Array))
  })

  it('shows the Collection Snapshot with real totals', () => {
    signIn([
      { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 },
      { id: 'b2', name: 'Weller 12', status: 'sealed', createdAt: 1 },
      { id: 'b3', name: 'Blanton\'s', status: 'wishlist', createdAt: 1 },
    ])
    renderHome()

    const heading = screen.getByText('Your Bar Snapshot')
    const section = heading.closest('section')
    expect(section).not.toBeNull()
    const scoped = within(section as HTMLElement)
    // The wishlist bottle isn't in the bar.
    expect(scoped.getByRole('link', { name: 'Your bar: 2 bottles, 1 open, 1 sealed, 0 low or empty' })).toHaveAttribute('href', '/collection')
    expect(scoped.getByText('In Your Bar')).toBeInTheDocument()
  })
})
