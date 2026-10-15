import { describe, expect, it } from 'vitest'
import type { Bottle } from '../../data/types'
import { formatLegacyDate, legacyBottles, legacyCandidates, legacyStoryDraft, legacyStoryPatch } from './legacyBottles'

const bottles: Bottle[] = [
  { id: 'a', name: 'Weller 12', status: 'open', createdAt: 3 },
  {
    id: 'b',
    name: "Blanton's",
    status: 'finished',
    legacyShelf: true,
    createdAt: 2,
  },
  {
    id: 'c',
    name: 'Eagle Rare',
    status: 'sealed',
    legacyShelf: true,
    legacyShelfReason: 'From Dad',
    createdAt: 5,
  },
  {
    id: 'd',
    name: 'Pappy 15',
    status: 'wishlist',
    legacyShelf: true,
    createdAt: 1,
  },
]

describe('legacyBottles', () => {
  it('keeps finished bottles, skips wishlist, and puts bottles with a story first', () => {
    expect(legacyBottles(bottles).map((b) => b.id)).toEqual(['c', 'b'])
  })
})

describe('legacyCandidates', () => {
  it('offers owned bottles that are not already Legacy', () => {
    expect(legacyCandidates(bottles).map((b) => b.id)).toEqual(['a'])
  })
})

describe('legacy story draft/patch', () => {
  it('round-trips the saved story fields into a prefilled draft', () => {
    const bottle: Bottle = {
      id: 'x',
      name: 'Eagle Rare',
      status: 'open',
      legacyShelf: true,
      legacyStoryTitle: 'From Dad',
      legacyShelfReason: 'His favorite',
      legacyStory: 'Long story',
      legacyOccasion: 'Retirement',
      legacyDate: '2020-05-01',
    }
    expect(legacyStoryDraft(bottle)).toEqual({
      title: 'From Dad',
      reason: 'His favorite',
      story: 'Long story',
      occasion: 'Retirement',
      date: '2020-05-01',
    })
  })

  it('trims, drops cleared fields, ignores a malformed date, and never touches tasting notes or the Legacy flag', () => {
    const patch = legacyStoryPatch(
      {
        title: '  Title  ',
        reason: '',
        story: ' Story ',
        occasion: '   ',
        date: 'nope',
      },
      42,
    )
    expect(patch).toEqual({
      legacyStoryTitle: 'Title',
      legacyShelfReason: undefined,
      legacyStory: 'Story',
      legacyOccasion: undefined,
      legacyDate: undefined,
      legacyStoryUpdatedAt: 42,
    })
  })

  it('counts a full story (not just a reason) as having a story when ordering', () => {
    const withStory: Bottle = {
      id: 'z',
      name: 'Z',
      status: 'open',
      legacyShelf: true,
      legacyStory: 'Yes',
      createdAt: 9,
    }
    expect(legacyBottles([...bottles, withStory]).map((b) => b.id)).toEqual(['c', 'z', 'b'])
  })

  it('formats the meaningful date without timezone drift', () => {
    expect(formatLegacyDate('2019-06-14')).toBe('Jun 14, 2019')
  })
})
