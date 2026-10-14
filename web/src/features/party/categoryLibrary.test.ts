import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORY_LIBRARY, libraryTags, searchLibrary } from './categoryLibrary'

describe('Tasting Category Library', () => {
  it('ships all twenty default categories with unique, stable ids', () => {
    expect(DEFAULT_CATEGORY_LIBRARY).toHaveLength(20)
    const ids = DEFAULT_CATEGORY_LIBRARY.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
    expect(DEFAULT_CATEGORY_LIBRARY.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Double Oaked', 'Wheated Bourbon', 'Bottled in Bond', 'Mystery Flight', 'Head-to-Head']),
    )
  })

  it('searches by name, description and tag, and filters by tag', () => {
    expect(searchLibrary(DEFAULT_CATEGORY_LIBRARY, 'wheat').map((c) => c.id)).toEqual(['wheated-bourbon'])
    expect(searchLibrary(DEFAULT_CATEGORY_LIBRARY, 'PROOF').map((c) => c.id)).toEqual(
      expect.arrayContaining(['barrel-proof', 'bottled-in-bond']),
    )
    const headToHead = searchLibrary(DEFAULT_CATEGORY_LIBRARY, '', 'head-to-head')
    expect(headToHead.length).toBeGreaterThanOrEqual(4)
    expect(headToHead.every((c) => c.tags.includes('head-to-head'))).toBe(true)
    expect(searchLibrary(DEFAULT_CATEGORY_LIBRARY, '').length).toBe(20)
    expect(libraryTags(DEFAULT_CATEGORY_LIBRARY)).toContain('oak')
  })
})
