import { describe, expect, it } from 'vitest'
import type { Bottle, Pour } from '../../../data/types'
import {
  buildExplanationPayload,
  computeCategoryCandidates,
  deterministicExplanation,
  parseExplanationJson,
  validateExplanation,
  type InsightCandidate,
} from '.'

function pour(id: string, bottleId: string, date: string, rating: number): Pour {
  return { id, bottleId, date, rating, fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.8, value: 0.8, total: rating, noseAromas: [], palateFlavors: [] } }
}

const bottles: Bottle[] = [
  { id: 'r1', name: 'Rittenhouse', status: 'open', type: 'Rye', proof: 100, createdAt: 1 },
  { id: 'r2', name: 'Pikesville', status: 'open', type: 'Rye', proof: 110, createdAt: 1 },
  { id: 'bb', name: 'Maker’s Mark', status: 'open', type: 'Bourbon', proof: 90, createdAt: 1 },
  { id: 'x', name: 'Pappy Van Winkle 15', status: 'sealed', type: 'Bourbon', proof: 107, createdAt: 1 },
]
const pours = [
  pour('x1', 'r1', '2026-01-01', 9),
  pour('x2', 'r2', '2026-01-02', 9),
  pour('x3', 'r1', '2026-01-03', 9),
  pour('x4', 'bb', '2026-01-04', 7),
  pour('x5', 'bb', '2026-01-05', 7.4),
]
const style = computeCategoryCandidates({ bottles, pours, today: '2026-10-12' }, ['palate-evolution'])['palate-evolution'].find(
  (c) => c.kind === 'style-preference',
)!

// A proof shift with no rating-backed preference behind it.
const proofBottles: Bottle[] = [
  { id: 'l1', name: 'Buffalo Trace', status: 'open', proof: 90, createdAt: 1 },
  { id: 'l2', name: 'Eagle Rare', status: 'open', proof: 90, createdAt: 1 },
  { id: 'h1', name: 'Booker’s', status: 'open', proof: 126, createdAt: 1 },
  { id: 'h2', name: 'Stagg', status: 'open', proof: 130, createdAt: 1 },
]
const proofShift = computeCategoryCandidates(
  {
    bottles: proofBottles,
    pours: [pour('a', 'l1', '2026-01-01', 8), pour('b', 'l2', '2026-01-02', 8), pour('c', 'l1', '2026-01-03', 8), pour('d', 'h1', '2026-05-01', 8), pour('e', 'h2', '2026-05-02', 8), pour('f', 'h1', '2026-05-03', 8)],
    today: '2026-10-12',
  },
  ['palate-evolution'],
)['palate-evolution'].find((c) => c.kind === 'proof-shift')!

const ctx = (candidate: InsightCandidate) => ({
  collectionBottleNames: [...bottles, ...proofBottles].map((b) => b.name),
  insightBottleNames: candidate === style ? ['Rittenhouse', 'Pikesville'] : ['Buffalo Trace', 'Eagle Rare', 'Booker’s', 'Stagg'],
})

const good = {
  headline: 'Rye keeps earning your best scores.',
  body: 'Your 3 Rye pours average 9.0, a clear step above the 7.2 you give everything else. Rittenhouse and Pikesville are doing the heavy lifting.',
  factKeys: ['style', 'styleAverage', 'stylePours', 'otherStylesAverage'],
  actionId: 'open-palate',
}

function check(raw: unknown, candidate: InsightCandidate = style) {
  return validateExplanation(raw, candidate, ctx(candidate))
}

