import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WhatShouldIPourCard } from './WhatShouldIPourCard'
import { SommelierProvider } from '../sommelier/SommelierProvider'
import type { Bottle } from '../../data/types'

const mockUseUserData = vi.fn()
const mockExplainPourRecommendation = vi.fn()

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

const mockAskSommelier = vi.fn()
vi.mock('../../data/repositories/ai', () => ({
  askSommelier: (...args: unknown[]) => mockAskSommelier(...args),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' } }),
}))

vi.mock('../../data/repositories/pourRecommendationExplanation', () => ({
  explainPourRecommendation: (...args: unknown[]) => mockExplainPourRecommendation(...args),
}))

const bottles: Bottle[] = [{ id: 'b1', name: 'Eagle Rare', status: 'open' }]

beforeEach(() => {
  localStorage.clear()
  mockExplainPourRecommendation.mockReset().mockResolvedValue(null)
  mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } })
})

function renderCard(bottleList: Bottle[] = bottles, uid: string | undefined = 'u1') {
  return render(
    <MemoryRouter>
      <WhatShouldIPourCard uid={uid} bottles={bottleList} pours={[]} />
    </MemoryRouter>,
  )
}

describe('WhatShouldIPourCard', () => {
  it('shows an honest empty state when there is nothing pourable', async () => {
    renderCard([{ id: 'w1', name: 'Wishlist Bottle', status: 'wishlist' }])
    await waitFor(() => expect(screen.getByText('Add a sealed or opened bottle to your bar to get a recommendation.')).toBeInTheDocument())
  })

  it('recommends the only eligible bottle, linking to it from the image', async () => {
    renderCard()
    await waitFor(() => expect(screen.getAllByText('Eagle Rare').length).toBeGreaterThan(0))
    expect(screen.getByRole('link', { name: 'View Eagle Rare' })).toHaveAttribute('href', '/collection/b1')
  })

  it('still offers a way to choose by mood underneath the default pick', async () => {
    renderCard()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pick by mood' })).toBeInTheDocument())
  })

  it('picks again without erroring when Another Pick is pressed', async () => {
    renderCard([bottles[0]!, { id: 'b2', name: 'Weller 12', status: 'sealed' }])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Another Pick' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Another Pick' }))
    expect(screen.getByText(/Eagle Rare|Weller 12/)).toBeInTheDocument()
  })

  it('renders nothing until signed in (no uid yet)', () => {
    render(
      <MemoryRouter>
        <WhatShouldIPourCard uid={undefined} bottles={bottles} pours={[]} />
      </MemoryRouter>,
    )
    expect(screen.queryByText('What Should I Pour?')).not.toBeInTheDocument()
  })

  it('opens AXE about the current pick without re-rolling it or asking the AI on open', async () => {
    mockAskSommelier.mockReset().mockResolvedValue('It fits your love of oak.')
    const many: Bottle[] = [
      { id: 'b1', name: 'Eagle Rare', status: 'open' },
      { id: 'b2', name: 'Weller 12', status: 'open' },
      { id: 'b3', name: 'Blantons', status: 'open' },
    ]
    render(
      <SommelierProvider>
        <MemoryRouter>
          <WhatShouldIPourCard uid="u1" bottles={many} pours={[]} />
        </MemoryRouter>
      </SommelierProvider>,
    )
    await waitFor(() => expect(screen.getByRole('link', { name: /^View / })).toBeInTheDocument())
    const pickedHref = screen.getByRole('link', { name: /^View / }).getAttribute('href')
    const persisted = localStorage.getItem('fip-home-recommendation:u1')

    await userEvent.click(screen.getByRole('button', { name: 'Ask AXE why' }))
    expect(mockAskSommelier).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: /^View / })).toHaveAttribute('href', pickedHref)
    expect(localStorage.getItem('fip-home-recommendation:u1')).toBe(persisted)

    await userEvent.click(screen.getByRole('button', { name: /Why this pour tonight/ }))
    const pickedId = pickedHref?.split('/').pop()
    expect(mockAskSommelier).toHaveBeenCalledWith(
      'Why is this a good pour for me tonight?',
      [],
      expect.objectContaining({ screen: 'pour-recommendation', bottleId: pickedId }),
    )
    expect(screen.getByRole('link', { name: /^View / })).toHaveAttribute('href', pickedHref)
  })

  it("shows the bottle's proof and labels the card Tonight's Pick", async () => {
    renderCard([{ id: 'b1', name: 'Eagle Rare', status: 'open', proof: 90, distillery: 'Buffalo Trace' }])
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tonight’s Pick' })).toBeInTheDocument())
    expect(screen.getByText('Buffalo Trace · 90 proof')).toBeInTheDocument()
  })

  it('keeps the same pick across a remount (navigation) and only changes on Another Pick', async () => {
    const many: Bottle[] = [
      { id: 'b1', name: 'Eagle Rare', status: 'open' },
      { id: 'b2', name: 'Weller 12', status: 'open' },
      { id: 'b3', name: 'Blantons', status: 'open' },
    ]
    const first = renderCard(many)
    await waitFor(() => expect(screen.getByRole('link', { name: /^View / })).toBeInTheDocument())
    const picked = screen.getByRole('link', { name: /^View / }).getAttribute('href')
    first.unmount()
    renderCard(many)
    await waitFor(() => expect(screen.getByRole('link', { name: /^View / })).toHaveAttribute('href', picked))
    expect(mockExplainPourRecommendation).toHaveBeenCalledTimes(1)
  })

  it("reports the featured bottle so Home can keep it out of Maybe Tonight", async () => {
    const onPickChange = vi.fn()
    render(
      <MemoryRouter>
        <WhatShouldIPourCard uid="u1" bottles={bottles} pours={[]} onPickChange={onPickChange} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(onPickChange).toHaveBeenLastCalledWith('b1'))
  })
})
