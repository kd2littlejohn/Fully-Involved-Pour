import { describe, expect, it } from 'vitest'
import { friendTakeSummary, friendEvolutionInsight } from './describeFriendTake'
import type { FriendBottleTake } from '../../data/types'

function take(overrides: Partial<FriendBottleTake> & Pick<FriendBottleTake, 'pourCount'>): FriendBottleTake {
  return overrides
}

describe('friendTakeSummary', () => {
  it('returns undefined when there are no real notes to summarize — never invents one', () => {
    expect(friendTakeSummary(take({ pourCount: 0 }), 'David')).toBeUndefined()
  })

  it('phrases a single pour in the past tense, without "Based on X pours"', () => {
    const result = friendTakeSummary(take({ pourCount: 1, topNotes: ['Caramel', 'Vanilla'], finishNotes: ['Long'] }), 'David')
    expect(result).toBe('David found caramel and vanilla, with a long finish.')
  })

  it('phrases 2-3 pours as "notes", not yet "consistently finds"', () => {
    const result = friendTakeSummary(take({ pourCount: 2, topNotes: ['Caramel', 'Oak'] }), 'David')
    expect(result).toBe('Based on 2 pours, David notes caramel and oak.')
  })

  it('phrases 4+ pours as "consistently finds", with the real pour count', () => {
    const result = friendTakeSummary(
      take({ pourCount: 5, topNotes: ['Caramel', 'Dark Fruit', 'Oak'], finishNotes: ['Long', 'Warm'] }),
      'David',
    )
    expect(result).toBe('Based on 5 pours, David consistently finds caramel, dark fruit, and oak, with a long and warm finish.')
  })

  it('omits the finish clause entirely when there is no real finish data', () => {
    const result = friendTakeSummary(take({ pourCount: 4, topNotes: ['Caramel'] }), 'David')
    expect(result).toBe('Based on 4 pours, David consistently finds caramel.')
  })
})

describe('friendEvolutionInsight', () => {
  it('returns undefined when there is no evolving term — never fabricates a trend', () => {
    expect(friendEvolutionInsight(take({ pourCount: 4 }))).toBeUndefined()
  })

  it('phrases a real evolving term generically, not more specifically than the underlying signal supports', () => {
    const result = friendEvolutionInsight(take({ pourCount: 5, evolvingTerm: 'Oak' }))
    expect(result).toEqual({ title: 'More Oak', detail: 'Oak has come up more consistently in the last few pours.' })
  })
})
