import { describe, expect, it } from 'vitest'
import {
  addSample,
  assignLabel,
  draftFromParty,
  draftProblems,
  duplicateCategory,
  emptyDraft,
  finalizeLabels,
  moveItem,
  moveSample,
  newDraftCategory,
  normalizeLabels,
  removeSample,
  shuffleLabels,
  mergeBottleKey,
  bottleKeyHidden,
  withDualDefaults,
  extrasForServer,
  type DraftSample,
} from './setupDraft'
import type { Party } from './types'

const bottle = (name: string) => ({ name, source: 'manual' as const })

function withBottles(count: number) {
  let category = newDraftCategory({ libraryId: 'head-to-head', name: 'Head-to-Head', description: '' })
  for (let i = 0; i < count; i++) category = addSample(category, bottle(`B${i + 1}`))
  return category
}

function labelsOf(samples: DraftSample[]) {
  return samples.map((s) => s.label)
}

describe('setup draft', () => {
  it('supports any number of bottles from two up to twelve, lettered A..N', () => {
    expect(labelsOf(withBottles(2).samples)).toEqual(['A', 'B'])
    expect(labelsOf(withBottles(5).samples)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(withBottles(14).samples).toHaveLength(12)
  })

  it('keeps letters a permutation when bottles are removed or reordered', () => {
    let category = withBottles(4)
    category = removeSample(category, category.samples[1]!.key)
    expect(labelsOf(category.samples).sort()).toEqual(['A', 'B', 'C'])
    category = moveSample(category, 0, 2)
    expect(category.samples.map((s) => s.bottle.name)).toEqual(['B3', 'B4', 'B1'])
    expect(labelsOf(normalizeLabels(category.samples)).sort()).toEqual(['A', 'B', 'C'])
  })

  it('shuffles letters into a valid permutation', () => {
    const samples = withBottles(8).samples
    for (let i = 0; i < 20; i++) expect(labelsOf(shuffleLabels(samples)).sort()).toEqual(labelsOf(samples))
  })

  it('swaps letters on manual assignment so none repeat', () => {
    const samples = withBottles(3).samples
    const next = assignLabel(samples, samples[0]!.key, 'C')
    expect(labelsOf(next)).toEqual(['C', 'B', 'A'])
  })

  it('duplicates a category as a new round with the same bottles and fresh letters', () => {
    const original = { ...withBottles(3), id: 'server-id', locked: true }
    const copy = duplicateCategory(original, ['Head-to-Head', 'Head-to-Head (Round 2)'])
    expect(copy.name).toBe('Head-to-Head (Round 3)')
    expect(copy.id).toBeUndefined()
    expect(copy.locked).toBe(false)
    expect(copy.samples.map((s) => s.bottle.name).sort()).toEqual(['B1', 'B2', 'B3'])
    expect(copy.samples.every((s, i) => s.key !== original.samples[i]!.key)).toBe(true)
  })

  it('never edits a locked category', () => {
    const locked = { ...withBottles(2), locked: true }
    expect(addSample(locked, bottle('X'))).toBe(locked)
    expect(removeSample(locked, locked.samples[0]!.key)).toBe(locked)
  })

  it('randomizes letters before saving only for rounds the host did not letter by hand', () => {
    const manual = { ...withBottles(3), manualLabels: true }
    const auto = withBottles(3)
    const [m, a] = finalizeLabels([manual, auto])
    expect(m).toBe(manual)
    expect(labelsOf(a!.samples).sort()).toEqual(['A', 'B', 'C'])
  })

  it('moves items within bounds only', () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
    expect(moveItem([1, 2, 3], 0, 5)).toEqual([1, 2, 3])
  })

  it('reports problems per wizard step', () => {
    const draft = emptyDraft()
    expect(draftProblems(draft).details).toContain('Give your party a name.')
    expect(draftProblems(draft).categories).toContain('Pick at least one category.')
    const ready = { ...draft, name: 'Night', categories: [withBottles(1)] }
    expect(draftProblems(ready).bottles[0]).toMatch(/at least 2 bottles/)
    expect(draftProblems({ ...ready, categories: [withBottles(2)] })).toEqual({ details: [], categories: [], bottles: [] })
    expect(draftProblems({ ...ready, capacity: '500' }).details[0]).toMatch(/capacity/)
  })

  it('loads an existing party, marking voting-started rounds as locked', () => {
    const party = {
      name: 'Night',
      description: '',
      eventDate: '2026-10-31T19:30',
      coverImageUrl: '',
      capacity: 12,
      settings: { allowEdits: false },
      categories: [
        { id: 'c1', libraryId: null, name: 'Rye', description: '', lockedAt: 123, sampleLabels: ['A', 'B'] },
        { id: 'c2', libraryId: 'mystery-flight', name: 'Mystery', description: '', lockedAt: null, sampleLabels: [] },
      ],
    } as unknown as Party
    const draft = draftFromParty(party, {
      partyId: 'p',
      hostUid: 'h',
      categories: { c1: { samples: [{ id: 's1', label: 'B', bottle: bottle('Pikesville') }] } },
    })
    expect(draft).toMatchObject({ eventDate: '2026-10-31', eventTime: '19:30', capacity: '12' })
    expect(draft.settings.allowEdits).toBe(false)
    expect(draft.settings.defaultScoring).toBe('quick')
    expect(draft.categories[0]).toMatchObject({ id: 'c1', locked: true, samplesDirty: false })
    expect(draft.categories[0]!.samples[0]).toMatchObject({ label: 'B', bottle: { name: 'Pikesville' } })
    expect(draft.categories[1]!.locked).toBe(false)
    // Parties from before host participation start with it off.
    expect(draft.hostTasting).toBe(false)
  })

  it('has the host tasting too by default for a new party', () => {
    expect(emptyDraft().hostTasting).toBe(true)
  })

  it('loads an existing party with its bottles hidden until the key is opened, and never loses them', () => {
    const party = {
      name: 'Night',
      description: '',
      eventDate: null,
      coverImageUrl: '',
      capacity: null,
      settings: {},
      categories: [
        { id: 'c1', libraryId: null, name: 'Rye', description: '', lockedAt: null, sampleLabels: ['A', 'B', 'C'] },
        { id: 'c2', libraryId: null, name: 'Empty', description: '', lockedAt: null, sampleLabels: [] },
      ],
    } as unknown as Party
    const draft = draftFromParty(party)
    expect(bottleKeyHidden(draft)).toBe(true)
    expect(draft.categories[0]).toMatchObject({ hiddenCount: 3, samples: [], samplesDirty: false })
    // Hidden bottles still count toward the two-bottle minimum.
    expect(draftProblems(draft).bottles).toEqual([])
    // Edits made while hidden survive opening the key.
    const renamed = { ...draft, name: 'Renamed', categories: draft.categories.map((c) => ({ ...c, name: c.name + '!' })) }
    const opened = mergeBottleKey(renamed, {
      categories: {
        c1: {
          samples: [
            { id: 's1', label: 'B', bottle: bottle('Pikesville') },
            { id: 's2', label: 'A', bottle: bottle('Rittenhouse') },
            { id: 's3', label: 'C', bottle: bottle('Sazerac') },
          ],
        },
      },
    })
    expect(bottleKeyHidden(opened)).toBe(false)
    expect(opened.name).toBe('Renamed')
    expect(opened.categories[0]!.name).toBe('Rye!')
    expect(opened.categories[0]!.samples.map((s) => s.bottle.name)).toEqual(['Pikesville', 'Rittenhouse', 'Sazerac'])
    expect(opened.categories[0]!.samplesDirty).toBe(false)
  })
})

