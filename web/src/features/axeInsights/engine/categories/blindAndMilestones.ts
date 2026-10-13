import { pourFlavorLabels } from '../../../flavorRadar/flavorCategories'
import { familyById, findDescriptor, findFinishDescriptor, type FamilyId } from '../../../flavorTaxonomy/taxonomy'
import { BLIND_SIGHTED_MIN_GAP, CATEGORY_WEIGHT, MILESTONE_FRESH_DAYS, REVISIT_RATING_DELTA } from '../config'
import { average, daysBetween, isCalendarDate, round1, type NormalizedInput } from '../normalize'
import type { BlindTastingResult, InsightCandidate } from '../types'

// Category E — Blind Room Discoveries. Only the user's own locked blind
// answers (score and/or final ranking) joined to the revealed bottles. A
// blind-vs-sighted comparison needs both bottles to have the user's own
// sighted ratings, and the two to disagree by a real margin.
//
// Category F — Journey Milestones. Firsts and turning points, only while
// recent (MILESTONE_FRESH_DAYS). Never volume or frequency ("10 pours!").

type BlindPour = BlindTastingResult['pours'][number]

// Did the user prefer `a` over `b` blind? Ranking wins when both have
// one; otherwise blind scores, if they differ. Undefined = no evidence.
function blindPrefers(a: BlindPour, b: BlindPour): boolean | undefined {
  if (typeof a.blindRank === 'number' && typeof b.blindRank === 'number' && a.blindRank !== b.blindRank) {
    return a.blindRank < b.blindRank
  }
  if (typeof a.blindScore === 'number' && typeof b.blindScore === 'number' && a.blindScore !== b.blindScore) {
    return a.blindScore > b.blindScore
  }
  return undefined
}

function validBlinds(blinds: BlindTastingResult[] | undefined): BlindTastingResult[] {
  return (blinds ?? [])
    .filter((b) => b && typeof b.roomId === 'string' && Array.isArray(b.pours) && isCalendarDate(b.date))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.roomId.localeCompare(b.roomId))
}

export function blindDiscoveryCandidates(input: NormalizedInput, blinds: BlindTastingResult[] | undefined): InsightCandidate[] {
  const { pours, today } = input
  const out: InsightCandidate[] = []
  const sighted = new Map<string, number[]>()
  for (const p of pours) sighted.set(p.bottleId, [...(sighted.get(p.bottleId) ?? []), p.rating])

  for (const blind of validBlinds(blinds)) {
    let best: { winner: BlindPour; loser: BlindPour; winnerAvg: number; loserAvg: number; gap: number } | undefined
    for (const a of blind.pours) {
      for (const b of blind.pours) {
        if (a.bottleId === b.bottleId || blindPrefers(a, b) !== true) continue
        const aRatings = sighted.get(a.bottleId)
        const bRatings = sighted.get(b.bottleId)
        if (!aRatings || !bRatings) continue
        const winnerAvg = round1(average(aRatings))
        const loserAvg = round1(average(bRatings))
        const gap = round1(loserAvg - winnerAvg)
        if (gap >= BLIND_SIGHTED_MIN_GAP && (!best || gap > best.gap)) best = { winner: a, loser: b, winnerAvg, loserAvg, gap }
      }
    }
    if (!best) continue
    const { winner, loser, winnerAvg, loserAvg } = best
    const evidencePours = pours.filter((p) => p.bottleId === winner.bottleId || p.bottleId === loser.bottleId)
    const fresh = daysBetween(blind.date!, today) <= MILESTONE_FRESH_DAYS
    out.push({
      id: `blind-discovery:blind-vs-sighted:${blind.roomId}`,
      category: 'blind-discovery',
      kind: 'blind-vs-sighted',
      facts: [
        { key: 'blindWinner', label: 'Preferred blind', value: winner.bottleName },
        { key: 'blindRunnerUp', label: 'Ranked lower blind', value: loser.bottleName },
        { key: 'winnerSightedAverage', label: `Your sighted average for ${winner.bottleName}`, value: winnerAvg, unit: 'points' },
        { key: 'runnerUpSightedAverage', label: `Your sighted average for ${loser.bottleName}`, value: loserAvg, unit: 'points' },
        { key: 'blindDate', label: 'Blind tasting date', value: blind.date! },
      ],
      // One blind comparison is a single observation, however striking.
      sampleSize: 1,
      confidence: 'descriptive',
      window: { from: blind.date, to: blind.date, label: blind.roomName ? `your blind tasting "${blind.roomName}"` : 'your latest blind tasting' },
      evidence: { pourIds: evidencePours.map((p) => p.id), bottleIds: [winner.bottleId, loser.bottleId], roomIds: [blind.roomId] },
      subjectBottleIds: [winner.bottleId, loser.bottleId],
      actions: [
        { id: 'open-blind', label: 'See the Reveal', roomId: blind.roomId },
        { id: 'open-bottle', label: `View ${winner.bottleName}`, bottleId: winner.bottleId },
      ],
      copy: {
        headline: 'Your blind palate disagreed with your ratings.',
        body: `Blind, you preferred ${winner.bottleName} over ${loser.bottleName}, even though you’ve rated ${loser.bottleName} higher (${loserAvg.toFixed(1)} vs. ${winnerAvg.toFixed(1)}).`,
        expanded: 'One blind tasting isn’t a verdict, but labels and expectations do shape what we taste. Worth another side-by-side.',
      },
      priority: CATEGORY_WEIGHT['blind-discovery'] + (fresh ? 10 : -20),
    })
  }
  return out.slice(0, 1)
}

