import { describe, expect, it } from 'vitest'
import { groupCounts, groupProgress, guestGroup } from './dualGroups'
import { buildRosterView } from './rosterView'
import { makeParty } from './__fixtures__/party'
import type { PartyRosterEntry } from './types'

const entry = (id: string, group: 'guided' | 'blind' | undefined, progress: PartyRosterEntry['progress'] = {}, extra: Partial<PartyRosterEntry> = {}): PartyRosterEntry => ({
  id,
  name: id,
  role: 'guest',
  tasting: true,
  joinedAt: 1,
  progress,
  ...(group ? { group } : {}),
  ...extra,
})

describe('dual groups', () => {
  const roster = [
    entry('host', 'guided', { c1: 'submitted' }, { role: 'host' }),
    entry('matt', 'guided', { c1: 'tasting' }),
    entry('ana', 'guided', { c1: 'submitted' }),
    entry('richy', 'blind', { c1: 'submitted' }),
    entry('fay', undefined),
    entry('pat', undefined, {}, { role: 'cohost', tasting: false }),
    entry('host-off', 'guided', {}, { tasting: false }),
  ]

  it('counts submissions per group, never co-hosts or non-tasters, and treats a missing group as blind', () => {
    expect(groupProgress(roster, 'c1')).toEqual({
      guided: { total: 3, submitted: 2, tasting: 1 },
      blind: { total: 2, submitted: 1, tasting: 0 },
    })
    expect(groupCounts(roster)).toEqual({ guided: 3, blind: 2 })
  })

  it('reads a taster’s group the way the server does', () => {
    const dual = makeParty({ format: 'dual' })
    expect(guestGroup(dual, { group: 'guided' })).toBe('guided')
    expect(guestGroup(dual, {})).toBe('blind')
    expect(guestGroup(dual, { isHost: true })).toBe('guided')
    expect(guestGroup(makeParty({ format: 'blind' }), { group: 'guided' })).toBeNull()
  })

  it('splits Who’s Tasting into groups only for dual parties', () => {
    const view = buildRosterView(makeParty({ format: 'dual', categories: [] }), roster, 'richy')
    expect(view.count).toBe(5)
    expect(view.groups?.guided.map((r) => r.name)).toEqual(['host', 'ana', 'matt'])
    expect(view.groups?.blind.map((r) => r.name)).toEqual(['fay', 'richy'])
    expect(view.hosting.map((r) => r.name)).toEqual(['pat', 'host-off'])
    expect(buildRosterView(makeParty({ categories: [] }), roster, null).groups).toBeUndefined()
  })
})