describe('Dual Experience setup defaults', () => {
  it('starts a new dual party with three rounds and reveals everything at the end', () => {
    const draft = withDualDefaults(emptyDraft())
    expect(draft.format).toBe('dual')
    expect(draft.categories.map((c) => c.name)).toEqual(['Rye Whiskey', 'Wheated Bourbon', 'Double Oaked'])
    expect(draft.settings.revealByCategory).toBe(false)
    expect(draft.dual.joinGroup).toBe('blind')
  })

  it('keeps rounds the host already picked', () => {
    const picked = { ...emptyDraft(), categories: [newDraftCategory({ libraryId: null, name: 'Mystery', description: '' })] }
    expect(withDualDefaults(picked).categories.map((c) => c.name)).toEqual(['Mystery'])
  })

  it('maps pairings from draft rounds to server ids and drops empty stations', () => {
    const draft = withDualDefaults(emptyDraft())
    draft.pairings = { [draft.categories[0]!.key]: { name: ' York Peppermint Patties ', note: '' }, [draft.categories[1]!.key]: { name: '  ', note: '' } }
    draft.stations = [{ name: 'Oak', description: ' Staves ', guidance: '' }, { name: ' ', description: '', guidance: '' }]
    const extras = extrasForServer(draft, draft.categories, ['c_rye', 'c_wheat', 'c_oak'])
    expect(extras.pairings).toEqual({ c_rye: { name: 'York Peppermint Patties', note: '' } })
    expect(extras.stations).toEqual([{ name: 'Oak', description: 'Staves', guidance: '' }])
  })

  it('rejects impossible planned group sizes', () => {
    const draft = { ...withDualDefaults(emptyDraft()), name: 'Dual', dual: { joinGroup: 'blind' as const, plannedGuided: 200, plannedBlind: 3 } }
    expect(draftProblems(draft).details).toContain('Planned group sizes must be between 0 and 150.')
  })
})
