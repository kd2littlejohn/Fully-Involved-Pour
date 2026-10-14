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
})
