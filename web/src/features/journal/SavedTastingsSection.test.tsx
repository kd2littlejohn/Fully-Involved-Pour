import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SavedTastingsSection } from './SavedTastingsSection'
import type { SavedTasting } from '../../data/types'

const mockDelete = vi.fn().mockResolvedValue(undefined)
vi.mock('../../hooks/useUserData', () => ({ useUserData: () => ({ deleteSavedTasting: mockDelete }) }))

const base: SavedTasting = {
  id: 'party:p1:c1:A',
  source: 'party',
  format: 'blind',
  partyId: 'p1',
  eventName: 'Friday Blind',
  categoryId: 'c1',
  categoryName: 'Wheated',
  label: 'A',
  date: '2026-10-10',
  bottle: { name: 'Larceny' },
  overall: 8.5,
  descriptors: ['Caramel'],
  favorite: true,
  notFullyBlind: true,
  savedAt: 1,
}

describe('SavedTastingsSection', () => {
  it('lists saved event tastings, newest first, with origin and integrity', () => {
    render(
      <MemoryRouter>
        <SavedTastingsSection
          tastings={[
            base,
            { ...base, id: 'x', date: '2026-10-12', bottle: { name: 'Weller 12' }, format: 'regular', bottleId: 'b1', favorite: false, notFullyBlind: false },
          ]}
        />
      </MemoryRouter>,
    )
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Weller 12')
    expect(within(items[0]!).getByRole('link', { name: 'Weller 12' })).toHaveAttribute('href', '/collection/b1')
    expect(items[0]).toHaveTextContent('Regular')
    expect(items[1]).toHaveTextContent('Friday Blind · Wheated · Oct 10, 2026')
    expect(items[1]).toHaveTextContent('Blind · Sample A')
    expect(items[1]).toHaveTextContent('Your favorite')
    expect(items[1]).toHaveTextContent('Not fully blind')
  })

  it('removes one only after confirming', async () => {
    render(
      <MemoryRouter>
        <SavedTastingsSection tastings={[base]} />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Remove Larceny from My Tastings' }))
    expect(mockDelete).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('party:p1:c1:A'))
  })

  it('renders nothing when there are none', () => {
    const { container } = render(
      <MemoryRouter>
        <SavedTastingsSection tastings={[]} />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
