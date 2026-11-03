import { describe, expect, it } from 'vitest'
import { glassNumber, liveControls, progressOf, totalGlasses } from './liveProgress'
import { makeCategory, makeParty } from './__fixtures__/party'

const flights = [
  makeCategory({ id: 'f1', name: 'Flight 1', state: 'voting_open' }),
  makeCategory({ id: 'f2', name: 'Flight 2', state: 'draft', lockedAt: null }),
  makeCategory({ id: 'f3', name: 'Flight 3', state: 'draft', lockedAt: null }),
]

describe('liveProgress', () => {
  it('reads an older party with no progress as the lobby', () => {
    expect(progressOf(makeParty())).toMatchObject({ state: 'lobby', seq: 0, categoryId: null })
    expect(progressOf(makeParty({ status: 'completed' })).state).toBe('ended')
  })

  it('numbers glasses across the event by letter only', () => {
    const party = makeParty({ categories: flights })
    expect(totalGlasses(party)).toBe(9)
    expect(glassNumber(party, 'f1', 'A')).toBe(1)
    expect(glassNumber(party, 'f2', 'A')).toBe(4)
    expect(glassNumber(party, 'f3', 'C')).toBe(9)
    expect(glassNumber(party, 'f3', 'Z')).toBeNull()
  })

  it('offers only the commands that apply', () => {
    const lobby = liveControls(makeParty({ categories: flights }))
    expect(lobby.allowed).toMatchObject({ start: true, pause: false, advanceGlass: false, advanceFlight: false })

    const midFlight = liveControls(makeParty({ categories: flights, progress: { state: 'live', categoryId: 'f1', label: 'B', seq: 3, updatedAt: 1, updatedBy: 'Kevin' } }))
    expect(midFlight.allowed).toMatchObject({ start: false, pause: true, resume: false, advanceGlass: true, advanceFlight: true })
    expect(midFlight.nextGlass).toBe('C')
    expect(midFlight.canLock).toBe(true)

    const lastGlass = liveControls(makeParty({ categories: flights, progress: { state: 'paused', categoryId: 'f3', label: 'C', seq: 9, updatedAt: 1, updatedBy: null } }))
    expect(lastGlass.allowed).toMatchObject({ resume: true, pause: false, advanceGlass: false, advanceFlight: false })
  })
})
