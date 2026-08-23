import { describe, expect, it } from 'vitest'
import type { Bottle, Memory, Pour } from '../../data/types'
import {
  buildBottleStoryEvents,
  buildRatingProgression,
  buildScoreEvolution,
  currentScoreDate,
  distilleryLocation,
  fillLevelPercent,
  getCurrentScore,
  getFinishedDate,
  getMemoriesForBottle,
  getPoursForBottle,
  mashBillSummary,
  parseLocalDate,
  pourHistorySummary,
} from './selectors'

function pour(overrides: Partial<Pour> & Pick<Pour, 'id' | 'bottleId' | 'date' | 'rating'>): Pour {
  return {
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: overrides.rating, noseAromas: [], palateFlavors: [] },
    ...overrides,
  }
}

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: new Date('2026-05-03').getTime() }

describe('mashBillSummary', () => {
  it('joins only the mash bill fields that are present', () => {
    expect(mashBillSummary({ ...bottle, mashBillCorn: 75, mashBillRyeWheat: 13 })).toBe('75% Corn / 13% Rye/Wheat')
  })

  it('returns undefined when no mash bill fields are set', () => {
    expect(mashBillSummary(bottle)).toBeUndefined()
  })
})

describe('getPoursForBottle / getCurrentScore', () => {
  const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 }), pour({ id: 'p2', bottleId: 'b1', date: '2026-06-08', rating: 9.2 })]

  it('filters to the bottle and sorts newest-first', () => {
    expect(getPoursForBottle(pours, 'b1').map((p) => p.id)).toEqual(['p2', 'p1'])
  })

  it('current score is the latest pour rating, falling back to bottle.rating', () => {
    expect(getCurrentScore(bottle, pours)).toBe(9.2)
    expect(getCurrentScore({ ...bottle, rating: 7.5 }, [])).toBe(7.5)
  })
})

describe('currentScoreDate', () => {
  const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 }), pour({ id: 'p2', bottleId: 'b1', date: '2026-06-08', rating: 9.2 })]

  it('is the latest pour’s date when a pour backs the current score', () => {
    expect(currentScoreDate(bottle, pours)).toBe('2026-06-08')
  })

  it('is undefined when the score comes from bottle.rating with no real pour behind it', () => {
    expect(currentScoreDate({ ...bottle, rating: 7.5 }, [])).toBeUndefined()
  })
})

describe('pourHistorySummary', () => {
  it('is all-undefined with a zero count when the bottle has no pours', () => {
    expect(pourHistorySummary(bottle, [])).toEqual({ pourCount: 0 })
  })

  it('reports first/last poured dates and a real count across multiple pours', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 }),
      pour({ id: 'p2', bottleId: 'b1', date: '2026-06-08', rating: 9.2 }),
      pour({ id: 'p3', bottleId: 'b1', date: '2026-04-01', rating: 8.0 }),
    ]
    expect(pourHistorySummary(bottle, pours)).toEqual({ firstPouredDate: '2026-04-01', lastPouredDate: '2026-06-08', pourCount: 3 })
  })

  it('reports the same date for first and last with only one pour', () => {
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 })]
    expect(pourHistorySummary(bottle, pours)).toEqual({ firstPouredDate: '2026-05-17', lastPouredDate: '2026-05-17', pourCount: 1 })
  })
})

describe('fillLevelPercent', () => {
  it('maps every real fill level to its natural percentage', () => {
    expect(fillLevelPercent({ ...bottle, fillLevel: 'full' })).toBe(100)
    expect(fillLevelPercent({ ...bottle, fillLevel: 'three-quarter' })).toBe(75)
    expect(fillLevelPercent({ ...bottle, fillLevel: 'half' })).toBe(50)
    expect(fillLevelPercent({ ...bottle, fillLevel: 'quarter' })).toBe(25)
    expect(fillLevelPercent({ ...bottle, fillLevel: 'empty' })).toBe(0)
  })

  it('is undefined when no fill level has been set', () => {
    expect(fillLevelPercent(bottle)).toBeUndefined()
  })
})

describe('parseLocalDate', () => {
  it('reads the exact year/month/day as a local date, immune to UTC-parsing day-shift', () => {
    const d = parseLocalDate('2026-06-14')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(14)
  })
})

