import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LastBlindCard } from './LastBlindCard'
import type { LastBlindSummary } from './useLastBlindSummary'
import type { BlindRoom } from '../../data/types'

function room(overrides: Partial<BlindRoom> = {}): BlindRoom {
  return {
    id: 'room-1',
    code: 'ABC123',
    name: 'Double Oak Showdown',
    hostUid: 'host-1',
    hostUsername: 'host',
    sessionType: 'live',
    knowledgeMode: 'single',
    pourCount: 2,
    state: 'revealed',
    createdAt: 1,
    revealedAt: 100,
    participantCount: 2,
    ...overrides,
  }
}

describe('LastBlindCard', () => {
  it('shows the blind name, winning bottle, and score', () => {
    const summary: LastBlindSummary = {
      room: room(),
      winningBottleName: 'Pursuit Double Oaked Rye',
      winningDistillery: 'Pursuit',
      score: 9.3,
    }
    render(
      <MemoryRouter>
        <LastBlindCard summary={summary} />
      </MemoryRouter>,
    )

    expect(screen.getByText('You picked the winner!')).toBeInTheDocument()
    expect(screen.getByText('Pursuit Double Oaked Rye')).toBeInTheDocument()
    expect(screen.getByText('Pursuit')).toBeInTheDocument()
    expect(screen.getByText(/Double Oak Showdown/)).toBeInTheDocument()
    expect(screen.getByText('Score: 9.3')).toBeInTheDocument()
    expect(screen.getByText('1st Place')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Details' })).toHaveAttribute('href', '/blind/room-1/reveal')
  })

  it('omits the score line when there is none', () => {
    const summary: LastBlindSummary = { room: room(), winningBottleName: 'Weller Full Proof' }
    render(
      <MemoryRouter>
        <LastBlindCard summary={summary} />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/^Score:/)).not.toBeInTheDocument()
  })
})
