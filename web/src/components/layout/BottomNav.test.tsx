import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BottomNav } from './BottomNav'
import type { Bottle } from '../../data/types'

const mockUseUserData = vi.fn()
const mockUseAuth = vi.fn()
const mockUseFriendRequests = vi.fn()

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../features/friends/useFriendRequests', () => ({
  useFriendRequests: (...args: unknown[]) => mockUseFriendRequests(...args),
}))

vi.mock('../../features/quickPour/QuickPour', () => ({
  QuickPour: ({ bottleName }: { bottleName: string }) => <div>Quick Pour view — {bottleName}</div>,
}))

vi.mock('../../features/pourWizard/PourWizard', () => ({
  PourWizard: ({ bottleName }: { bottleName: string }) => <div>Pour Wizard view — {bottleName}</div>,
}))

const bottles: Bottle[] = [{ id: 'b1', name: 'Eagle Rare', status: 'open' }]

function renderNav(initialEntry = '/') {
  mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] } })
  mockUseAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false })
  mockUseFriendRequests.mockReturnValue({ incoming: [], outgoing: [], loading: false, reload: vi.fn() })
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <BottomNav />
    </MemoryRouter>,
  )
}

describe('BottomNav', () => {
  it('renders the five destinations in order: Home, My Bar, Pour, Journey, Friends', () => {
    renderNav()
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const items = Array.from(nav.children).map((el) => el.textContent?.trim())
    expect(items).toEqual(['Home', 'My Bar', '🥃Pour', 'Journey', 'Friends'])
  })

  it('shows a badge on Friends when there are incoming friend requests', () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] } })
    mockUseAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false })
    mockUseFriendRequests.mockReturnValue({
      incoming: [{ id: 'r1' }, { id: 'r2' }],
      outgoing: [],
      loading: false,
      reload: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/']}>
        <BottomNav />
      </MemoryRouter>,
    )

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('does not show Discover as a permanent bottom-nav destination', () => {
    renderNav()
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(nav).queryByText('Discover')).not.toBeInTheDocument()
  })

  it('marks Home active on "/" and My Bar active on "/collection"', () => {
    renderNav('/')
    expect(screen.getByRole('link', { name: /Home/ }).className).toMatch(/linkActive/)
    expect(screen.getByRole('link', { name: /My Bar/ }).className).not.toMatch(/linkActive/)
  })

  it('marks My Bar active on "/collection"', () => {
    renderNav('/collection')
    expect(screen.getByRole('link', { name: /My Bar/ }).className).toMatch(/linkActive/)
    expect(screen.getByRole('link', { name: /Home/ }).className).not.toMatch(/linkActive/)
  })

  it('marks Journey active on "/journal"', () => {
    renderNav('/journal')
    expect(screen.getByRole('link', { name: /Journey/ }).className).toMatch(/linkActive/)
  })

  it('opens the Pour hub with Quick Pour, Pour Story, Blind Room, and Compare when Pour is tapped', async () => {
    renderNav()
    await userEvent.click(screen.getByRole('button', { name: /Pour/ }))

    expect(screen.getByRole('heading', { name: 'Start a Pour' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quick Pour/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pour Story/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Blind Room/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Compare/ })).toBeInTheDocument()
  })

  it('opens Quick Pour via the bottle picker from the nav Pour hub', async () => {
    renderNav()
    await userEvent.click(screen.getByRole('button', { name: /Pour/ }))
    await userEvent.click(screen.getByRole('button', { name: /Quick Pour/ }))

    expect(screen.getByText('Which bottle?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Eagle Rare/ }))

    expect(screen.getByText('Quick Pour view — Eagle Rare')).toBeInTheDocument()
  })
})
