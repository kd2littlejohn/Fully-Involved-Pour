import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxeHubPage } from './AxeHubPage'
import type { Bottle, InfinityBottle } from '../../data/types'

const mockUseUserData = vi.fn()
const mockOpenAxe = vi.fn()
const mockAsk = vi.fn()
const mockCall = vi.fn()

vi.mock('../../hooks/useUserData', () => ({ useUserData: () => mockUseUserData() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1', displayName: 'Kevin Littlejohn' }, loading: false }) }))
vi.mock('../../features/sommelier/SommelierProvider', () => ({
  useSommelier: () => ({ openAxe: mockOpenAxe, ask: mockAsk, askAboutInsight: vi.fn() }),
}))
// Every AI/Cloud Function call fails: the Hub must still work without AI.
vi.mock('firebase/functions', () => ({ httpsCallable: () => (data: unknown) => mockCall(data) }))
vi.mock('../../data/firebase', () => ({ db: {}, functions: {} }))
vi.mock('../../data/devMode', () => ({ isMockAuthEnabled: () => false }))
vi.mock('../../features/quickPour/QuickPour', () => ({
  QuickPour: ({ bottleName }: { bottleName: string }) => <div>Quick Pour view — {bottleName}</div>,
}))

const bottles: Bottle[] = [{ id: 'b1', name: 'Eagle Rare', status: 'open' }]
const infinity: InfinityBottle = {
  id: 'ib1',
  name: 'House Blend',
  archived: false,
  createdAt: 1,
  batches: [{ id: 'batch1', status: 'active', startedAt: 1, additions: [], tastings: [] }],
}

function Where() {
  const location = useLocation()
  return <div>At {location.pathname}</div>
}

function renderHub(entry: string | { pathname: string; state?: unknown } = '/axe', infinityBottles: InfinityBottle[] = []) {
  mockUseUserData.mockReturnValue({
    userDoc: { bottles, pours: [], memories: [], infinityBottles, customLibrary: [], people: [], greetingName: undefined },
  })
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/axe" element={<AxeHubPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AxeHubPage', () => {
  beforeEach(() => {
    mockOpenAxe.mockClear()
    mockAsk.mockClear()
    mockCall.mockReset().mockRejectedValue(new Error('functions/unavailable'))
    localStorage.clear()
  })

  it('greets the user by name with the existing greeting logic', () => {
    renderHub()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Good (morning|afternoon|evening), Kevin\.$/)
    expect(screen.getByText('What can I help you discover tonight?')).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByText('Your Personal Sommelier')).toBeInTheDocument()
  })

  it('shows the six actions', () => {
    renderHub()
    for (const name of ['Start a Pour', 'What Should I Pour?', 'Explore My Palate', 'Explore My Bar', 'Discover Something New', 'Ask AXE']) {
      expect(screen.getByRole('button', { name: new RegExp(name.replace('?', '\\?')) })).toBeInTheDocument()
    }
  })

  it('Start a Pour opens the existing Pour menu with all five workflows', async () => {
    renderHub('/axe', [infinity])
    await userEvent.click(screen.getByRole('button', { name: /Start a Pour/ }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    for (const name of ['Record a Pour', 'Start a Blind Tasting', 'Add a Bottle', 'Update an Open Bottle', 'Add to an Infinity Bottle']) {
      expect(within(dialog).getByRole('button', { name: new RegExp(name) })).toBeInTheDocument()
    }
  })

  it('Record a Pour still runs the existing pick-a-bottle → Quick Pour flow, with no AI step', async () => {
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: /Start a Pour/ }))
    await userEvent.click(screen.getByRole('button', { name: /Record a Pour/ }))
    await userEvent.click(screen.getByRole('button', { name: /Eagle Rare/ }))
    expect(screen.getByText('Quick Pour view — Eagle Rare')).toBeInTheDocument()
    expect(mockOpenAxe).not.toHaveBeenCalled()
  })

  it('the legacy /pour route state opens the Pour menu on arrival', () => {
    renderHub({ pathname: '/axe', state: { openPour: true } })
    expect(screen.getByRole('button', { name: /Start a Blind Tasting/ })).toBeInTheDocument()
  })

  it('What Should I Pour? opens the existing mood picker', async () => {
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: /What Should I Pour\?/ }))
    expect(screen.getByRole('heading', { name: 'What Should I Pour?' })).toBeInTheDocument()
  })

  it('routes Explore My Bar, Discover and Explore My Palate to their existing pages', async () => {
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: /Explore My Bar/ }))
    expect(screen.getByText('At /collection')).toBeInTheDocument()
  })

  it('Ask AXE opens the existing AXE conversation', async () => {
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: /Ask AXE/ }))
    expect(mockOpenAxe).toHaveBeenCalled()
  })

  it('Ask AXE anything… sends the question into the existing AXE chat', async () => {
    renderHub()
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask AXE anything' }), 'What pairs with smoked brisket?')
    await userEvent.click(screen.getByRole('button', { name: 'Send to AXE' }))
    expect(mockAsk).toHaveBeenCalledWith('What pairs with smoked brisket?')
    expect(screen.getByRole('textbox', { name: 'Ask AXE anything' })).toHaveValue('')
  })

  it('an empty question just opens AXE', async () => {
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: 'Send to AXE' }))
    expect(mockAsk).not.toHaveBeenCalled()
    expect(mockOpenAxe).toHaveBeenCalled()
  })

  it('still works with AI services unavailable: insight falls back, every card still opens', async () => {
    renderHub()
    expect(await screen.findByRole('region', { name: /AXE Insight/ })).toBeInTheDocument()
    expect(await screen.findByText(/Your journey starts with a pour\.|still getting to know your palate/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Start a Pour/ }))
    expect(screen.getByRole('button', { name: /Record a Pour/ })).toBeInTheDocument()
  })
})
