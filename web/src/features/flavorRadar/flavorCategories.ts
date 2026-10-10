import type { Bottle, Pour } from '../../data/types'
import { FLAVOR_FAMILIES, findDescriptor, findFinishDescriptor, type FamilyId } from '../flavorTaxonomy/taxonomy'
import { matchDescriptorsInText } from '../flavorTaxonomy/matching'

// Groups every aroma/flavor tag the app already collects (nose aromas,
// palate flavors, finish tags, and the legacy per-bottle `flavors` field)
// into radar axes — one per flavor family in the centralized taxonomy
// (features/flavorTaxonomy/taxonomy.ts), so a descriptor can never be
// selectable in the UI without also being able to move the radar. No AI
// call involved — this is a heuristic over data the app already has, not
// a new AI judgment.
// A literal tuple (not FLAVOR_FAMILIES.map(...)) so FlavorAxis stays a real
// 8-member string union rather than collapsing to plain `string` — a
// taxonomy.test.ts assertion keeps this in lockstep with FLAVOR_FAMILIES'
// own shortLabel order/content so the two can never silently drift apart.
export const FLAVOR_AXES = ['Sweet', 'Fruit', 'Spice', 'Oak', 'Nutty', 'Grain', 'Herbal', 'Smoke'] as const
export type FlavorAxis = (typeof FLAVOR_AXES)[number]

const AXIS_IDENTITY_LABEL: Record<FlavorAxis, string> = Object.fromEntries(
  FLAVOR_FAMILIES.map((f) => [f.shortLabel, f.identityLabel]),
) as Record<FlavorAxis, string>

// Centralized Whiskey-Identity-style label for a dominant axis (e.g.
// 'Fruit' -> 'Fruit-Forward') — the one place this mapping is written, so
// Profile and Home can't drift into two different hand-rolled copies of
// it. Covered by a runtime test per axis (not just typechecking) since a
// hand-written record silently returning the wrong value for one key
// would still compile.
export function identityLabelForAxis(axis: FlavorAxis): string {
  return AXIS_IDENTITY_LABEL[axis]
}

function shortLabelForFamily(family: FamilyId): FlavorAxis {
  // Safe: taxonomy.test.ts asserts FLAVOR_FAMILIES.shortLabel values
  // exactly match FLAVOR_AXES, so this is always one of the 8 known axes.
  return FLAVOR_FAMILIES.find((f) => f.id === family)!.shortLabel as FlavorAxis
}

// Shared accumulator so per-bottle and collection-wide flavor logic run the
// exact same matching code — no duplicated regex/tag logic between them.
// `structured` = deliberately chip-selected tags (pour.fip.noseAromas /
// palateFlavors / finishTags, the legacy bottle.flavors[] field).
// `freeText` = heuristic word-boundary matches inside notes fields. Kept
// separate (not just merged into `counts`) so callers that care about a
// tag's provenance — like ranking top traits — can prioritize structured
// picks over free-text guesses instead of treating them as equally
// confident.
interface FlavorAccumulator {
  counts: Record<FlavorAxis, number>
  total: number
  structured: Map<string, number>
  freeText: Map<string, number>
}

function newAccumulator(): FlavorAccumulator {
  const counts = Object.fromEntries(FLAVOR_AXES.map((axis) => [axis, 0])) as Record<FlavorAxis, number>
  return { counts, total: 0, structured: new Map(), freeText: new Map() }
}

// Adds one record's worth of flavor signal (one Pour, or one Bottle
// counted via its own legacy `flavors[]` + `notes`). Structured tags and
// every free-text match across the record's own note fields are first
// unioned into a single deduplicated set of canonical labels, so a
// descriptor selected as a chip AND also typed into notes — or typed into
// two different note fields of the same record — counts exactly once for
// that record, never twice. Provenance (structured vs. free-text) is
// still tracked per label so ranking can prefer a deliberate chip tap over
// a guessed free-text match, even when both are present for one label.
function addRecord(acc: FlavorAccumulator, structuredTags: string[], texts: (string | undefined)[]): void {
  const structuredLabels = new Set(structuredTags)
  const freeTextLabels = new Set<string>()
  for (const text of texts) {
    for (const label of matchDescriptorsInText(text)) freeTextLabels.add(label)
  }

  const allLabels = new Set<string>([...structuredLabels, ...freeTextLabels])
  for (const label of allLabels) {
    const descriptor = findDescriptor(label)
    const finish = descriptor ? undefined : findFinishDescriptor(label)
    const family = descriptor?.family ?? finish?.family
    if (!family) continue // e.g. 'Other', or a finish descriptor with no flavor family (Long, Dry, ...)

    acc.counts[shortLabelForFamily(family)] += 1
    const secondaryFamily = descriptor?.secondaryFamily
    if (secondaryFamily) acc.counts[shortLabelForFamily(secondaryFamily)] += 0.5

    acc.total += 1
    if (structuredLabels.has(label)) {
      acc.structured.set(label, (acc.structured.get(label) ?? 0) + 1)
    } else {
      acc.freeText.set(label, (acc.freeText.get(label) ?? 0) + 1)
    }
  }
}

