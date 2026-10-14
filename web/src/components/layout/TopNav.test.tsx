import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { TopNav } from './TopNav'
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

const bottles: Bottle[] = [{ id: 'b1', name: 'Eagle Rare', status: 'open' }]

function renderNav(initialEntry = '/') {
  mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] }, profile: undefined })
  mockUseAuth.mockReturnValue({ user: { uid: 'test-uid', displayName: 'Kevin' }, loading: false })
  mockUseFriendRequests.mockReturnValue({ incoming: [], outgoing: [], loading: false, reload: vi.fn() })
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TopNav />
    </MemoryRouter>,
  )
}

describe('TopNav', () => {
  it('renders the same five destinations as the mobile nav, in the same order', () => {
    renderNav()
    const list = screen.getByRole('list')
    const items = Array.from(list.children).map((el) => el.textContent?.trim())
    expect(items).toEqual(['Home', 'My Bar', 'AXE', 'Journey', 'Friends'])
  })

  it('does not list Discover as a header destination', () => {
    renderNav()
    expect(screen.queryByRole('link', { name: 'Discover' })).not.toBeInTheDocument()
  })

  it('marks Journey active on "/journal"', () => {
    renderNav('/journal')
    expect(screen.getByRole('link', { name: 'Journey' }).className).toMatch(/linkActive/)
  })

  it('links the avatar to Profile, with initials when there is no photo', () => {
    renderNav()
    const avatar = screen.getByRole('link', { name: "Kevin's profile" })
    expect(avatar).toHaveAttribute('href', '/profile')
    expect(avatar).toHaveTextContent('KE')
  })

  it('shows a badge next to Friends when there are incoming requests', () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] }, profile: undefined })
    mockUseAuth.mockReturnValue({ user: { uid: 'test-uid', displayName: 'Kevin' }, loading: false })
    mockUseFriendRequests.mockReturnValue({ incoming: [{ id: 'r1' }], outgoing: [], loading: false, reload: vi.fn() })
    render(
      <MemoryRouter initialEntries={['/']}>
        <TopNav />
      </MemoryRouter>,
    )

    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('links AXE to the AXE Hub, like the mobile nav', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'AXE' })).toHaveAttribute('href', '/axe')
  })
})
