import type { Pour } from '../../../../data/types'
import { FIP_MAX } from '../../../fip/scoring'
import { getPalateEvolution, getProofEvolution } from '../../../yourPalate/selectors'
import { supportedProofAffinity, supportedStyleAffinity } from '../affinity'
import { CATEGORY_WEIGHT, CONFIDENCE_WEIGHT, EVIDENCE } from '../config'
import { average, confidenceForSample, confidenceForTrend, round1, uniq, type NormalizedInput } from '../normalize'
import type { InsightCandidate } from '../types'

// Category A — Palate Evolution. Built on Your Palate's own selectors
// (getPalateEvolution, getProofEvolution, getCategoryAffinity,
// getProofAffinity), so AXE and Your Palate can never disagree. Those
// compare the oldest 3 pours with the newest 3 once there are 6; the
// windows below are cut the same way so evidence ids match exactly.
//
// What someone poured is never treated as what they prefer. A proof shift
// is described as exploring; a preference is only claimed when ratings
// back it up (rating-supported affinity).

const SAMPLE = EVIDENCE.trendMinPerPeriod
const COMPONENTS = ['nose', 'palate', 'finish', 'complexity'] as const
// A component must move by this share of its own maximum to be worth a
// mention (0.5 of Palate's 3.5, 0.25 of Complexity's 1.0, ...).
const COMPONENT_MIN_SHIFT_SHARE = 0.15

function windowOf(older: { date: string }[], recent: { date: string }[]) {
  return {
    from: older[0]?.date,
    to: recent[recent.length - 1]?.date,
    label: `your last ${recent.length} pours vs. your first ${older.length}`,
  }
}

export function palateEvolutionCandidates(input: NormalizedInput): InsightCandidate[] {
  const { pours, bottles, bottleById } = input
  const out: InsightCandidate[] = []
  const base = CATEGORY_WEIGHT['palate-evolution']

  // Ratings over time.
  const evolution = getPalateEvolution(pours)
  if (evolution && evolution.kind !== 'steady') {
    const older = pours.slice(0, SAMPLE)
    const recent = pours.slice(-SAMPLE)
    const confidence = confidenceForTrend(older.length, recent.length)!
    const up = evolution.kind === 'improved'
    out.push({
      id: 'palate-evolution:rating-shift',
      category: 'palate-evolution',
      kind: 'rating-shift',
      facts: [
        { key: 'recentAverage', label: 'Recent average rating', value: evolution.newAverage, unit: 'points' },
        { key: 'earlierAverage', label: 'Earlier average rating', value: evolution.oldAverage, unit: 'points' },
        { key: 'periodSize', label: 'Pours in each period', value: SAMPLE, unit: 'pours' },
      ],
      sampleSize: older.length + recent.length,
      confidence,
      window: windowOf(older, recent),
      evidence: { pourIds: [...older, ...recent].map((p) => p.id), bottleIds: uniq([...older, ...recent].map((p) => p.bottleId)), roomIds: [] },
      subjectBottleIds: [],
      actions: [{ id: 'open-palate', label: 'Explore Your Palate' }],
      copy: {
        headline: up ? 'Your recent pours are landing higher.' : 'Your recent pours are landing a little lower.',
        body: `Your last ${SAMPLE} pours average ${evolution.newAverage.toFixed(1)}, ${up ? 'up' : 'down'} from ${evolution.oldAverage.toFixed(1)} across your first ${SAMPLE}.`,
        expanded: up
          ? 'That can mean better bottles, or a palate getting more comfortable with what it likes. Either way, it shows in your ratings.'
          : 'It could be the bottles, the setting, or a palate getting pickier. It’s a small sample, so worth watching rather than reading into.',
      },
      priority: base + CONFIDENCE_WEIGHT[confidence],
    })
  }

  // Proof over time — what was poured, not what was liked.
  const proofEvolution = getProofEvolution(bottles, pours)
  if (proofEvolution && proofEvolution.kind !== 'steady') {
    const withProof = pours.filter((p) => typeof bottleById.get(p.bottleId)?.proof === 'number')
    const older = withProof.slice(0, SAMPLE)
    const recent = withProof.slice(-SAMPLE)
    const confidence = confidenceForTrend(older.length, recent.length)!
    const higher = proofEvolution.kind === 'higher'
    const affinity = supportedProofAffinity(input)
    const facts: InsightCandidate['facts'] = [
      { key: 'recentProof', label: 'Recent average proof', value: Math.round(proofEvolution.newAverage), unit: 'proof' },
      { key: 'earlierProof', label: 'Earlier average proof', value: Math.round(proofEvolution.oldAverage), unit: 'proof' },
      { key: 'periodSize', label: 'Pours in each period', value: SAMPLE, unit: 'pours' },
    ]
    let expanded = 'That’s what you’ve been pouring, not necessarily what you like best. Your ratings will tell that story as you log more.'
    if (affinity) {
      facts.push(
        { key: 'bestProofRange', label: 'Proof range of your highest-rated pours', value: affinity.bucketLabel },
        { key: 'bestProofRangeAverage', label: 'Average rating in that range', value: affinity.averageRating, unit: 'points' },
      )
      expanded = `Your highest-rated pours tend to land around ${affinity.bucketLabel}, averaging ${affinity.averageRating.toFixed(1)}.`
    }
    out.push({
      id: 'palate-evolution:proof-shift',
      category: 'palate-evolution',
      kind: 'proof-shift',
      facts,
      sampleSize: older.length + recent.length,
      confidence,
      window: windowOf(older, recent),
      evidence: { pourIds: [...older, ...recent].map((p) => p.id), bottleIds: uniq([...older, ...recent].map((p) => p.bottleId)), roomIds: [] },
      subjectBottleIds: [],
      actions: [{ id: 'open-palate', label: 'Explore Your Palate' }],
      copy: {
        headline: higher ? 'You’ve been exploring stronger pours lately.' : 'You’ve been reaching for gentler proofs lately.',
        body: `Your recent tastings average ${Math.round(proofEvolution.newAverage)} proof, compared with ${Math.round(proofEvolution.oldAverage)} in your earlier sessions.`,
        expanded,
      },
      priority: base + CONFIDENCE_WEIGHT[confidence] - 2,
    })
  }

  // Style preference — only when ratings support it, across 2+ styles.
  const affinity = supportedStyleAffinity(input)
  if (affinity) {
    const styled = pours.filter((p) => bottleById.get(p.bottleId)?.type?.trim())
    const confidence = confidenceForSample(styled.length)
    if (confidence !== 'descriptive') {
      const inStyle = styled.filter((p) => bottleById.get(p.bottleId)?.type?.trim() === affinity.category)
      out.push({
        id: `palate-evolution:style-preference:${affinity.category.toLowerCase()}`,
        category: 'palate-evolution',
        kind: 'style-preference',
        facts: [
          { key: 'style', label: 'Style', value: affinity.category },
          { key: 'styleAverage', label: `Average rating for ${affinity.category}`, value: affinity.averageRating, unit: 'points' },
          { key: 'stylePours', label: `${affinity.category} pours`, value: affinity.pourCount, unit: 'pours' },
          { key: 'otherStylesAverage', label: 'Average rating for other styles', value: affinity.othersAverage, unit: 'points' },
        ],
        sampleSize: styled.length,
        confidence,
        window: { from: styled[0]?.date, to: styled[styled.length - 1]?.date, label: 'all your rated pours with a style' },
        evidence: { pourIds: inStyle.map((p) => p.id), bottleIds: uniq(inStyle.map((p) => p.bottleId)), roomIds: [] },
        subjectBottleIds: [],
        actions: [{ id: 'open-palate', label: 'Explore Your Palate' }],
        copy: {
          headline: confidence === 'established' ? `${affinity.category} is where you rate highest.` : `${affinity.category} may be your style.`,
          body: `Your ${affinity.pourCount} ${affinity.category} pours average ${affinity.averageRating.toFixed(1)}, compared with ${affinity.othersAverage.toFixed(1)} for everything else.`,
        },
        priority: base + CONFIDENCE_WEIGHT[confidence] - 4,
      })
    }
  }

  const component = componentShift(pours)
  if (component) out.push({ ...component, priority: base + CONFIDENCE_WEIGHT[component.confidence] - 6 })

  return out
}