function accumulate(bottles: Bottle[], pours: Pour[]): FlavorAccumulator {
  const acc = newAccumulator()
  for (const bottle of bottles) {
    addRecord(acc, bottle.flavors ?? [], [bottle.notes])
  }
  for (const pour of pours) {
    addRecord(acc, [...pour.fip.noseAromas, ...pour.fip.palateFlavors, ...(pour.fip.finishTags ?? [])], [
      pour.fip.noseNotes,
      pour.fip.palateNotes,
      pour.fip.finishNotes,
      pour.fip.complexityNotes,
    ])
  }
  return acc
}

// Restricts a bottle list to the ones the user has actually logged a pour
// for. A sealed/wishlist/incoming bottle's own `flavors`/`notes` describe
// what it's expected to taste like (useful for matching a candidate bottle
// against the user's palate — see palateMatch/scoring.ts and
// whatShouldIPour/scoring.ts, which call flavorRadarValues on a specific
// candidate directly and intentionally want that, tasted or not) — never
// what the user has actually experienced. Every collection-wide "what have
// I tasted" measure below (the ones YourPalateSection/PalateBreakdown/
// getWhiskeyIdentity use) must be called with this applied first, or notes
// written on a bottle before it's ever been opened — including the AI
// Tasting Note on Add/Edit Bottle — silently count as tasting history.
export function tastedBottles(bottles: Bottle[], pours: Pour[]): Bottle[] {
  const pouredIds = new Set(pours.map((p) => p.bottleId))
  return bottles.filter((b) => pouredIds.has(b.id))
}

// The deduplicated set of canonical flavor labels present on one pour —
// structured chips (nose/palate/finish) unioned with free-text matches
// across its own note fields, filtered to labels that resolve to a real
// flavor family (mirrors addRecord's own filter above). Exposed for
// callers that need a plain per-pour presence set rather than a running
// count — e.g. yourPalate/selectors.ts's preferred-flavor ranking, which
// must treat each bottle's flavors as present-or-absent across its pours so
// repeat tastings of one bottle can't multiply that bottle's weight.
export function pourFlavorLabels(pour: Pour): Set<string> {
  const labels = new Set<string>([...pour.fip.noseAromas, ...pour.fip.palateFlavors, ...(pour.fip.finishTags ?? [])])
  for (const text of [pour.fip.noseNotes, pour.fip.palateNotes, pour.fip.finishNotes, pour.fip.complexityNotes]) {
    for (const label of matchDescriptorsInText(text)) labels.add(label)
  }
  const result = new Set<string>()
  for (const label of labels) {
    if (findDescriptor(label) || findFinishDescriptor(label)) result.add(label)
  }
  return result
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
// counts even if the matching chip was never tapped. Deliberately NOT
// filtered through tastedBottles — this reports one specific bottle's own
// profile (its catalog data plus whatever pours it has, zero or more), not
// a claim about the user's tasting history.
export function flavorRadarValues(bottle: Bottle, pours: Pour[]): number[] | undefined {
  return radarFromAccumulator(accumulate([bottle], pours.filter((p) => p.bottleId === bottle.id)))
}

// Same logic, widened from one bottle's pours to the user's entire pour
// history — the basis for Your Palate's collection-wide Flavor Radar.
// Callers must pass only tasted bottles (see tastedBottles above); this
// function doesn't filter itself since collectionFlavorRadarValues is also
// reused by palateMatch/scoring.ts with a deliberately pre-filtered,
// smaller bottle list of its own.
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
// the full radar.
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
// pours/bottles. This layer is entirely per-label (never per-family), so
// secondary-family radar weighting (see addRecord above) never touches it
// — every label still contributes exactly 1 to `total` per record it
// appears in, so these percentages stay internally consistent regardless
// of how many families a label's radar contribution touches.
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
