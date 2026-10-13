import { describe, expect, it } from 'vitest'
import type { Bottle, Pour } from '../../../data/types'
import {
  computeCategoryCandidates,
  confidenceForSample,
  confidenceForTrend,
  daysBetween,
  formatCalendarDate,
  inputFingerprints,
  isCalendarDate,
  normalizeInput,
  reconcileInsights,
  type AxeInsightState,
  type InsightCandidate,
  type InsightInput,
} from '.'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let seq = 0
function pour(bottleId: string, date: string, rating: number, extra: Partial<Pour['fip']> = {}, id?: string): Pour {
  return {
    id: id ?? `p${++seq}`,
    bottleId,
    date,
    rating,
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.8, value: 0.8, total: rating, noseAromas: [], palateFlavors: [], ...extra },
  }
}

function bottle(id: string, name: string, extra: Partial<Bottle> = {}): Bottle {
  return { id, name, status: 'open', createdAt: 1, ...extra }
}

const TODAY = '2026-10-12'
const run = (input: Partial<InsightInput>) => computeCategoryCandidates({ bottles: [], pours: [], today: TODAY, ...input }, [
  'palate-evolution',
  'flavor-discovery',
  'collection-discovery',
  'bottle-rediscovery',
  'blind-discovery',
  'journey-milestone',
])

// Every number a candidate's copy states must be one of its own facts.
function expectCopyBackedByFacts(c: InsightCandidate) {
  const numbers = new Set<string>()
  for (const f of c.facts) {
    if (typeof f.value === 'number') {
      numbers.add(String(f.value))
      numbers.add(f.value.toFixed(1))
      numbers.add(String(Math.round(f.value)))
    } else {
      for (const n of f.value.match(/\d+(\.\d+)?/g) ?? []) numbers.add(n)
    }
  }
  const text = `${c.copy.headline} ${c.copy.body} ${c.copy.expanded ?? ''}`
  for (const n of text.match(/\d+(\.\d+)?/g) ?? []) {
    expect(numbers, `"${n}" in "${text}" is not a fact of ${c.id}`).toContain(n)
  }
}

// ---------------------------------------------------------------------------
// Normalization, dates, confidence
// ---------------------------------------------------------------------------

describe('input normalization and dates', () => {
  it('counts a pour once even if it appears twice, and drops invalid dates and ratings', () => {
    const p = pour('b1', '2026-09-01', 8)
    const n = normalizeInput({
      bottles: [],
      pours: [p, { ...p }, pour('b1', '2026-02-30', 8), pour('b1', 'yesterday', 8), pour('b1', '2026-09-02', 11), pour('b1', '2026-09-03', Number.NaN)],
      today: TODAY,
    })
    expect(n.pours.map((x) => x.id)).toEqual([p.id])
  })

  it('orders by tasting date (backdated entries land where they happened), not by save order', () => {
    const late = pour('b1', '2026-09-10', 8)
    const backdated = pour('b1', '2026-08-01', 7)
    expect(normalizeInput({ bottles: [], pours: [late, backdated], today: TODAY }).pours.map((p) => p.id)).toEqual([backdated.id, late.id])
  })

  it('validates real calendar dates and counts days across DST without drift', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true)
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isCalendarDate('2026-13-01')).toBe(false)
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2) // US DST starts Mar 8
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2) // ends Nov 1
    expect(formatCalendarDate('2026-08-01')).toBe('Aug 1, 2026')
  })

  it('assigns confidence from sample size only', () => {
    expect([1, 2, 3, 5, 6, 20].map(confidenceForSample)).toEqual(['descriptive', 'descriptive', 'tentative', 'tentative', 'established', 'established'])
    expect(confidenceForTrend(2, 10)).toBeUndefined()
    expect(confidenceForTrend(3, 3)).toBe('tentative')
    expect(confidenceForTrend(6, 8)).toBe('established')
  })
})

// ---------------------------------------------------------------------------
// Category A — Palate Evolution
// ---------------------------------------------------------------------------

