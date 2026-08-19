import type { Bottle, Pour } from '../../data/types'

// Groups every aroma/flavor tag the app already collects (nose aromas, palate
// flavors, and the legacy per-bottle `flavors` field) into a small set of
// radar axes. No AI call involved — this is a heuristic over data the app
// already has, not a new AI judgment.
export const FLAVOR_AXES = ['Sweet', 'Spicy', 'Woody', 'Fruity', 'Smoky'] as const
export type FlavorAxis = (typeof FLAVOR_AXES)[number]

const TAG_AXIS: Record<string, FlavorAxis> = {
  'Brown Sugar': 'Sweet',
  Vanilla: 'Sweet',
  Caramel: 'Sweet',
  Honey: 'Sweet',
  Toffee: 'Sweet',
  Butterscotch: 'Sweet',
  'Corn Sweetness': 'Sweet',
  Cinnamon: 'Spicy',
  'Baking Spice': 'Spicy',
  'Black Pepper': 'Spicy',
  Oak: 'Woody',
  Cherry: 'Fruity',
  'Orange Peel': 'Fruity',
  'Dark Fruit': 'Fruity',
  Leather: 'Smoky',
  Tobacco: 'Smoky',
}

const TAG_MATCHERS = Object.entries(TAG_AXIS).map(([tag, axis]) => ({
  tag,
  axis,
  // Word-boundary match so free-text notes count too — "hints of vanilla and
  // oak" should nudge Sweet and Woody just like tapping those chips would.
  pattern: new RegExp(`\\b${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
}))

// Shared accumulator so per-bottle and collection-wide flavor logic run the
// exact same matching code — no duplicated regex/tag logic between them.
// `structured` = deliberately chip-selected tags (pour.fip.noseAromas /
// palateFlavors, the legacy bottle.flavors[] field). `freeText` = heuristic
// word-boundary matches inside notes fields. Kept separate (not just merged
// into `counts`) so callers that care about a tag's provenance — like
// ranking top traits — can prioritize structured picks over free-text
// guesses instead of treating them as equally confident.
interface FlavorAccumulator {
  counts: Record<FlavorAxis, number>
  total: number
  structured: Map<string, number>
  freeText: Map<string, number>
}

function newAccumulator(): FlavorAccumulator {
  return { counts: { Sweet: 0, Spicy: 0, Woody: 0, Fruity: 0, Smoky: 0 }, total: 0, structured: new Map(), freeText: new Map() }
}

function addStructuredTag(acc: FlavorAccumulator, tag: string): void {
  const axis = TAG_AXIS[tag]
  if (!axis) return
  acc.counts[axis] += 1
  acc.total += 1
  acc.structured.set(tag, (acc.structured.get(tag) ?? 0) + 1)
}

function addFreeText(acc: FlavorAccumulator, text: string | undefined): void {
  if (!text) return
  for (const { tag, axis, pattern } of TAG_MATCHERS) {
    if (pattern.test(text)) {
      acc.counts[axis] += 1
      acc.total += 1
      acc.freeText.set(tag, (acc.freeText.get(tag) ?? 0) + 1)
    }
  }
}

function accumulate(bottles: Bottle[], pours: Pour[]): FlavorAccumulator {
  const acc = newAccumulator()
  for (const bottle of bottles) {
    for (const tag of bottle.flavors ?? []) addStructuredTag(acc, tag)
    addFreeText(acc, bottle.notes)
  }
  for (const pour of pours) {
    for (const tag of [...pour.fip.noseAromas, ...pour.fip.palateFlavors]) addStructuredTag(acc, tag)
    addFreeText(acc, pour.fip.noseNotes)
    addFreeText(acc, pour.fip.palateNotes)
    addFreeText(acc, pour.fip.finishNotes)
    addFreeText(acc, pour.fip.complexityNotes)
  }
  return acc
}

function radarFromAccumulator(acc: FlavorAccumulator): number[] | undefined {
  if (acc.total === 0) return undefined
  const max = Math.max(...FLAVOR_AXES.map((axis) => acc.counts[axis]))
  return FLAVOR_AXES.map((axis) => acc.counts[axis] / max)
}

// Every pour of this bottle plus its legacy `flavors` field, weighted by how
// often each tag comes up — a bottle poured five times with "Oak" every time
// leans woodier on the chart than one where it showed up once. Free-text
// notes (bottle notes, and each pour's nose/palate/finish/complexity notes)
// are scanned for the same tag words, so writing "vanilla and oak" in notes
// counts even if the matching chip was never tapped.
export function flavorRadarValues(bottle: Bottle, pours: Pour[]): number[] | undefined {
  return radarFromAccumulator(accumulate([bottle], pours.filter((p) => p.bottleId === bottle.id)))
}

// Same logic, widened from one bottle's pours to the user's entire pour
// history — the basis for Your Palate's collection-wide Flavor Radar.
export function collectionFlavorRadarValues(bottles: Bottle[], pours: Pour[]): number[] | undefined {
  return radarFromAccumulator(accumulate(bottles, pours))
}

export interface DominantFlavorAxis {
  axis: FlavorAxis
  percent: number
}

// The single axis with the most evidence behind it, as a share of every
// tag mention counted (structured chips + free-text matches together) —
// e.g. { axis: 'Woody', percent: 72 } when Woody tags account for 72% of
// everything tagged across the given bottles/pours. Used by Home's Your
// Palate Lately card, which wants one honest headline number rather than
// the full five-axis radar.
export function dominantFlavorAxis(bottles: Bottle[], pours: Pour[]): DominantFlavorAxis | undefined {
  const acc = accumulate(bottles, pours)
  if (acc.total === 0) return undefined
  const [axis, count] = (Object.entries(acc.counts) as [FlavorAxis, number][]).reduce((best, cur) =>
    cur[1] > best[1] ? cur : best,
  )
  if (count === 0) return undefined
  return { axis, percent: Math.round((count / acc.total) * 100) }
}

export interface FlavorTagRank {
  tag: string
  structuredCount: number
  freeTextCount: number
}

// Ranks flavor/aroma tags by how much real evidence backs them — a tag the
// user deliberately tapped as a chip (structured) always outranks one only
// ever inferred from free-text notes (heuristic), regardless of how many
// times the free-text match fired. Ties within the same tier break on raw
// count, then alphabetically for a fully deterministic order.
export function topFlavorTags(bottles: Bottle[], pours: Pour[], limit = 6): FlavorTagRank[] {
  const acc = accumulate(bottles, pours)
  const allTags = new Set<string>([...acc.structured.keys(), ...acc.freeText.keys()])
  return [...allTags]
    .map((tag) => ({ tag, structuredCount: acc.structured.get(tag) ?? 0, freeTextCount: acc.freeText.get(tag) ?? 0 }))
    .sort((a, b) => b.structuredCount - a.structuredCount || b.freeTextCount - a.freeTextCount || a.tag.localeCompare(b.tag))
    .slice(0, limit)
}

export interface FlavorTagPercent {
  tag: string
  count: number
  percent: number
}

// Real percentages — each tag's share of every tag mention counted (the
// same denominator dominantFlavorAxis uses for its own honest percent), not
// anything scaled or approximated to look like a mockup number. Profile's
// palate breakdown card is built on this specifically so every percentage
// shown there is independently recomputable from the user's own tagged
// pours/bottles.
export function topFlavorTagPercentages(bottles: Bottle[], pours: Pour[], limit = 5): FlavorTagPercent[] {
  const acc = accumulate(bottles, pours)
  if (acc.total === 0) return []
  const allTags = new Set<string>([...acc.structured.keys(), ...acc.freeText.keys()])
  return [...allTags]
    .map((tag) => {
      const count = (acc.structured.get(tag) ?? 0) + (acc.freeText.get(tag) ?? 0)
      return { tag, count, percent: Math.round((count / acc.total) * 100) }
    })
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit)
}
