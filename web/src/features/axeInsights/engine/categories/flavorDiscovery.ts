import { pourFlavorLabels } from '../../../flavorRadar/flavorCategories'
import { getTopRatedFlavorTags, TOP_RATED_THRESHOLD } from '../../../yourPalate/selectors'
import { CATEGORY_WEIGHT, CONFIDENCE_WEIGHT } from '../config'
import { confidenceForSample, uniq, type NormalizedInput } from '../normalize'
import type { InsightCandidate } from '../types'

// Category B — Flavor Discovery. Your Palate's "flavors you tend to prefer"
// (getTopRatedFlavorTags): flavors from pours rated 8.0+ (Working Fire and
// up), counted once per bottle so one favorite poured five times can't
// pass for five bottles agreeing. Labels come from each pour's own chips
// and notes, already normalized to the flavor taxonomy's canonical names
// (pourFlavorLabels), never from a bottle's catalog description.

const MAX_TAGS = 3

function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

export function flavorDiscoveryCandidates(input: NormalizedInput): InsightCandidate[] {
  const { pours } = input
  const tags = getTopRatedFlavorTags(pours, MAX_TAGS).filter((t) => t.bottleCount >= 2)
  if (tags.length === 0) return []

  // The denominator: distinct bottles behind your 8.0+ pours that carry
  // any flavor evidence at all (the same set the ranking drew from).
  const highRated = pours.filter((p) => p.rating >= TOP_RATED_THRESHOLD && pourFlavorLabels(p).size > 0)
  const topBottleIds = uniq(highRated.map((p) => p.bottleId))
  const total = topBottleIds.length
  const confidence = confidenceForSample(total)
  const tagNames = tags.map((t) => t.tag)
  const lead = tags[0]!
  const supporting = highRated.filter((p) => {
    const labels = pourFlavorLabels(p)
    return tagNames.some((t) => labels.has(t))
  })

  const headline =
    confidence === 'established'
      ? `${listPhrase(tagNames)} keep turning up in your favorites.`
      : confidence === 'tentative'
        ? `${listPhrase(tagNames)} may be part of what you love.`
        : `${listPhrase(tagNames)} showed up in your top-rated pours.`

  return [
    {
      id: `flavor-discovery:top-rated-flavors:${tagNames.join('|').toLowerCase()}`,
      category: 'flavor-discovery',
      kind: 'top-rated-flavors',
      facts: [
        { key: 'topBottles', label: `Bottles you've rated ${TOP_RATED_THRESHOLD.toFixed(1)}+ with flavor notes`, value: total, unit: 'bottles' },
        { key: 'ratingThreshold', label: 'High-rated threshold', value: TOP_RATED_THRESHOLD, unit: 'points' },
        ...tags.map((t, i) => ({
          key: `flavor${i + 1}`,
          label: `Flavor ${i + 1}`,
          value: t.tag,
        })),
        ...tags.map((t, i) => ({
          key: `flavor${i + 1}Bottles`,
          label: `High-rated bottles with ${t.tag}`,
          value: t.bottleCount,
          unit: 'bottles' as const,
        })),
      ],
      sampleSize: total,
      confidence,
      window: {
        from: supporting[0]?.date,
        to: supporting[supporting.length - 1]?.date,
        label: `your pours rated ${TOP_RATED_THRESHOLD.toFixed(1)} or higher`,
      },
      evidence: { pourIds: supporting.map((p) => p.id), bottleIds: uniq(supporting.map((p) => p.bottleId)), roomIds: [] },
      subjectBottleIds: [],
      actions: [{ id: 'open-palate', label: 'Explore Your Palate' }],
      copy: {
        headline,
        body: `${lead.tag} appears in ${lead.bottleCount} of the ${total} bottles you've rated ${TOP_RATED_THRESHOLD.toFixed(1)} or higher.`,
        expanded:
          tags.length > 1
            ? tags
                .slice(1)
                .map((t) => `${t.tag}: ${t.bottleCount} of ${total}.`)
                .join(' ')
            : undefined,
      },
      priority: CATEGORY_WEIGHT['flavor-discovery'] + CONFIDENCE_WEIGHT[confidence],
    },
  ]
}
