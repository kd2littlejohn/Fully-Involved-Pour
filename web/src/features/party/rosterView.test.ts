/// <reference types="node" />
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildRosterView, coHostRosterId, rosterStatus } from './rosterView'
import { makeCategory, makeParty } from './__fixtures__/party'
import type { PartyRosterEntry } from './types'

const entry = (overrides: Partial<PartyRosterEntry>): PartyRosterEntry => ({
  id: 'g_1',
  name: 'Richy',
  role: 'guest',
  tasting: true,
  joinedAt: 2,
  progress: {},
  ...overrides,
})

describe('buildRosterView', () => {
  it('counts the tasting host and guests, and lists non-tasting admins separately', () => {
    const view = buildRosterView(
      makeParty(),
      [
        entry({ id: 'g_2', name: 'Sam', joinedAt: 5 }),
        entry({ id: 'c_abc', name: 'Pat', role: 'cohost', tasting: false, joinedAt: 1 }),
        entry({ id: 'host', name: 'Kevin', role: 'host', tasting: true, joinedAt: 0 }),
        entry({ id: 'g_1', name: 'Richy', joinedAt: 3 }),
      ],
      'g_1',
    )
    expect(view.count).toBe(3)
    expect(view.tasting.map((r) => [r.name, r.roleLabel, r.isMe])).toEqual([
      ['Kevin', 'Host', false],
      ['Richy', 'Guest', true],
      ['Sam', 'Guest', false],
    ])
    expect(view.hosting.map((r) => [r.name, r.roleLabel, r.status])).toEqual([['Pat', 'Co-host', null]])
  })

  it('leaves a host who is only hosting out of the count', () => {
    const view = buildRosterView(makeParty(), [entry({ id: 'host', name: 'Kevin', role: 'host', tasting: false }), entry({})], null)
    expect(view.count).toBe(1)
    expect(view.hosting[0]).toMatchObject({ name: 'Kevin', roleLabel: 'Host', status: null })
  })

  it('never counts a co-host, even if an entry claims they are tasting', () => {
    const view = buildRosterView(makeParty(), [entry({ id: 'c_x', role: 'cohost', tasting: true })], null)
    expect(view.count).toBe(0)
  })

  it('uses initials for the avatar', () => {
    expect(buildRosterView(makeParty(), [entry({ name: ' kevin' })], null).tasting[0]!.initial).toBe('K')
  })
})

describe('rosterStatus', () => {
  it('reflects the open round from real ballot progress only', () => {
    expect(rosterStatus(entry({}), 'c1')).toBe('Joined')
    expect(rosterStatus(entry({ progress: { c1: 'tasting' } }), 'c1')).toBe('Tasting')
    expect(rosterStatus(entry({ progress: { c1: 'submitted' } }), 'c1')).toBe('Submitted')
    expect(rosterStatus(entry({ progress: { c0: 'submitted' } }), 'c1')).toBe('Joined')
    expect(rosterStatus(entry({ progress: { c1: 'submitted' } }), null)).toBe('Joined')
    expect(rosterStatus(entry({ tasting: false }), 'c1')).toBeNull()
  })

  it('shows Joined between rounds', () => {
    const party = makeParty({ categories: [makeCategory({ state: 'voting_closed' })] })
    expect(buildRosterView(party, [entry({ progress: { c1: 'submitted' } })], null).tasting[0]!.status).toBe('Joined')
  })
})

describe('coHostRosterId', () => {
  it('matches the server’s one-way id', async () => {
    const expected = `c_${createHash('sha256').update('p1:uid-123').digest('hex').slice(0, 20)}`
    expect(await coHostRosterId('p1', 'uid-123')).toBe(expected)
  })
})