describe('distilleryLocation', () => {
  it('resolves a city + state from the verified static distillery database', () => {
    expect(distilleryLocation({ ...bottle, distillery: 'Buffalo Trace Distillery' })).toBe('Frankfort, Kentucky')
  })

  it('resolves the same location from a known alias', () => {
    expect(distilleryLocation({ ...bottle, distillery: 'BT' })).toBe('Frankfort, Kentucky')
  })

  it('falls back to the bottle’s own region when the distillery is not in the database', () => {
    expect(distilleryLocation({ ...bottle, distillery: 'Some Unlisted Craft Distillery', region: 'Texas' })).toBe('Texas')
  })

  it('is undefined when neither a resolvable distillery nor a region is present', () => {
    expect(distilleryLocation(bottle)).toBeUndefined()
  })
})

describe('getFinishedDate', () => {
  it('returns undefined for a bottle that is not finished', () => {
    expect(getFinishedDate({ ...bottle, status: 'open' }, [])).toBeUndefined()
  })

  it('uses the real finishedDate when present', () => {
    const finished: Bottle = { ...bottle, status: 'finished', finishedDate: '2026-08-08' }
    expect(getFinishedDate(finished, [])).toEqual({ date: '2026-08-08', inferred: false })
  })

  it('falls back to the latest real pour date for a legacy finished bottle', () => {
    const finished: Bottle = { ...bottle, status: 'finished', openedDate: '2026-05-17' }
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 }), pour({ id: 'p2', bottleId: 'b1', date: '2026-08-04', rating: 9.1 })]
    expect(getFinishedDate(finished, pours)).toEqual({ date: '2026-08-04', inferred: true })
  })

  it('falls back to openedDate when there are no pours', () => {
    const finished: Bottle = { ...bottle, status: 'finished', openedDate: '2026-05-17' }
    expect(getFinishedDate(finished, [])).toEqual({ date: '2026-05-17', inferred: true })
  })

  it('falls back to createdAt when there are no pours or openedDate', () => {
    const finished: Bottle = { ...bottle, status: 'finished' }
    expect(getFinishedDate(finished, [])).toEqual({ date: new Date(bottle.createdAt!).toISOString(), inferred: true })
  })

  it('never writes an inferred date back onto the bottle object', () => {
    const finished: Bottle = { ...bottle, status: 'finished', openedDate: '2026-05-17' }
    getFinishedDate(finished, [])
    expect(finished.finishedDate).toBeUndefined()
  })
})

describe('getMemoriesForBottle', () => {
  const memories: Memory[] = [
    { id: 'm1', title: 'Dad visit', date: '2026-06-01', people: ['Dad'], bottleId: 'b1', story: 'A good night.' },
    { id: 'm2', title: 'Unrelated', date: '2026-06-02', people: [], bottleId: 'b2', story: 'Different bottle.' },
    { id: 'm3', title: 'No bottle', date: '2026-06-03', people: [], story: 'Not linked to any bottle.' },
  ]

  it('returns only memories linked to this bottle', () => {
    const result = getMemoriesForBottle(memories, 'b1')
    expect(result.map((m) => m.id)).toEqual(['m1'])
  })

  it('excludes unrelated and unlinked memories', () => {
    expect(getMemoriesForBottle(memories, 'b1').some((m) => m.id === 'm2' || m.id === 'm3')).toBe(false)
  })
})

describe('buildBottleStoryEvents — lifecycle events', () => {
  it('includes Added and Opened when those fields exist', () => {
    const opened: Bottle = { ...bottle, openedDate: '2026-05-17' }
    const story = buildBottleStoryEvents(opened, [], [])
    expect(story.events.map((e) => e.label)).toEqual(['Added to your bar', 'Opened'])
  })

  it('includes an inferred Bottle Finished event for a legacy finished bottle', () => {
    const finished: Bottle = { ...bottle, status: 'finished', openedDate: '2026-05-17' }
    const story = buildBottleStoryEvents(finished, [], [])
    const finishedEvent = story.events.find((e) => e.id === 'finished')
    expect(finishedEvent?.inferredDate).toBe(true)
    expect(finishedEvent?.date).toBe('2026-05-17')
  })

  it('marks a real finishedDate as not inferred', () => {
    const finished: Bottle = { ...bottle, status: 'finished', finishedDate: '2026-08-08' }
    const story = buildBottleStoryEvents(finished, [], [])
    expect(story.events.find((e) => e.id === 'finished')?.inferredDate).toBe(false)
  })
})

