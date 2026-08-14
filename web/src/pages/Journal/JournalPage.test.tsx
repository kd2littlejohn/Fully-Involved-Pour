import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { JournalPage } from './JournalPage'
import type { Bottle, Memory, Pour } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

function renderJournal() {
  return render(
    <MemoryRouter>
      <JournalPage />
    </MemoryRouter>,
  )
}

const bottles: Bottle[] = [
  { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 },
  { id: 'b2', name: 'Weller 12', status: 'sealed', createdAt: 2 },
]

const pours: Pour[] = [
  {
    id: 'p1',
    bottleId: 'b1',
    date: '2026-01-01',
    rating: 8.0,
    companion: 'Dad',
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: 8, noseAromas: [], palateFlavors: [] },
  },
  {
    id: 'p2',
    bottleId: 'b1',
    date: '2026-02-01',
    rating: 9.0,
    companion: 'Dad',
    fip: { nose: 2, palate: 3, finish: 2, complexity: 1, value: 1, total: 9, noseAromas: [], palateFlavors: [] },
  },
  {
    id: 'p3',
    bottleId: 'b2',
    date: '2026-03-01',
    rating: 7.0,
    companion: 'Mike',
    fip: { nose: 1.5, palate: 2.5, finish: 1.5, complexity: 0.75, value: 0.75, total: 7, noseAromas: [], palateFlavors: [] },
  },
]

const memories: Memory[] = [
  { id: 'm1', title: "Dad's retirement toast", date: '2026-04-01', people: ['Dad'], bottleId: 'b1', story: 'Celebrated 30 years on the job.' },
]

describe('JournalPage', () => {
  it('shows a sign-in prompt when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: false,
      addBottle: vi.fn(),
    })
    renderJournal()
    expect(screen.getByText('Your first Pour Story starts here.')).toBeInTheDocument()
  })

  it('shows the empty state when signed in with no pours', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: vi.fn(),
    })
    renderJournal()
    expect(screen.getByText('Open a bottle, capture the pour, and begin your whiskey journey.')).toBeInTheDocument()
  })

  it('shows the Stories tab by default with pour cards', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours, memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: vi.fn(),
    })
    renderJournal()
    expect(screen.getAllByText('Eagle Rare').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Weller 12').length).toBeGreaterThan(0)
  })

  it('computes the favorite companion from real pour.companion data', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours, memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: vi.fn(),
    })
    renderJournal()
    await userEvent.click(screen.getByRole('tab', { name: 'People' }))
    expect(screen.getByText('Favorite Companion')).toBeInTheDocument()
    expect(screen.getAllByText('Dad').length).toBe(2) // favorite callout + list row
    expect(screen.getByText('2 pours · 1 bottle')).toBeInTheDocument()
  })

  it('shows only opened/finished bottles on the Bottles tab', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours, memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: vi.fn(),
    })
    renderJournal()
    await userEvent.click(screen.getByRole('tab', { name: 'Bottles' }))
    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    expect(screen.queryByText('Weller 12')).not.toBeInTheDocument()
  })

  it('shows a real score-evolution row on the Bottles tab once a bottle has 2+ pours', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours, memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: vi.fn(),
    })
    renderJournal()
    await userEvent.click(screen.getByRole('tab', { name: 'Bottles' }))
    // Eagle Rare has 2 real pours (8.0, 9.0) -> Neck Pour / Bottle Kill (or
    // Pour 2, since it's not finished) should render real scores, not a hint.
    expect(screen.getByText('Neck Pour')).toBeInTheDocument()
    expect(screen.queryByText(/Log another pour/)).not.toBeInTheDocument()
  })

  it('does not offer an Ask Assistant tab anymore', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours, memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: vi.fn(),
    })
    renderJournal()
    expect(screen.queryByRole('tab', { name: 'Ask Assistant' })).not.toBeInTheDocument()
  })

  it('shows the verbatim empty state on the Memories tab when there are none', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours, memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: vi.fn(),
    })
    renderJournal()
    await userEvent.click(screen.getByRole('tab', { name: 'Memories' }))
    expect(screen.getByText('No memories captured yet.')).toBeInTheDocument()
  })

  it('opens a Pour Story quick view when a Timeline event is clicked', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours, memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: vi.fn(),
    })
    renderJournal()
    await userEvent.click(screen.getByRole('tab', { name: 'Timeline' }))
    await userEvent.click(screen.getByRole('button', { name: /Weller 12 — 7\.0/ }))

    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(within(dialog).getByRole('heading', { name: 'Weller 12' })).toBeInTheDocument()
  })

  it('shows saved memories with their linked bottle name', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours, memories, infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: vi.fn(),
    })
    renderJournal()
    await userEvent.click(screen.getByRole('tab', { name: 'Memories' }))
    expect(screen.getByText("Dad's retirement toast")).toBeInTheDocument()
    expect(screen.getByText(/Eagle Rare/)).toBeInTheDocument()
  })
})
