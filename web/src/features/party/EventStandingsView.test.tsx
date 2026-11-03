import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EventStandingsView } from './EventStandingsView'
import type { PartyEventStandings, PartyStandingEntry } from './types'

const e = (name: string, rank: number | null, average: number | null, categoryName = 'Flight 1'): PartyStandingEntry => ({
  key: name, categoryId: categoryName, categoryName, label: 'A', bottle: { name }, average, count: 10, rank,
})

describe('EventStandingsView', () => {
  it('shows ties as shared ranks and the guided vs blind split', () => {
    const top = [e('Weller Antique 107', 1, 9), e('Elijah Craig Barrel Proof Rye', 1, 9, 'Flight 2'), e('Woodford Reserve Double Oaked', 3, 8.5, 'Flight 3')]
    const standings: PartyEventStandings = {
      partyId: 'p1', roundsRevealed: 3, overall: [...top, e('Peerless Double Oak', 4, 7)], overallFavorite: top.slice(0, 2), topThree: top,
      flightFavorites: [{ categoryId: 'f1', categoryName: 'Flight 1', winners: [{ label: 'B', bottle: { name: 'Weller Antique 107' } }] }],
      guidedFavorite: [e('Weller Antique 107', 1, 9.2)], blindFavorite: [e('Peerless Double Oak', 1, 8.7)],
      differences: [{ categoryId: 'f1', categoryName: 'Flight 1', label: 'A', bottle: { name: 'Castle & Key Wheated' }, guided: { average: 7.43, count: 7 }, blind: { average: 6.5, count: 3 }, difference: 0.93 }],
      updatedAt: 1,
    }
    render(<EventStandingsView standings={standings} totalFlights={3} />)
    expect(screen.getByRole('heading', { name: /Overall favorite: Weller Antique 107 & Elijah Craig Barrel Proof Rye/ })).toBeInTheDocument()
    expect(screen.getAllByLabelText('Rank T1')).toHaveLength(2)
    expect(screen.getByLabelText('Rank 3')).toBeInTheDocument()
    expect(screen.getByText('Peerless Double Oak')).toBeInTheDocument()
    expect(screen.getByText('+0.93')).toBeInTheDocument()
  })

  it('says when only some flights are revealed, and renders nothing before any', () => {
    const base: PartyEventStandings = { partyId: 'p1', roundsRevealed: 1, overall: [], overallFavorite: [], topThree: [], flightFavorites: [], updatedAt: 1 }
    const { rerender, container } = render(<EventStandingsView standings={base} totalFlights={3} />)
    expect(screen.getByText(/1 of 3 flights revealed/)).toBeInTheDocument()
    rerender(<EventStandingsView standings={{ ...base, roundsRevealed: 0 }} totalFlights={3} />)
    expect(container).toBeEmptyDOMElement()
  })
})