const COMPONENT_LABEL: Record<(typeof COMPONENTS)[number], string> = {
  nose: 'nose',
  palate: 'palate',
  finish: 'finish',
  complexity: 'complexity & balance',
}

// The single FIP component that moved most between your earliest and most
// recent pours that recorded components, if it moved enough to matter.
function componentShift(pours: Pour[]): Omit<InsightCandidate, 'priority'> | undefined {
  const withFip = pours.filter((p) => p.fip && COMPONENTS.every((c) => typeof p.fip[c] === 'number'))
  if (withFip.length < SAMPLE * 2) return undefined
  const older = withFip.slice(0, SAMPLE)
  const recent = withFip.slice(-SAMPLE)
  let best: { component: (typeof COMPONENTS)[number]; oldAvg: number; newAvg: number; share: number } | undefined
  for (const component of COMPONENTS) {
    const oldAvg = round1(average(older.map((p) => p.fip[component])))
    const newAvg = round1(average(recent.map((p) => p.fip[component])))
    const share = Math.abs(newAvg - oldAvg) / FIP_MAX[component]
    if (share >= COMPONENT_MIN_SHIFT_SHARE && (!best || share > best.share)) best = { component, oldAvg, newAvg, share }
  }
  if (!best) return undefined
  const confidence = confidenceForTrend(older.length, recent.length)!
  const label = COMPONENT_LABEL[best.component]
  const up = best.newAvg > best.oldAvg
  return {
    id: `palate-evolution:component-shift:${best.component}`,
    category: 'palate-evolution',
    kind: 'component-shift',
    facts: [
      { key: 'component', label: 'FIP component', value: label },
      { key: 'recentScore', label: `Recent average ${label} score`, value: best.newAvg, unit: 'points' },
      { key: 'earlierScore', label: `Earlier average ${label} score`, value: best.oldAvg, unit: 'points' },
      { key: 'componentMax', label: `Maximum ${label} score`, value: FIP_MAX[best.component], unit: 'points' },
      { key: 'periodSize', label: 'Pours in each period', value: SAMPLE, unit: 'pours' },
    ],
    sampleSize: older.length + recent.length,
    confidence,
    window: windowOf(older, recent),
    evidence: { pourIds: [...older, ...recent].map((p) => p.id), bottleIds: uniq([...older, ...recent].map((p) => p.bottleId)), roomIds: [] },
    subjectBottleIds: [],
    actions: [{ id: 'open-palate', label: 'Explore Your Palate' }],
    copy: {
      headline: up ? `You’re scoring the ${label} higher lately.` : `You’re scoring the ${label} lower lately.`,
      body: `Your recent ${label} scores average ${best.newAvg.toFixed(1)} of ${FIP_MAX[best.component]}, compared with ${best.oldAvg.toFixed(1)} in your earlier tastings.`,
    },
  }
}
