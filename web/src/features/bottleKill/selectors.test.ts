import { describe, expect, it } from 'vitest'
import { buildBottleKillSummary, formatSpan } from './selectors'
import type { Bottle, Pour } from '../../data/types'

const bottle: Bottle = {
  id: 'b1',
  name: 'Weller Antique 107',
  status: 'open',
  openedDate: '2026-04-14',
}

function pour(overrides: Partial<Pour>): Pour {
  return {
    id: 'p',
    bottleId: 'b1',
    date: '2026-05-01',
    rating: 8.0,
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.8, value: 0.7, total: 8.0, noseAromas: [], palateFlavors: [] },
    ...overrides,
  }
}

describe('formatSpan', () => {
  it('reports same-day and single-day spans in words', () => {
    expect(formatSpan('2026-08-14', '2026-08-14')).toBe('the same day')
    expect(formatSpan('2026-08-13', '2026-08-14')).toBe('1 day')
  })

  it('reports short spans in days', () => {
    expect(formatSpan('2026-08-01', '2026-08-08')).toBe('7 days')
  })

  it('reports medium spans in weeks', () => {
    expect(formatSpan('2026-07-01', '2026-07-22')).toBe('3 weeks')
  })

  it('reports long spans in months', () => {
    expect(formatSpan('2026-01-01', '2026-08-14')).toBe('7 months')
  })
})

describe('buildBottleKillSummary', () => {
  it('reflects real pour count, final score (latest pour), and span from openedDate to today', () => {
    const pours = [pour({ id: 'p1', date: '2026-04-20', rating: 7.5 }), pour({ id: 'p2', date: '2026-08-10', rating: 9.2 })]

    const summary = buildBottleKillSummary(bottle, pours, '2026-08-14')

    expect(summary.pourCount).toBe(2)
    expect(summary.finalScore).toBe(9.2)
    expect(summary.spanText).toBe('4 months')
  })

  it('falls back to bottle.rating for final score when there are no pours', () => {
    const summary = buildBottleKillSummary({ ...bottle, rating: 8.8 }, [], '2026-08-14')

    expect(summary.finalScore).toBe(8.8)
    expect(summary.pourCount).toBe(0)
  })

  it('leaves finalScore undefined rather than fabricating one when there is truly no data', () => {
    const summary = buildBottleKillSummary(bottle, [], '2026-08-14')
    expect(summary.finalScore).toBeUndefined()
  })

  it('omits spanText when the bottle has no openedDate', () => {
    const summary = buildBottleKillSummary({ ...bottle, openedDate: undefined }, [], '2026-08-14')
    expect(summary.spanText).toBeUndefined()
  })

  it('takes the buyAgain answer from the most recent pour', () => {
    const pours = [
      pour({ id: 'p1', date: '2026-04-20', buyAgain: 'maybe' }),
      pour({ id: 'p2', date: '2026-08-10', buyAgain: 'absolutely' }),
    ]

    const summary = buildBottleKillSummary(bottle, pours, '2026-08-14')

    expect(summary.buyAgainLabel).toBe('Absolutely')
  })

  it('leaves buyAgainLabel undefined when no pour ever answered it', () => {
    const summary = buildBottleKillSummary(bottle, [pour({})], '2026-08-14')
    expect(summary.buyAgainLabel).toBeUndefined()
  })
})