describe('buildBottleStoryEvents — milestone tagging', () => {
  it('tags a single pour First Pour only, never also Highest Rated or Most Recent', () => {
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 })]
    const story = buildBottleStoryEvents(bottle, pours, [])
    const pourEvent = story.events.find((e) => e.pourId === 'p1')
    expect(pourEvent?.tags).toEqual(['First Pour'])
  })

  it('resolves a tie in Highest Rated to the earliest occurrence', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 9.0 }),
      pour({ id: 'p2', bottleId: 'b1', date: '2026-06-08', rating: 9.5 }),
      pour({ id: 'p3', bottleId: 'b1', date: '2026-07-01', rating: 9.5 }),
      pour({ id: 'p4', bottleId: 'b1', date: '2026-08-04', rating: 8.0 }),
    ]
    const story = buildBottleStoryEvents(bottle, pours, [])
    const byPourId = Object.fromEntries(story.events.filter((e) => e.pourId).map((e) => [e.pourId, e.tags]))
    expect(byPourId.p1).toEqual(['First Pour'])
    expect(byPourId.p2).toEqual(['Highest Rated']) // earlier of the 9.5 tie
    expect(byPourId.p3).toBeUndefined() // later 9.5 tie — no positional tag
    expect(byPourId.p4).toEqual(['Most Recent'])
  })

  it('adds a Shared Pour tag only when companion data is real, alongside any positional tag', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6, companion: 'Dad' }), // First Pour + Shared
      pour({ id: 'p2', bottleId: 'b1', date: '2026-06-08', rating: 9.2 }), // Highest Rated
      pour({ id: 'p3', bottleId: 'b1', date: '2026-07-04', rating: 8.9, companion: 'Dorcas' }), // no positional tag — Shared only
      pour({ id: 'p4', bottleId: 'b1', date: '2026-08-01', rating: 8.7 }), // Most Recent
    ]
    const story = buildBottleStoryEvents(bottle, pours, [])
    const byPourId = Object.fromEntries(story.events.filter((e) => e.pourId).map((e) => [e.pourId, e.tags]))
    expect(byPourId.p1).toEqual(['First Pour', 'Shared Pour'])
    expect(byPourId.p2).toEqual(['Highest Rated'])
    expect(byPourId.p3).toEqual(['Shared Pour']) // no positional tag, but real companion data earns Shared alone
    expect(byPourId.p4).toEqual(['Most Recent'])
  })
})

describe('buildBottleStoryEvents — memories', () => {
  it('includes a bottle-linked memory with its photo, dated in context', () => {
    const memories: Memory[] = [
      { id: 'm1', title: 'Porch night', date: '2026-06-15', people: ['Dad'], bottleId: 'b1', story: 'Great evening.', photoUrl: 'https://x/photo.jpg' },
    ]
    const story = buildBottleStoryEvents(bottle, [], memories)
    const memoryEvent = story.events.find((e) => e.memoryId === 'm1')
    expect(memoryEvent).toMatchObject({ label: 'Porch night', detail: 'Great evening.', photoUrl: 'https://x/photo.jpg', date: '2026-06-15' })
  })

  it('excludes memories linked to a different bottle', () => {
    const memories: Memory[] = [{ id: 'm2', title: 'Elsewhere', date: '2026-06-15', people: [], bottleId: 'other-bottle', story: 'Not this one.' }]
    const story = buildBottleStoryEvents(bottle, [], memories)
    expect(story.events.some((e) => e.memoryId === 'm2')).toBe(false)
  })
})

describe('buildBottleStoryEvents — gallery photos', () => {
  it('never turns undated gallery photos into timeline events', () => {
    const withGallery: Bottle = { ...bottle, gallery: [{ url: 'https://x/gallery-1.jpg' }, { url: 'https://x/gallery-2.jpg', caption: 'Nice label' }] }
    const story = buildBottleStoryEvents(withGallery, [], [])
    expect(story.events.every((e) => e.photoUrl !== 'https://x/gallery-1.jpg' && e.photoUrl !== 'https://x/gallery-2.jpg')).toBe(true)
  })
})

describe('buildRatingProgression', () => {
  it('returns undefined for 0 or 1 pours', () => {
    expect(buildRatingProgression([])).toBeUndefined()
    expect(buildRatingProgression([pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 })])).toBeUndefined()
  })

  it('shows the full sequence for up to 6 pours', () => {
    const pours = [8.2, 8.5, 8.8, 9.1].map((rating, i) => pour({ id: `p${i}`, bottleId: 'b1', date: `2026-0${i + 1}-01`, rating }))
    expect(buildRatingProgression(pours)).toBe('8.2 → 8.5 → 8.8 → 9.1')
  })

  it('truncates to first and last only beyond 6 pours', () => {
    const ratings = [7.0, 7.5, 8.0, 8.2, 8.4, 8.6, 9.0]
    const pours = ratings.map((rating, i) => pour({ id: `p${i}`, bottleId: 'b1', date: `2026-0${i + 1}-01`, rating }))
    expect(buildRatingProgression(pours)).toBe('7.0 → … → 9.0')
  })
})

