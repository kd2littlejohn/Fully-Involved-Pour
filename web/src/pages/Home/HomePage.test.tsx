import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'
import type { Bottle, Pour } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()
const mockUseLastBlindSummary = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../../features/home/useLastBlindSummary', () => ({
  useLastBlindSummary: () => mockUseLastBlindSummary(),
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
    userDoc: { bottles, pours, memories: [], infinityBottles: [], customLibrary: [] },
    loading: false,
    signedIn: true,
  })
  mockUseLastBlindSummary.mockReturnValue({ summary: undefined, loading: false })
}

describe('HomePage', () => {
  it('shows a sign-in prompt when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] },
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

  it('leads with a Start a Pour primary action and "What are you pouring tonight?" subtext', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()

    expect(screen.getByText('What are you pouring tonight?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start a Pour' })).toBeInTheDocument()
  })

  it('offers the two secondary actions as icon+title+subtitle cards', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()

    expect(screen.getByRole('button', { name: /^What Should I Pour\?/ })).toBeInTheDocument()
    expect(screen.getByText('Get a recommendation')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Add a Bottle/ })).toHaveAttribute('href', '/bottles/new')
    expect(screen.getByText('Grow your collection')).toBeInTheDocument()
  })

  it('does not offer a standalone Roll the Dice action anymore', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()
    expect(screen.queryByRole('button', { name: /Roll the Dice/ })).not.toBeInTheDocument()
  })

  it('shows a Maybe Tonight section for a sealed, owned bottle', () => {
    signIn([{ id: 'b1', name: "Blanton's", status: 'sealed', createdAt: 1 }])
    renderHome()

    expect(screen.getByText('Maybe Tonight')).toBeInTheDocument()
    expect(screen.getAllByText("Blanton's").length).toBeGreaterThan(0)
  })

  it('shows a real pour count and Pour Again action on the Continue Your Pour Story card', () => {
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

    expect(screen.getByText('Continue Your Pour Story')).toBeInTheDocument()
    expect(screen.getByText('1 pour')).toBeInTheDocument()
    expect(screen.getAllByText('Great catch-up.').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Pour Again' })).toBeInTheDocument()
  })

  it('shows the honest not-enough-data copy for Your Palate Lately instead of fabricating a trend', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()
    expect(screen.getByText('Keep logging pours and your palate trends will appear here.')).toBeInTheDocument()
  })

  it('hides the Last Blind card when the user has no finished blinds', () => {
    signIn([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }])
    renderHome()
    expect(screen.queryByText('Last Blind')).not.toBeInTheDocument()
  })

  it('shows the Last Blind card with the winning bottle and a View Results link once resolved', () => {
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

    expect(screen.getByText('Double Oak Showdown')).toBeInTheDocument()
    expect(screen.getByText(/Pursuit Double Oaked Rye/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Results' })).toHaveAttribute('href', '/blind/room-1/reveal')
  })
})