function familyOfLabel(label: string): FamilyId | undefined {
  return findDescriptor(label)?.family ?? findFinishDescriptor(label)?.family
}

export function journeyMilestoneCandidates(input: NormalizedInput, blinds: BlindTastingResult[] | undefined): InsightCandidate[] {
  const { pours, bottleById, today } = input
  const out: InsightCandidate[] = []
  const isFresh = (date: string) => daysBetween(date, today) <= MILESTONE_FRESH_DAYS && daysBetween(date, today) >= 0
  const base = CATEGORY_WEIGHT['journey-milestone']

  // First tasting.
  if (pours.length === 1 && isFresh(pours[0]!.date)) {
    const first = pours[0]!
    const name = bottleById.get(first.bottleId)?.name
    out.push({
      id: `journey-milestone:first-tasting:${first.id}`,
      category: 'journey-milestone',
      kind: 'first-tasting',
      facts: [
        { key: 'firstRating', label: 'Your first rating', value: first.rating, unit: 'points' },
        { key: 'firstDate', label: 'Date', value: first.date },
        ...(name ? [{ key: 'bottleName', label: 'Bottle', value: name }] : []),
      ],
      sampleSize: 1,
      confidence: 'descriptive',
      window: { from: first.date, to: first.date, label: 'your first logged pour' },
      evidence: { pourIds: [first.id], bottleIds: [first.bottleId], roomIds: [] },
      subjectBottleIds: [],
      actions: [{ id: 'log-pour', label: 'Log Your Next Pour' }],
      copy: {
        headline: 'Your whiskey journey has its first entry.',
        body: name
          ? `You rated ${name} ${first.rating.toFixed(1)}. A couple more pours and AXE can start noticing what you enjoy.`
          : `You rated your first pour ${first.rating.toFixed(1)}. A couple more and AXE can start noticing what you enjoy.`,
      },
      priority: base + 5,
    })
  }

  // First blind tasting.
  const allBlinds = validBlinds(blinds)
  if (allBlinds.length === 1 && isFresh(allBlinds[0]!.date!)) {
    const blind = allBlinds[0]!
    out.push({
      id: `journey-milestone:first-blind:${blind.roomId}`,
      category: 'journey-milestone',
      kind: 'first-blind',
      facts: [
        { key: 'blindDate', label: 'Date', value: blind.date! },
        { key: 'blindPours', label: 'Pours in the flight', value: blind.pours.length, unit: 'pours' },
      ],
      sampleSize: 1,
      confidence: 'descriptive',
      window: { from: blind.date, to: blind.date, label: 'your first blind tasting' },
      evidence: { pourIds: [], bottleIds: blind.pours.map((p) => p.bottleId), roomIds: [blind.roomId] },
      subjectBottleIds: [],
      actions: [{ id: 'open-blind', label: 'See the Reveal', roomId: blind.roomId }],
      copy: {
        headline: 'You tasted your first blind flight.',
        body: `${blind.pours.length} pours, no labels, just your palate. That’s the most honest tasting there is.`,
      },
      priority: base + 4,
    })
  }

  // A flavor family your latest pour introduced.
  const tagged = pours.filter((p) => pourFlavorLabels(p).size > 0)
  const latest = tagged[tagged.length - 1]
  if (latest && tagged.length >= 3 && isFresh(latest.date)) {
    const earlier = new Set<FamilyId>()
    for (const p of tagged.slice(0, -1)) for (const l of pourFlavorLabels(p)) {
      const f = familyOfLabel(l)
      if (f) earlier.add(f)
    }
    const newFamilies = [...new Set([...pourFlavorLabels(latest)].map(familyOfLabel))].filter(
      (f): f is FamilyId => Boolean(f) && !earlier.has(f!),
    )
    if (newFamilies.length > 0) {
      const family = familyById(newFamilies.sort()[0]!)
      const name = bottleById.get(latest.bottleId)?.name
      out.push({
        id: `journey-milestone:new-flavor-family:${family.id}`,
        category: 'journey-milestone',
        kind: 'new-flavor-family',
        facts: [
          { key: 'flavorFamily', label: 'Flavor family', value: family.label },
          { key: 'pourDate', label: 'Date', value: latest.date },
          { key: 'earlierTaggedPours', label: 'Earlier pours with flavor notes', value: tagged.length - 1, unit: 'pours' },
          ...(name ? [{ key: 'bottleName', label: 'Bottle', value: name }] : []),
        ],
        sampleSize: tagged.length,
        confidence: 'descriptive',
        window: { from: tagged[0]!.date, to: latest.date, label: 'every pour you’ve tagged with flavors' },
        evidence: { pourIds: [latest.id], bottleIds: [latest.bottleId], roomIds: [] },
        subjectBottleIds: [],
        actions: [{ id: 'open-palate', label: 'Explore Your Palate' }],
        copy: {
          headline: `New territory: ${family.label.toLowerCase()} notes.`,
          body: `${name ? `Your pour of ${name}` : 'Your latest pour'} is the first of your ${tagged.length} tagged tastings to pick up ${family.label.toLowerCase()} notes.`,
        },
        priority: base,
      })
    }
  }

  // A bottle revisited with a substantially different impression.
  const last = pours[pours.length - 1]
  if (last && isFresh(last.date)) {
    const previous = pours.filter((p) => p.bottleId === last.bottleId && p.id !== last.id)
    const prior = previous[previous.length - 1]
    if (prior && Math.abs(round1(last.rating - prior.rating)) >= REVISIT_RATING_DELTA) {
      const name = bottleById.get(last.bottleId)?.name ?? 'This bottle'
      const up = last.rating > prior.rating
      out.push({
        id: `journey-milestone:revisit-shift:${last.id}`,
        category: 'journey-milestone',
        kind: 'revisit-shift',
        facts: [
          { key: 'bottleName', label: 'Bottle', value: name },
          { key: 'latestRating', label: 'Latest rating', value: last.rating, unit: 'points' },
          { key: 'previousRating', label: 'Previous rating', value: prior.rating, unit: 'points' },
          { key: 'latestDate', label: 'Latest pour', value: last.date },
          { key: 'previousDate', label: 'Previous pour', value: prior.date },
        ],
        sampleSize: 2,
        confidence: 'descriptive',
        window: { from: prior.date, to: last.date, label: `your last two pours of ${name}` },
        evidence: { pourIds: [prior.id, last.id], bottleIds: [last.bottleId], roomIds: [] },
        subjectBottleIds: [last.bottleId],
        actions: [{ id: 'open-bottle', label: 'See Its Journey', bottleId: last.bottleId }],
        copy: {
          headline: up ? `${name} opened up for you.` : `${name} didn’t land the same way this time.`,
          body: `You rated it ${last.rating.toFixed(1)} this time, compared with ${prior.rating.toFixed(1)} on ${prior.date === last.date ? 'the same day' : 'your previous pour'}.`,
          expanded: up
            ? 'Air, time open, and mood all change a pour. Your Journey tab shows how this bottle has moved.'
            : 'Air, time open, and mood all change a pour. One off night doesn’t make a bottle a miss.',
        },
        priority: base + 2,
      })
    }
  }

  return out
}
