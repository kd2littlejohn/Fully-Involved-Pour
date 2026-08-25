import { beforeEach, describe, expect, it } from 'vitest'
import { hideSharedMomentForUser, readHiddenSharedMomentIds } from './hiddenSharedMoments'

beforeEach(() => {
  localStorage.clear()
})

describe('hiddenSharedMoments', () => {
  it('returns an empty set when nothing has been hidden', () => {
    expect(readHiddenSharedMomentIds('u1')).toEqual(new Set())
  })

  it('hiding a moment adds it to that user’s set', () => {
    hideSharedMomentForUser('u1', 'moment-1')
    expect(readHiddenSharedMomentIds('u1')).toEqual(new Set(['moment-1']))
  })

  it('accumulates multiple hidden ids for the same user', () => {
    hideSharedMomentForUser('u1', 'moment-1')
    hideSharedMomentForUser('u1', 'moment-2')
    expect(readHiddenSharedMomentIds('u1')).toEqual(new Set(['moment-1', 'moment-2']))
  })

  it('keeps each user’s hidden list separate', () => {
    hideSharedMomentForUser('u1', 'moment-1')
    hideSharedMomentForUser('u2', 'moment-2')
    expect(readHiddenSharedMomentIds('u1')).toEqual(new Set(['moment-1']))
    expect(readHiddenSharedMomentIds('u2')).toEqual(new Set(['moment-2']))
  })
})
