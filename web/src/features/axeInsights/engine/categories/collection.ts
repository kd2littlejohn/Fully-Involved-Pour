import type { Bottle } from '../../../../data/types'
import { bucketForProof } from '../../../yourPalate/selectors'
import { supportedProofAffinity, supportedStyleAffinity } from '../affinity'
import { CATEGORY_WEIGHT, CONFIDENCE_WEIGHT, REDISCOVERY_MIN_DAYS, REDISCOVERY_MIN_RATING } from '../config'
import { average, confidenceForSample, daysBetween, formatCalendarDate, round1, type NormalizedInput } from '../normalize'
import type { InsightCandidate } from '../types'

// Category C — Collection Discovery: an unopened bottle you already own
// that lines up with a preference your ratings support (style or proof
// range, from Your Palate's affinity selectors). Only status 'sealed'
// counts: wishlist and incoming bottles aren't on your shelf yet, and a
// sealed bottle is described as waiting, never as tonight's pour.
//
// Category D — Bottle Rediscovery: an open bottle you rated well and
// haven't poured in a while. Offered as a reminder, never a nudge to drink
// more, and the same bottle is held back for a while after being shown
// (see SURFACE_COOLDOWN_DAYS in select.ts).

function isOnShelf(bottle: Bottle): boolean {
  return bottle.quantity === undefined || bottle.quantity > 0
}

export function collectionDiscoveryCandidates(input: NormalizedInput): InsightCandidate[] {
  const { bottles, pours, bottleById } = input
  const style = supportedStyleAffinity(input)
  const proofAffinity = supportedProofAffinity(input)
  if (!style && !proofAffinity) return []

  const poured = new Set(pours.map((p) => p.bottleId))
  const matches = bottles
    .filter((b) => b.status === 'sealed' && isOnShelf(b) && !poured.has(b.id))
    .map((b) => {
      const styleMatch = Boolean(style && b.type?.trim() === style.category)
      const proofMatch = Boolean(proofAffinity && typeof b.proof === 'number' && bucketForProof(b.proof) === proofAffinity.bucketLabel)
      return { bottle: b, styleMatch, proofMatch, score: Number(styleMatch) + Number(proofMatch) }
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.bottle.name.localeCompare(b.bottle.name) || a.bottle.id.localeCompare(b.bottle.id))

  const best = matches[0]
  if (!best) return []

  // Evidence for the preference: the rated pours behind each matched signal.
  const evidencePours = pours.filter((p) => {
    const b = bottleById.get(p.bottleId)
    if (!b) return false
    return (
      (best.styleMatch && b.type?.trim() === style?.category) ||
      (best.proofMatch && typeof b.proof === 'number' && bucketForProof(b.proof) === proofAffinity?.bucketLabel)
    )
  })
  const confidence = confidenceForSample(evidencePours.length)
  if (confidence === 'descriptive') return []

  const reasons: string[] = []
  const facts: InsightCandidate['facts'] = [{ key: 'bottleName', label: 'Bottle', value: best.bottle.name }]
  if (best.styleMatch && style) {
    reasons.push(`your ${style.category} pours average ${style.averageRating.toFixed(1)}, compared with ${style.othersAverage.toFixed(1)} for other styles`)
    facts.push(
      { key: 'style', label: 'Style', value: style.category },
      { key: 'styleAverage', label: `Your average for ${style.category}`, value: style.averageRating, unit: 'points' },
      { key: 'otherStylesAverage', label: 'Your average for other styles', value: style.othersAverage, unit: 'points' },
    )
  }
  if (best.proofMatch && proofAffinity && typeof best.bottle.proof === 'number') {
    reasons.push(`it’s ${best.bottle.proof} proof, right where your highest-rated pours land (${proofAffinity.bucketLabel})`)
    facts.push(
      { key: 'bottleProof', label: 'Bottle proof', value: best.bottle.proof, unit: 'proof' },
      { key: 'bestProofRange', label: 'Proof range of your highest-rated pours', value: proofAffinity.bucketLabel },
      { key: 'bestProofRangeAverage', label: 'Average rating in that range', value: proofAffinity.averageRating, unit: 'points' },
    )
  }

  return [
    {
      id: `collection-discovery:sealed-match:${best.bottle.id}`,
      category: 'collection-discovery',
      kind: 'sealed-match',
      facts,
      sampleSize: evidencePours.length,
      confidence,
      window: { from: evidencePours[0]?.date, to: evidencePours[evidencePours.length - 1]?.date, label: 'your rated pours' },
      evidence: { pourIds: evidencePours.map((p) => p.id), bottleIds: [best.bottle.id], roomIds: [] },
      subjectBottleIds: [best.bottle.id],
      actions: [{ id: 'open-bottle', label: 'View Bottle', bottleId: best.bottle.id }],
      copy: {
        headline: `Your sealed ${best.bottle.name} fits your palate.`,
        body: `It’s still sealed, but ${reasons.join(', and ')}.`,
        expanded: 'Something to keep in mind whenever you’re ready to open a new bottle.',
      },
      priority: CATEGORY_WEIGHT['collection-discovery'] + CONFIDENCE_WEIGHT[confidence] + best.score,
    },
  ]
}

export function bottleRediscoveryCandidates(input: NormalizedInput): InsightCandidate[] {
  const { bottles, pours, today } = input
  const out: InsightCandidate[] = []
  for (const bottle of bottles) {
    if (bottle.status !== 'open' || !isOnShelf(bottle)) continue
    const own = pours.filter((p) => p.bottleId === bottle.id)
    if (own.length === 0) continue
    const avg = round1(average(own.map((p) => p.rating)))
    const last = own[own.length - 1]!
    const daysSince = daysBetween(last.date, today)
    if (avg < REDISCOVERY_MIN_RATING || daysSince < REDISCOVERY_MIN_DAYS) continue
    out.push({
      id: `bottle-rediscovery:revisit:${bottle.id}`,
      category: 'bottle-rediscovery',
      kind: 'revisit',
      facts: [
        { key: 'bottleName', label: 'Bottle', value: bottle.name },
        { key: 'averageRating', label: 'Your average rating', value: avg, unit: 'points' },
        { key: 'lastRating', label: 'Your last rating', value: last.rating, unit: 'points' },
        { key: 'pourCount', label: 'Pours logged', value: own.length, unit: 'pours' },
        { key: 'lastPouredOn', label: 'Last poured', value: last.date },
      ],
      sampleSize: own.length,
      confidence: 'descriptive',
      window: { from: own[0]!.date, to: last.date, label: `your ${own.length === 1 ? 'pour' : 'pours'} of ${bottle.name}` },
      evidence: { pourIds: own.map((p) => p.id), bottleIds: [bottle.id], roomIds: [] },
      subjectBottleIds: [bottle.id],
      actions: [{ id: 'open-bottle', label: 'Revisit It', bottleId: bottle.id }],
      copy: {
        headline: `${bottle.name} might be worth a revisit.`,
        body:
          own.length === 1
            ? `You rated it ${last.rating.toFixed(1)} when you poured it on ${formatCalendarDate(last.date)}.`
            : `You’ve rated it ${avg.toFixed(1)} on average across ${own.length} pours. The last was on ${formatCalendarDate(last.date)}.`,
        expanded: 'Palates move. A bottle you loved a while back can taste different now, and that’s worth knowing.',
      },
      // Better-loved bottles first; a longer gap adds a little.
      priority: CATEGORY_WEIGHT['bottle-rediscovery'] + avg + Math.min(daysSince / 60, 3),
    })
  }
  return out
}