describe('buildScoreEvolution', () => {
  it('returns undefined for 0 or 1 pours — nothing to evolve yet', () => {
    expect(buildScoreEvolution(bottle, [])).toBeUndefined()
    expect(buildScoreEvolution(bottle, [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 })])).toBeUndefined()
  })

  it('labels the first real pour Neck Pour and numbers the rest for an open bottle', () => {
    const pours = [8.2, 8.5, 8.8].map((rating, i) => pour({ id: `p${i}`, bottleId: 'b1', date: `2026-0${i + 1}-01`, rating }))
    const evolution = buildScoreEvolution({ ...bottle, status: 'open' }, pours)
    expect(evolution?.points.map((p) => p.label)).toEqual(['Neck Pour', 'Pour 2', 'Pour 3'])
    expect(evolution?.points.map((p) => p.score)).toEqual([8.2, 8.5, 8.8])
    expect(evolution?.truncated).toBe(false)
  })

  it('labels the last pour Bottle Kill only when the bottle is finished', () => {
    const pours = [8.2, 8.5, 8.8].map((rating, i) => pour({ id: `p${i}`, bottleId: 'b1', date: `2026-0${i + 1}-01`, rating }))
    const finished = buildScoreEvolution({ ...bottle, status: 'finished' }, pours)
    expect(finished?.points.map((p) => p.label)).toEqual(['Neck Pour', 'Pour 2', 'Bottle Kill'])

    const stillOpen = buildScoreEvolution({ ...bottle, status: 'open' }, pours)
    expect(stillOpen?.points.map((p) => p.label)).not.toContain('Bottle Kill')
  })

  it('truncates to first and last only beyond 6 pours, same discipline as buildRatingProgression', () => {
    const ratings = [7.0, 7.5, 8.0, 8.2, 8.4, 8.6, 9.0]
    const pours = ratings.map((rating, i) => pour({ id: `p${i}`, bottleId: 'b1', date: `2026-0${i + 1}-01`, rating }))
    const evolution = buildScoreEvolution({ ...bottle, status: 'finished' }, pours)
    expect(evolution?.truncated).toBe(true)
    expect(evolution?.points.map((p) => p.label)).toEqual(['Neck Pour', 'Bottle Kill'])
    expect(evolution?.points.map((p) => p.score)).toEqual([7.0, 9.0])
  })
})

describe('buildBottleStoryEvents — long-history curation', () => {
  function manyPours(): Pour[] {
    return [
      pour({ id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 8.0 }), // First Pour
      pour({ id: 'p2', bottleId: 'b1', date: '2026-01-10', rating: 8.2, companion: 'Mike' }), // routine + shared, gets curated out
      pour({ id: 'p3', bottleId: 'b1', date: '2026-01-20', rating: 9.6 }), // Highest Rated
      pour({ id: 'p4', bottleId: 'b1', date: '2026-02-01', rating: 8.1 }), // routine
      pour({ id: 'p5', bottleId: 'b1', date: '2026-02-10', rating: 8.3 }), // routine
      pour({ id: 'p6', bottleId: 'b1', date: '2026-02-20', rating: 8.4 }), // routine
      pour({ id: 'p7', bottleId: 'b1', date: '2026-03-01', rating: 8.5 }), // Most Recent
    ]
  }

  it('curates out routine pours (including a merely-shared one) once past the threshold', () => {
    const story = buildBottleStoryEvents(bottle, manyPours(), [])
    expect(story.curated).toBe(true)
    expect(story.totalPourCount).toBe(7)
    const pourIds = story.events.filter((e) => e.pourId).map((e) => e.pourId)
    expect(pourIds).toEqual(['p1', 'p3', 'p7'])
  })

  it('does not curate at or below the threshold', () => {
    const pours = manyPours().slice(0, 6)
    const story = buildBottleStoryEvents(bottle, pours, [])
    expect(story.curated).toBe(false)
    expect(story.events.filter((e) => e.pourId)).toHaveLength(6)
  })
})
