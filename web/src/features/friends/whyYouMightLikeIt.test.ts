import { describe, expect, it } from 'vitest'
import { whyYouMightLikeIt } from './whyYouMightLikeIt'

describe('whyYouMightLikeIt', () => {
  it('returns undefined when either person has no whiskey identity tags yet', () => {
    expect(whyYouMightLikeIt(undefined, ['Bourbon'], 'Mike')).toBeUndefined()
    expect(whyYouMightLikeIt(['Bourbon'], undefined, 'Mike')).toBeUndefined()
    expect(whyYouMightLikeIt([], ['Bourbon'], 'Mike')).toBeUndefined()
  })

  it('returns undefined when there is no real overlap — never fabricates a reason', () => {
    expect(whyYouMightLikeIt(['Rye', 'Spice-Forward'], ['Bourbon', 'Sweet'], 'Mike')).toBeUndefined()
  })

  it('names the real shared tags, case-insensitively, capped at two', () => {
    const result = whyYouMightLikeIt(['Bourbon', 'Oak-Forward', 'Higher Proof'], ['bourbon', 'oak-forward', 'higher proof', 'Sweet'], 'Mike')
    expect(result).toBe('You and Mike both tend to rate bourbon, oak-forward pours highly.')
  })

  it('names a single shared tag when only one overlaps', () => {
    const result = whyYouMightLikeIt(['Bourbon', 'Sweet'], ['Rye', 'Bourbon'], 'Mike')
    expect(result).toBe('You and Mike both tend to rate bourbon pours highly.')
  })
})
