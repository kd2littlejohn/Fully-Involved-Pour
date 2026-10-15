import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SaveToMyTastings } from './SaveToMyTastings'
import { makeCategory, makeParty, makeResults } from './__fixtures__/party'
import type { PartyBallot } from './types'
import type { SavedTasting } from '../../data/types'

const mockUseAuth = vi.fn()
const mockSave = vi.fn()
let tastings: SavedTasting[] = []
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles: [{ id: 'mine', name: 'Weller 12', status: 'open' }], tastings }, saveSavedTastings: mockSave }),
}))

const ballot: PartyBallot = {
  id: 'c1__g1',
  partyId: 'p1',
  categoryId: 'c1',
  participantKey: 'g1',
  source: 'digital',
  ownerUid: 'u1',
  mode: 'quick',
  scores: { A: { overall: 7 }, B: { overall: 9, descriptors: ['Honey'] } },
  favoriteLabel: 'B',
  predictionLabel: null,
  excluded: false,
  createdAt: 1,
  updatedAt: 1,
  revision: 1,
}
const category = makeCategory({ state: 'revealed', revealedAt: 5 })

function renderCard() {
  return render(
    <MemoryRouter>
      <SaveToMyTastings party={makeParty()} category={category} results={makeResults()} ballot={ballot} />
    </MemoryRouter>,
  )
}

describe('SaveToMyTastings', () => {
  beforeEach(() => {
    tastings = []
    mockSave.mockReset().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
  })

  it('saves every scored pour of the revealed round, linked to My Bar where it matches', async () => {
    renderCard()
    expect(screen.getByText(/1 matches a bottle in your bar/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save to My Tastings' }))
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1))
    const saved = mockSave.mock.calls[0]![0] as SavedTasting[]
    expect(saved.map((t) => [t.label, t.bottle.name, t.bottleId, t.overall])).toEqual([
      ['B', 'Weller 12', 'mine', 9],
      ['A', 'Larceny', undefined, 7],
    ])
  })

  it('shows it’s already saved instead of offering a duplicate save', () => {
    tastings = [{ id: 'party:p1:c1:A' } as SavedTasting, { id: 'party:p1:c1:B' } as SavedTasting]
    renderCard()
    expect(screen.getByRole('heading', { name: 'Saved to My Tastings ✓' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save to My Tastings' })).not.toBeInTheDocument()
  })

  it('shows an error and lets you retry when saving fails', async () => {
    mockSave.mockRejectedValueOnce(new Error('offline'))
    renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Save to My Tastings' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save')
    expect(screen.getByRole('button', { name: 'Save to My Tastings' })).toBeEnabled()
  })

  it('stays out of the way for anonymous guests (they get “Keep my results” instead)', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    const { container } = renderCard()
    expect(container).toBeEmptyDOMElement()
  })
})
