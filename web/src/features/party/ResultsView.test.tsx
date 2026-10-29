import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MyTake, ResultsView } from './ResultsView'
import { makeResults } from './__fixtures__/party'

describe('ResultsView', () => {
  it('shows ties as shared first place, rating counts, and an unrated sample as a dash', () => {
    render(<ResultsView results={makeResults()} myParticipantKey="g_me" />)
    const podium = screen.getByRole('list', { name: 'Wheated Bourbon winners' })
    expect(within(podium).getAllByText('Tied for 1st')).toHaveLength(2)
    expect(within(podium).getByText(/3 ratings/)).toBeInTheDocument()
    const standings = screen.getByRole('table', { name: 'Wheated Bourbon standings' })
    const makers = within(standings).getByText("Maker's Mark").closest('tr')!
    expect(within(makers).getAllByText('—').length).toBeGreaterThanOrEqual(2)
    expect(within(standings).getByText('People’s Choice')).toBeInTheDocument()
  })

  it('labels the viewer as You and never shows anything but overall scores', () => {
    render(<ResultsView results={makeResults()} myParticipantKey="g_me" />)
    const compare = screen.getByRole('table', { name: 'Overall enjoyment by taster' })
    expect(within(compare).getByRole('rowheader', { name: 'You' })).toBeInTheDocument()
    expect(within(compare).getByText('Ballot 4')).toBeInTheDocument()
  })

  it('compares the guest’s top pick with the room', () => {
    render(<MyTake results={makeResults()} myScores={{ A: 9, B: 8 }} />)
    expect(screen.getByText(/You agreed with the room!/)).toBeInTheDocument()
  })

  it('notes ballots that may not have been fully blind, without hiding them', () => {
    render(<ResultsView results={makeResults({ unblindedBallots: 1 })} myParticipantKey="g_me" />)
    expect(screen.getByRole('note')).toHaveTextContent('Includes 1 ballot that may not have been fully blind')
    expect(screen.getByRole('note')).toHaveTextContent('It counts like every other ballot')
  })

  it('says nothing when every ballot was blind', () => {
    render(<ResultsView results={makeResults()} myParticipantKey="g_me" />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})

describe('ResultsView for Dual Experience', () => {
  const dual = makeResults({
    groups: {
      guided: {
        samples: [
          { label: 'A', average: 8.6, count: 7, favoriteVotes: 4, rank: 1 },
          { label: 'B', average: 7.2, count: 7, favoriteVotes: 3, rank: 2 },
          { label: 'C', average: null, count: 0, favoriteVotes: 0, rank: null },
        ],
        champions: ['A'],
        peoplesChoice: ['A'],
        ballotsCounted: 7,
        ratingsCounted: 14,
        unblindedBallots: 0,
      },
      blind: {
        samples: [
          { label: 'A', average: 7.9, count: 3, favoriteVotes: 1, rank: 2 },
          { label: 'B', average: 8.1, count: 3, favoriteVotes: 1, rank: 1 },
          { label: 'C', average: 8.1, count: 2, favoriteVotes: 1, rank: 1 },
        ],
        champions: ['B', 'C'],
        peoplesChoice: ['A', 'B', 'C'],
        ballotsCounted: 3,
        ratingsCounted: 8,
        unblindedBallots: 1,
      },
    },
    comparison: {
      samples: [
        { label: 'A', guided: { average: 8.6, count: 7 }, blind: { average: 7.9, count: 3 }, difference: 0.7 },
        { label: 'B', guided: { average: 7.2, count: 7 }, blind: { average: 8.1, count: 3 }, difference: 0.9 },
        { label: 'C', guided: { average: null, count: 0 }, blind: { average: 8.1, count: 2 }, difference: null },
      ],
      largestDifference: ['B'],
      largestDifferenceValue: 0.9,
      bothEnjoyed: ['A', 'B'],
      bothEnjoyedMin: 7,
      sameWinner: false,
    },
  })

  it('compares the groups by average with sample sizes, identifies ties, and claims no cause', () => {
    render(<ResultsView results={dual} />)
    const table = screen.getByRole('table', { name: /guided and blind groups compared/ })
    expect(within(table).getByRole('row', { name: /Tasters 7 3/ })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: "Favorite bottle Larceny Weller 12 & Maker's Mark (tie)" })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /People’s Choice Larceny .*\(tie\)/ })).toBeInTheDocument()
    const bottles = screen.getByRole('list', { name: 'Each bottle, guided and blind' })
    expect(within(bottles).getByText('8.6 / 10')).toBeInTheDocument()
    expect(within(bottles).getAllByText(/· 7 ratings/).length).toBeGreaterThan(0)
    expect(within(bottles).getByText('No ratings')).toBeInTheDocument()
    const highlights = screen.getByRole('list', { name: 'Guided and blind highlights' })
    expect(within(highlights).getByText('Largest difference').parentElement).toHaveTextContent('Weller 12')
    expect(within(highlights).getByText('Both groups enjoyed').parentElement).toHaveTextContent('Larceny & Weller 12')
    expect(screen.getByText(/compare averages, not totals/)).toHaveTextContent('not why')
    expect(screen.getByText(/1 blind ballot was not fully blind/)).toBeInTheDocument()
  })

  it('leaves single-format results without a comparison', () => {
    render(<ResultsView results={makeResults()} />)
    expect(screen.queryByText('Guided vs. Blind')).not.toBeInTheDocument()
  })
})
