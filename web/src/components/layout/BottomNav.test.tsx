import { render, screen, within } from '@testing-library/react'
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
  mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } })
  mockUseAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false })
  mockUseFriendRequests.mockReturnValue({ incoming: [], outgoing: [], loading: false, reload: vi.fn() })
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <BottomNav />
    </MemoryRouter>,
  )
}

describe('BottomNav', () => {
  it('renders the five destinations in order: Home, My Bar, AXE, Journey, Friends', () => {
    renderNav()
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const items = Array.from(nav.children).map((el) => el.textContent?.trim())
    expect(items).toEqual(['Home', 'My Bar', 'AXE', 'Journey', 'Friends'])
  })

  it('shows a badge on Friends when there are incoming friend requests', () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } })
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

  it('makes AXE the centre destination, linking to the AXE Hub', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'AXE' })).toHaveAttribute('href', '/axe')
    expect(screen.queryByRole('button', { name: /Pour/ })).not.toBeInTheDocument()
  })

  it('marks AXE active on the Hub', () => {
    renderNav('/axe')
    expect(screen.getByRole('link', { name: 'AXE' }).className).toMatch(/bottomActive/)
  })
})
