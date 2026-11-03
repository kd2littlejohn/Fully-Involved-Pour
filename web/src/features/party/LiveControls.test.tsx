import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveControls } from './LiveControls'
import { flightSubmissions } from './liveProgress'
import { makeCategory, makeParty } from './__fixtures__/party'
import type { PartyRosterEntry } from './types'

const mockProgress = vi.fn()
const mockState = vi.fn()
vi.mock('../../data/repositories/party', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/repositories/party')>()
  return {
    ...actual,
    setPartyProgress: (...a: unknown[]) => mockProgress(...a),
    setCategoryState: (...a: unknown[]) => mockState(...a),
  }
})

const flights = [makeCategory({ id: 'f1', name: 'Flight 1' }), makeCategory({ id: 'f2', name: 'Flight 2', state: 'draft', lockedAt: null })]
const roster: PartyRosterEntry[] = [
  { id: 'g1', name: 'A', role: 'guest', tasting: true, joinedAt: 1, progress: { f1: 'submitted' }, group: 'guided' },
  { id: 'g2', name: 'B', role: 'guest', tasting: true, joinedAt: 1, progress: { f1: 'tasting' }, group: 'guided' },
  { id: 'g3', name: 'C', role: 'guest', tasting: true, joinedAt: 1, progress: {}, group: 'blind' },
  { id: 'co', name: 'D', role: 'cohost', tasting: false, joinedAt: 1, progress: {} },
]

describe('LiveControls', () => {
  beforeEach(() => {
    mockProgress.mockReset()
    mockState.mockReset()
    mockProgress.mockResolvedValue({ progress: {} })
  })

  it('starts the tasting against the seq it shows', async () => {
    render(<LiveControls party={makeParty({ categories: flights })} roster={roster} onRevealAll={() => {}} onEnd={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Start tasting' }))
    expect(mockProgress).toHaveBeenCalledWith('p1', 'start', 0, undefined)
  })

  it('shows where the room is and per-group submissions without scores', () => {
    const party = makeParty({ format: 'dual', categories: flights, progress: { state: 'live', categoryId: 'f1', label: 'B', seq: 4, updatedAt: 1, updatedBy: 'Nathaniel' } })
    render(<LiveControls party={party} roster={roster} onRevealAll={() => {}} onEnd={() => {}} />)
    expect(screen.getByText(/Glass 2 of 6/)).toBeInTheDocument()
    expect(screen.getByText('Last change by Nathaniel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next glass (C)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next flight: Flight 2' })).toBeInTheDocument()
    expect(flightSubmissions(roster, 'f1')).toMatchObject({ guided: { total: 2, submitted: 1 }, blind: { total: 1, submitted: 0 }, all: { total: 3, started: 1 } })
  })

  it('explains a conflict when the other host moved first', async () => {
    mockProgress.mockRejectedValue(Object.assign(new Error('Nathaniel just changed the event. Check where it is now and try again.'), { code: 'functions/aborted' }))
    const party = makeParty({ categories: flights, progress: { state: 'live', categoryId: 'f1', label: 'A', seq: 2, updatedAt: 1, updatedBy: 'Kevin' } })
    render(<LiveControls party={party} roster={roster} onRevealAll={() => {}} onEnd={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Next glass (B)' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Nathaniel just changed the event'))
    expect(mockProgress).toHaveBeenCalledWith('p1', 'advanceGlass', 2, undefined)
  })

  it('pauses, locks after confirming, and hands reveal and end to the dashboard', async () => {
    const onRevealAll = vi.fn()
    const onEnd = vi.fn()
    const closed = [makeCategory({ id: 'f1', name: 'Flight 1' }), makeCategory({ id: 'f2', name: 'Flight 2', state: 'voting_closed' })]
    const party = makeParty({ categories: closed, progress: { state: 'live', categoryId: 'f1', label: 'A', seq: 2, updatedAt: 1, updatedBy: 'Kevin' } })
    render(<LiveControls party={party} roster={roster} onRevealAll={onRevealAll} onEnd={onEnd} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(mockProgress).toHaveBeenCalledWith('p1', 'pause', 2, undefined)
    await userEvent.click(screen.getByRole('button', { name: 'Lock submissions' }))
    await userEvent.click(screen.getAllByRole('button', { name: 'Lock submissions' }).at(-1)!)
    await waitFor(() => expect(mockState).toHaveBeenCalledWith('p1', 'f1', 'voting_closed'))
    await userEvent.click(screen.getByRole('button', { name: 'Reveal results' }))
    await userEvent.click(screen.getByRole('button', { name: 'End event' }))
    expect(onRevealAll).toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalled()
  })
})