describe('Palate Evolution', () => {
  const bottles = [
    bottle('low1', 'Buffalo Trace', { proof: 90, type: 'Bourbon' }),
    bottle('low2', 'Eagle Rare', { proof: 90, type: 'Bourbon' }),
    bottle('mid', 'Weller 107', { proof: 107, type: 'Bourbon' }),
    bottle('high1', 'Booker’s', { proof: 126, type: 'Bourbon' }),
    bottle('high2', 'Stagg', { proof: 130, type: 'Bourbon' }),
  ]

  it('reports a proof shift with exact averages and the pours behind each period', () => {
    const pours = [
      pour('low1', '2026-01-01', 8),
      pour('low2', '2026-01-02', 8),
      pour('mid', '2026-01-03', 8),
      pour('mid', '2026-05-01', 8),
      pour('high1', '2026-05-02', 8),
      pour('high2', '2026-05-03', 8),
    ]
    const c = run({ bottles, pours })['palate-evolution'].find((x) => x.kind === 'proof-shift')!
    expect(c.facts.find((f) => f.key === 'recentProof')?.value).toBe(121) // (107+126+130)/3
    expect(c.facts.find((f) => f.key === 'earlierProof')?.value).toBe(96) // (90+90+107)/3
    expect(c.evidence.pourIds).toEqual(pours.map((p) => p.id))
    expect(c.confidence).toBe('tentative')
    expect(c.copy.headline).toMatch(/exploring stronger pours/)
    // Pouring stronger isn't liking stronger: no preference claim without ratings behind it.
    expect(`${c.copy.body} ${c.copy.expanded}`).not.toMatch(/prefer|favorite|love/i)
    expect(c.facts.some((f) => f.key === 'bestProofRange')).toBe(false)
    expectCopyBackedByFacts(c)
  })

  it('adds a rating-backed proof preference only when ratings actually support it', () => {
    const pours = [
      pour('low1', '2026-01-01', 6.5),
      pour('low2', '2026-01-02', 6.8),
      pour('mid', '2026-01-03', 7),
      pour('mid', '2026-05-01', 7.2),
      pour('high1', '2026-05-02', 9),
      pour('high2', '2026-05-03', 9.2),
    ]
    const c = run({ bottles, pours })['palate-evolution'].find((x) => x.kind === 'proof-shift')!
    expect(c.facts.find((f) => f.key === 'bestProofRange')?.value).toBe('110+ proof')
    expect(c.facts.find((f) => f.key === 'bestProofRangeAverage')?.value).toBe(9.1)
    expectCopyBackedByFacts(c)
  })

  it('needs 3 pours in each period and ignores noise', () => {
    const five = [pour('low1', '2026-01-01', 8), pour('low2', '2026-01-02', 8), pour('high1', '2026-05-01', 8), pour('high2', '2026-05-02', 8), pour('high2', '2026-05-03', 8)]
    expect(run({ bottles, pours: five })['palate-evolution'].find((x) => x.kind === 'proof-shift')).toBeUndefined()
    const steady = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-05-01', '2026-05-02', '2026-05-03'].map((d) => pour('mid', d, 8))
    expect(run({ bottles, pours: steady })['palate-evolution']).toEqual([])
  })

  it('reports a rating shift from the same oldest-3 vs newest-3 as Your Palate', () => {
    const pours = ['2026-01-01', '2026-01-02', '2026-01-03'].map((d) => pour('mid', d, 7)).concat(
      ['2026-05-01', '2026-05-02', '2026-05-03'].map((d) => pour('mid', d, 8.5)),
    )
    const c = run({ bottles, pours })['palate-evolution'].find((x) => x.kind === 'rating-shift')!
    expect(c.facts.find((f) => f.key === 'recentAverage')?.value).toBe(8.5)
    expect(c.facts.find((f) => f.key === 'earlierAverage')?.value).toBe(7)
    expectCopyBackedByFacts(c)
  })

  it('claims a style preference only with two styles of 2+ rated pours each', () => {
    const styled = [
      bottle('r1', 'Rittenhouse', { type: 'Rye', proof: 100 }),
      bottle('r2', 'Pikesville', { type: 'Rye', proof: 110 }),
      bottle('bb', 'Maker’s Mark', { type: 'Bourbon', proof: 90 }),
    ]
    const onlyRye = [pour('r1', '2026-01-01', 9), pour('r2', '2026-01-02', 9), pour('r1', '2026-01-03', 9)]
    expect(run({ bottles: styled, pours: onlyRye })['palate-evolution'].find((x) => x.kind === 'style-preference')).toBeUndefined()

    const both = [...onlyRye, pour('bb', '2026-01-04', 7), pour('bb', '2026-01-05', 7.4)]
    const c = run({ bottles: styled, pours: both })['palate-evolution'].find((x) => x.kind === 'style-preference')!
    expect(c.facts.find((f) => f.key === 'style')?.value).toBe('Rye')
    expect(c.facts.find((f) => f.key === 'styleAverage')?.value).toBe(9)
    expect(c.facts.find((f) => f.key === 'otherStylesAverage')?.value).toBe(7.2)
    expect(c.confidence).toBe('tentative')
    expect(c.copy.headline).toMatch(/may be your style/)
    expectCopyBackedByFacts(c)

    // A near-tie between styles is not a preference.
    const tied = [...onlyRye, pour('bb', '2026-01-04', 8.8), pour('bb', '2026-01-05', 8.9)]
    expect(run({ bottles: styled, pours: tied })['palate-evolution'].find((x) => x.kind === 'style-preference')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Category B — Flavor Discovery
// ---------------------------------------------------------------------------

describe('Flavor Discovery', () => {
  it('counts flavors per bottle, not per pour, among 8.0+ pours only', () => {
    const bottles = [bottle('a', 'A'), bottle('b', 'B'), bottle('c', 'C'), bottle('d', 'D')]
    const pours = [
      // One loved bottle poured four times with Cherry: still one bottle.
      ...['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'].map((d) => pour('a', d, 9, { noseAromas: ['Cherry', 'Vanilla'] })),
      pour('b', '2026-02-01', 8.5, { palateFlavors: ['Vanilla'] }),
      // Free-text alias "vanilla bean" normalizes to Vanilla.
      pour('c', '2026-02-02', 8.2, { palateNotes: 'Big vanilla bean and baking spice' }),
      // Low-rated pours never count toward "favorites".
      pour('d', '2026-02-03', 6, { noseAromas: ['Cherry'] }),
    ]
    const c = run({ bottles, pours })['flavor-discovery'][0]!
    expect(c.facts.find((f) => f.key === 'flavor1')?.value).toBe('Vanilla')
    expect(c.facts.find((f) => f.key === 'flavor1Bottles')?.value).toBe(3)
    expect(c.facts.find((f) => f.key === 'topBottles')?.value).toBe(3)
    // Cherry appears on 1 high-rated bottle only, so it isn't a pattern.
    expect(c.facts.some((f) => f.value === 'Cherry')).toBe(false)
    expect(c.evidence.pourIds).not.toContain(pours[pours.length - 1]!.id)
    expect(c.copy.body).toBe('Vanilla appears in 3 of the 3 bottles you’ve rated 8.0 or higher.'.replace('’', "'"))
    expectCopyBackedByFacts(c)
  })

  it('stays silent without enough high-rated variety, and ignores bottle catalog notes', () => {
    const bottles = [bottle('a', 'A', { flavors: ['Vanilla'], notes: 'vanilla, caramel' }), bottle('b', 'B', { flavors: ['Vanilla'] })]
    const pours = [pour('a', '2026-01-01', 9), pour('a', '2026-01-02', 9), pour('b', '2026-01-03', 9)]
    expect(run({ bottles, pours })['flavor-discovery']).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Categories C and D — Collection and Rediscovery
// ---------------------------------------------------------------------------

describe('Collection Discovery and Bottle Rediscovery', () => {
  const rated = [
    bottle('r1', 'Rittenhouse', { type: 'Rye', proof: 100 }),
    bottle('r2', 'Pikesville', { type: 'Rye', proof: 110 }),
    bottle('bb', 'Maker’s Mark', { type: 'Bourbon', proof: 90 }),
  ]
  const ratedPours = [
    pour('r1', '2026-01-01', 9),
    pour('r2', '2026-01-02', 9),
    pour('r1', '2026-01-03', 9),
    pour('bb', '2026-01-04', 7),
    pour('bb', '2026-01-05', 7.4),
  ]

  it('suggests a sealed, unpoured bottle that matches a rating-backed preference', () => {
    const shelf = [
      ...rated,
      bottle('wish', 'Wishlist Rye', { type: 'Rye', status: 'wishlist' }),
      bottle('gone', 'Empty Rye', { type: 'Rye', status: 'sealed', quantity: 0 }),
      bottle('sealed', 'Sealed Rye', { type: 'Rye', status: 'sealed', proof: 95 }),
    ]
    const c = run({ bottles: shelf, pours: ratedPours })['collection-discovery'][0]!
    expect(c.subjectBottleIds).toEqual(['sealed'])
    expect(c.copy.body).toMatch(/still sealed/)
    expect(c.actions[0]).toEqual({ id: 'open-bottle', label: 'View Bottle', bottleId: 'sealed' })
    expectCopyBackedByFacts(c)
  })

  it('makes no collection suggestion from frequency alone', () => {
    const shelf = [bottle('a', 'A', { type: 'Rye' }), bottle('s', 'S', { type: 'Rye', status: 'sealed' })]
    expect(run({ bottles: shelf, pours: [pour('a', '2026-01-01', 9), pour('a', '2026-01-02', 9), pour('a', '2026-01-03', 9)] })['collection-discovery']).toEqual([])
  })

  it('offers a well-rated open bottle not poured in 60+ days, stating the date rather than a day count', () => {
    const shelf = [bottle('old', 'Old Favorite'), bottle('recent', 'Recent Favorite'), bottle('done', 'Finished', { status: 'finished' })]
    const pours = [pour('old', '2026-07-01', 8.8), pour('recent', '2026-10-01', 9), pour('done', '2026-01-01', 9.5)]
    const list = run({ bottles: shelf, pours })['bottle-rediscovery']
    expect(list.map((c) => c.subjectBottleIds[0])).toEqual(['old'])
    expect(list[0]!.copy.body).toBe('You rated it 8.8 when you poured it on Jul 1, 2026.')
    expect(list[0]!.confidence).toBe('descriptive')
    expectCopyBackedByFacts(list[0]!)
  })
})

// ---------------------------------------------------------------------------
// Categories E and F — Blind Room and Milestones
// ---------------------------------------------------------------------------

describe('Blind Room Discoveries', () => {
  const bottles = [bottle('a', 'Bottle A'), bottle('b', 'Bottle B')]
  const blind = (pours: { label: string; bottleId: string; bottleName: string; blindRank?: number; blindScore?: number }[]) => [
    { roomId: 'room1', roomName: 'Friday Flight', date: '2026-10-05', pours },
  ]

  it('calls out a blind preference that contradicts your sighted ratings', () => {
    const pours = [pour('a', '2026-01-01', 7.5), pour('b', '2026-01-02', 8.8)]
    const c = run({
      bottles,
      pours,
      blindTastings: blind([
        { label: 'A', bottleId: 'a', bottleName: 'Bottle A', blindRank: 1 },
        { label: 'B', bottleId: 'b', bottleName: 'Bottle B', blindRank: 2 },
      ]),
    })['blind-discovery'][0]!
    expect(c.copy.body).toBe('Blind, you preferred Bottle A over Bottle B, even though you’ve rated Bottle B higher (8.8 vs. 7.5).')
    expect(c.evidence.roomIds).toEqual(['room1'])
    expect(c.confidence).toBe('descriptive')
    expectCopyBackedByFacts(c)
  })

  it('stays quiet when a bottle has no sighted rating or the gap is small', () => {
    const blindPours = [
      { label: 'A', bottleId: 'a', bottleName: 'Bottle A', blindScore: 9 },
      { label: 'B', bottleId: 'b', bottleName: 'Bottle B', blindScore: 7 },
    ]
    expect(run({ bottles, pours: [pour('b', '2026-01-02', 8.8)], blindTastings: blind(blindPours) })['blind-discovery']).toEqual([])
    expect(run({ bottles, pours: [pour('a', '2026-01-01', 8.6), pour('b', '2026-01-02', 8.8)], blindTastings: blind(blindPours) })['blind-discovery']).toEqual([])
  })
})

describe('Journey Milestones', () => {
  it('marks a fresh first tasting, and stops once it is old news', () => {
    const bottles = [bottle('a', 'Eagle Rare')]
    expect(run({ bottles, pours: [pour('a', '2026-10-10', 8.4)] })['journey-milestone'][0]!.kind).toBe('first-tasting')
    expect(run({ bottles, pours: [pour('a', '2026-06-10', 8.4)] })['journey-milestone']).toEqual([])
  })

  it('notices a revisit with a very different rating', () => {
    const bottles = [bottle('a', 'Eagle Rare')]
    const c = run({ bottles, pours: [pour('a', '2026-08-01', 7), pour('a', '2026-10-10', 8.8)] })['journey-milestone'].find(
      (x) => x.kind === 'revisit-shift',
    )!
    expect(c.copy.headline).toBe('Eagle Rare opened up for you.')
    expectCopyBackedByFacts(c)
  })

  it('notices a flavor family your latest pour introduced', () => {
    const bottles = [bottle('a', 'A'), bottle('b', 'Laphroaig')]
    const pours = [
      pour('a', '2026-09-01', 8, { noseAromas: ['Caramel'] }),
      pour('a', '2026-09-02', 8, { noseAromas: ['Vanilla'] }),
      pour('b', '2026-10-10', 8, { noseAromas: ['Vanilla'], palateNotes: 'Campfire smoke and iodine' }),
    ]
    const c = run({ bottles, pours })['journey-milestone'].find((x) => x.kind === 'new-flavor-family')
    expect(c?.facts.find((f) => f.key === 'flavorFamily')?.value).toMatch(/Smoke/)
  })
})

// ---------------------------------------------------------------------------
// Reconcile: invalidation, idempotency, stability
// ---------------------------------------------------------------------------

describe('reconcileInsights', () => {
  const bottles = [
    bottle('r1', 'Rittenhouse', { type: 'Rye', proof: 100 }),
    bottle('r2', 'Pikesville', { type: 'Rye', proof: 110 }),
    bottle('bb', 'Maker’s Mark', { type: 'Bourbon', proof: 90 }),
  ]
  const basePours = [
    pour('r1', '2026-01-01', 9, { noseAromas: ['Baking Spice'] }, 'x1'),
    pour('r2', '2026-01-02', 9, { noseAromas: ['Baking Spice'] }, 'x2'),
    pour('r1', '2026-01-03', 9, { noseAromas: ['Baking Spice'] }, 'x3'),
    pour('bb', '2026-01-04', 7, {}, 'x4'),
    pour('bb', '2026-01-05', 7.4, {}, 'x5'),
  ]
  const input = (over: Partial<InsightInput> = {}): InsightInput => ({ bottles, pours: basePours, today: TODAY, ...over })
  const opts = { now: 1000, sourceRevision: 'r1' }

  function first(): AxeInsightState {
    const r = reconcileInsights(null, input(), opts)
    expect(r.changed).toBe(true)
    expect(r.state.selected).not.toBeNull()
    return r.state
  }

  it('is idempotent: the same event twice changes nothing the second time', () => {
    const s1 = first()
    const again = reconcileInsights(s1, input(), { now: 2000, sourceRevision: 'r2' })
    expect(again.changed).toBe(false)
    expect(again.recalculated).toEqual([])
    expect(again.state).toBe(s1)
  })

  it('does not recalculate anything for unrelated edits (photo, price, notes on a bottle)', () => {
    const s1 = first()
    const edited = bottles.map((b) => ({ ...b, imageUrl: 'https://x/y.jpg', price: 55, purchaseDate: '2026-01-01' }))
    const r = reconcileInsights(s1, input({ bottles: edited }), opts)
    expect(r.recalculated).toEqual([])
    expect(r.changed).toBe(false)
  })

  it('invalidates only the categories a change can affect', () => {
    const s1 = first()
    // Status change on a bottle: collection/rediscovery read status; palate and flavor don't.
    const r = reconcileInsights(s1, input({ bottles: bottles.map((b) => (b.id === 'bb' ? { ...b, status: 'finished' as const } : b)) }), opts)
    expect(r.recalculated.sort()).toEqual(['bottle-rediscovery', 'collection-discovery'])

    // A rating edit touches every category that reads pours.
    const edit = reconcileInsights(s1, input({ pours: basePours.map((p) => (p.id === 'x4' ? { ...p, rating: 7.1 } : p)) }), opts)
    expect(edit.recalculated).toEqual(expect.arrayContaining(['palate-evolution', 'flavor-discovery']))
  })

  it('keeps the current insight stable across unrelated recalculation and refreshes', () => {
    const s1 = first()
    const shown = s1.selected!.candidate.id
    const r = reconcileInsights(s1, input({ pours: [...basePours, pour('bb', '2025-12-01', 7.2, {}, 'old')] }), opts)
    expect(r.state.selected!.candidate.id).toBe(shown)
  })

  it('drops an insight whose supporting tasting was deleted', () => {
    const s1 = first()
    const shownCategory = s1.selected!.candidate.category
    expect(shownCategory).toBe('palate-evolution')
    // Delete a Maker's pour: only one Bourbon pour left, so the style comparison loses support.
    const r = reconcileInsights(s1, input({ pours: basePours.filter((p) => p.id !== 'x5') }), opts)
    expect(r.changed).toBe(true)
    expect(r.state.selected?.candidate.id).not.toBe(s1.selected!.candidate.id)
    expect(r.state.generation).toBe(s1.generation + 1)
  })

  it('switches to a genuinely new, higher-priority insight when one appears', () => {
    const s1 = first()
    const newMilestone = reconcileInsights(s1, input({ pours: [...basePours, pour('bb', TODAY, 9.2, {}, 'today')] }), opts)
    expect(newMilestone.state.selected!.candidate.kind).toBe('revisit-shift')
    expect(newMilestone.state.history[0]!.id).toBe(newMilestone.state.selected!.candidate.id)
  })

  it('gives a different insight on request, and holds back a just-shown bottle', () => {
    const s1 = first()
    const other = reconcileInsights(s1, input(), { ...opts, requestNew: true })
    expect(other.state.selected!.candidate.id).not.toBe(s1.selected!.candidate.id)
  })

  it('recomputes everything when the cached schema version is different', () => {
    const s1 = first()
    const r = reconcileInsights({ ...s1, schemaVersion: 0 }, input(), opts)
    expect(r.recalculated.length).toBe(6)
  })

  it('produces identical fingerprints for identical inputs, in any key order', () => {
    const a = inputFingerprints(input())
    const reordered = input({ bottles: bottles.map((b) => Object.fromEntries(Object.entries(b).reverse()) as unknown as Bottle) })
    expect(inputFingerprints(reordered)).toEqual(a)
  })

  it('never leaves Home empty because of repetition protection', () => {
    const s1 = first()
    // Every candidate was "just shown", and the current one has lost its support.
    const allIds = Object.values(s1.categories).flatMap((c) => c.candidates.map((x) => ({ id: x.id, bottleIds: x.subjectBottleIds, on: TODAY })))
    const cooled: AxeInsightState = { ...s1, history: allIds, selected: { ...s1.selected!, candidate: { ...s1.selected!.candidate, id: 'gone' } } }
    const r = reconcileInsights(cooled, input(), opts)
    expect(r.state.selected).not.toBeNull()
  })

  it('keeps the current insight when asked for another but nothing else is eligible', () => {
    const s1 = first()
    const allIds = Object.values(s1.categories).flatMap((c) => c.candidates.map((x) => ({ id: x.id, bottleIds: x.subjectBottleIds, on: TODAY })))
    const r = reconcileInsights({ ...s1, history: allIds }, input(), { ...opts, requestNew: true })
    expect(r.state.selected!.candidate.id).toBe(s1.selected!.candidate.id)
    expect(r.changed).toBe(false)
  })

  it('caps stored evidence ids while reporting the full sample size', () => {
    const many = Array.from({ length: 60 }, (_, i) => pour(i % 2 ? 'r1' : 'r2', `2026-0${1 + Math.floor(i / 20)}-${String((i % 20) + 1).padStart(2, '0')}`, 9, {}, `m${i}`))
    const lots = [...many, pour('bb', '2026-05-01', 7, {}, 'b1'), pour('bb', '2026-05-02', 7, {}, 'b2')]
    const c = computeCategoryCandidates({ bottles, pours: lots, today: TODAY }, ['palate-evolution'])['palate-evolution'].find(
      (x) => x.kind === 'style-preference',
    )!
    expect(c.evidence.pourIds.length).toBe(40)
    expect(c.sampleSize).toBe(62)
    expect(c.evidence.pourIds).toContain('m59') // keeps the most recent
  })
})