describe('validateExplanation', () => {
  it('accepts a natural rephrasing that sticks to the verified facts', () => {
    const r = check(good)
    expect(r.ok).toBe(true)
  })

  it('rejects hallucinated statistics', () => {
    expect(check({ ...good, body: 'Your 4 Rye pours average 9.0.' })).toEqual({ ok: false, reasons: ['unsupported-number'] })
    expect(check({ ...good, body: 'Your Rye pours average 9.4.' })).toEqual({ ok: false, reasons: ['unsupported-number'] })
    expect(check({ ...good, body: 'Rye wins in 80% of your tastings.' }).ok).toBe(false)
    expect(check({ ...good, body: 'Seven of your Rye pours scored 9.0.' })).toEqual({ ok: false, reasons: ['unsupported-quantity'] })
    expect(check({ ...good, body: 'Your 7 Rye pours average 9.0.' })).toEqual({ ok: false, reasons: ['unsupported-number'] }) // 7.2 is not 7
    expect(check({ ...good, body: 'Half of your pours are Rye, averaging 9.0.' })).toEqual({ ok: false, reasons: ['unsupported-quantity'] })
  })

  it('allows numbers written as words only when they match a fact', () => {
    expect(check({ ...good, body: 'Your three Rye pours average 9.0.' }).ok).toBe(true)
  })

  it('rejects invalid structured output', () => {
    expect(check(parseExplanationJson('Sure! Rye is great.'))).toEqual({ ok: false, reasons: ['not-json'] })
    expect(check(parseExplanationJson('{"headline": "x", '))).toEqual({ ok: false, reasons: ['not-json'] })
    expect(check([good])).toEqual({ ok: false, reasons: ['bad-shape'] })
    expect(check({ ...good, body: '' })).toEqual({ ok: false, reasons: ['bad-shape'] })
    expect(check({ ...good, factKeys: 'style' })).toEqual({ ok: false, reasons: ['bad-shape'] })
    expect(check({ ...good, factKeys: [] })).toEqual({ ok: false, reasons: ['bad-shape'] })
    expect(check({ ...good, factKeys: ['style', 'madeUpKey'] })).toEqual({ ok: false, reasons: ['unknown-fact-key'] })
    expect(check({ ...good, headline: 'x'.repeat(101) })).toEqual({ ok: false, reasons: ['too-long'] })
  })

  it('parses JSON wrapped in a code fence or chatter', () => {
    const r = check(parseExplanationJson('Here you go:\n```json\n' + JSON.stringify(good) + '\n```'))
    expect(r.ok).toBe(true)
  })

  it('rejects actions the insight does not allow (no record changes, no new actions)', () => {
    expect(check({ ...good, actionId: 'log-pour' })).toEqual({ ok: false, reasons: ['disallowed-action'] })
    expect(check({ ...good, actionId: 'delete-bottle' })).toEqual({ ok: false, reasons: ['disallowed-action'] })
  })

  it('rejects claims that AXE changed anything', () => {
    expect(check({ ...good, body: `${good.body} I've logged this for you.` })).toEqual({ ok: false, reasons: ['claims-edit'] })
    expect(check({ ...good, body: `${good.body} AXE updated your ratings.` })).toEqual({ ok: false, reasons: ['claims-edit'] })
  })

  it('rejects bottles from the collection that are not part of the insight', () => {
    const pappy = check({ ...good, body: `${good.body} Pappy Van Winkle 15 would fit right in.` })
    expect(pappy.ok === false && pappy.reasons).toContain('unsupported-bottle')
    expect(check({ ...good, body: `${good.body} So does Maker’s Mark.` })).toEqual({ ok: false, reasons: ['unsupported-bottle'] })
  })

  it('rejects preference claims the evidence does not support', () => {
    const proofGood = {
      headline: 'You’ve been reaching for stronger pours.',
      body: 'Lately you’re averaging 127 proof, up from 90 earlier on.',
      factKeys: ['recentProof', 'earlierProof'],
    }
    expect(check(proofGood, proofShift)).toEqual({ ok: true, explanation: expect.anything() })
    expect(check({ ...proofGood, body: 'You prefer high proof now: 127, up from 90.' }, proofShift)).toEqual({
      ok: false,
      reasons: ['unsupported-preference'],
    })
    expect(check({ ...proofGood, body: 'Barrel proof is your go-to: 127, up from 90.' }, proofShift).ok).toBe(false)
    // A rating-backed style preference may say so.
    expect(check({ ...good, headline: 'Rye is your preference, and the scores show it.' }).ok).toBe(true)
  })

  it('rejects certainty the sample size does not support', () => {
    expect(style.confidence).toBe('tentative')
    expect(check({ ...good, headline: 'You always rate Rye higher.' })).toEqual({ ok: false, reasons: ['overstated-certainty'] })
    expect(check({ ...good, headline: 'Rye is definitely your style.' })).toEqual({ ok: false, reasons: ['overstated-certainty'] })
  })
})

describe('explanation payload and fallback', () => {
  it('sends the model only the verified facts, allowed actions and bottle names', () => {
    const payload = buildExplanationPayload(style, ['Rittenhouse', 'Pikesville'])
    expect(Object.keys(payload).sort()).toEqual(['allowedActions', 'bottles', 'category', 'confidence', 'facts', 'kind', 'period', 'reference', 'sampleSize'])
    expect(JSON.stringify(payload)).not.toMatch(/x1|x2|pourIds|uid/)
    expect(payload.allowedActions).toEqual([{ id: 'open-palate', label: 'Explore Your Palate' }])
  })

  it('falls back to the engine copy, which needs no AI', () => {
    expect(deterministicExplanation(style)).toMatchObject({ headline: style.copy.headline, body: style.copy.body, actionId: 'open-palate' })
  })
})
