import type { Bottle, SavedTasting } from '../../data/types'
import { partyFormat, type Party, type PartyBallot, type PartyCategory, type PartyCategoryResults, type PartyGroup, type PartyPublicBottle } from './types'

export function savedTastingId(partyId: string, categoryId: string, label: string): string {
  return `party:${partyId}:${categoryId}:${label}`
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .trim()
}

// Links an event bottle to the taster's own My Bar bottle with the same
// name, if they have one. Never creates or changes a bottle.
export function matchMyBarBottle(name: string, bottles: Bottle[]): Bottle | undefined {
  const key = normalizeName(name)
  if (!key) return undefined
  const matches = bottles.filter((b) => normalizeName(b.name) === key)
  return matches.find((b) => b.status !== 'wishlist') ?? matches[0]
}

// The day the round was tasted, as YYYY-MM-DD in the taster's time zone:
// when voting opened, else the event date, else when it was revealed.
export function tastedOn(party: Party, category: PartyCategory): string {
  const at = category.votingOpenedAt ?? category.revealedAt ?? null
  if (at) {
    const d = new Date(at)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  if (party.eventDate) return party.eventDate.slice(0, 10)
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// One SavedTasting per sample this taster scored in a round whose bottles
// are known to them: a revealed blind round, any round of a regular
// tasting once results are out, or (Dual Experience) a guided taster's
// round once voting closes. Unscored samples are skipped. Ids depend only
// on the party, round and letter, so saving again (say, a guided round
// first at close, then after the reveal) updates instead of duplicating.
export function buildSavedTastings({
  party,
  category,
  results,
  ballot,
  myBar,
  group = null,
  guidedBottles,
  now = Date.now(),
}: {
  party: Party
  category: PartyCategory
  results: PartyCategoryResults | undefined
  ballot: PartyBallot | undefined
  myBar: Bottle[]
  group?: PartyGroup | null
  guidedBottles?: Record<string, PartyPublicBottle>
  now?: number
}): SavedTasting[] {
  if (!ballot) return []
  let samples: { label: string; bottle: PartyPublicBottle }[]
  if (results && category.state === 'revealed') samples = results.samples
  else if (group === 'guided' && guidedBottles && category.state === 'voting_closed') {
    samples = category.sampleLabels.filter((l) => guidedBottles[l]).map((label) => ({ label, bottle: guidedBottles[label]! }))
  } else return []
  const partyKind = partyFormat(party)
  // What this taster experienced: a dual guided taster tasted openly.
  const format: SavedTasting['format'] = partyKind === 'regular' || (partyKind === 'dual' && group === 'guided') ? 'regular' : 'blind'
  const date = tastedOn(party, category)
  const out: SavedTasting[] = []
  for (const sample of samples) {
    const score = ballot.scores?.[sample.label]
    if (!score || typeof score.overall !== 'number') continue
    const { price: _price, ...bottle } = sample.bottle as SavedTasting['bottle'] & { price?: number }
    const linked = matchMyBarBottle(bottle.name, myBar)
    out.push({
      id: savedTastingId(party.id, category.id, sample.label),
      source: 'party',
      format,
      partyId: party.id,
      eventName: party.name,
      ...(party.hostName ? { hostName: party.hostName } : {}),
      categoryId: category.id,
      categoryName: category.name,
      label: sample.label,
      date,
      bottle,
      ...(linked ? { bottleId: linked.id } : {}),
      overall: score.overall,
      ...(typeof score.nose === 'number' ? { nose: score.nose } : {}),
      ...(typeof score.palate === 'number' ? { palate: score.palate } : {}),
      ...(typeof score.finish === 'number' ? { finish: score.finish } : {}),
      ...(typeof score.complexity === 'number' ? { complexity: score.complexity } : {}),
      ...(score.notes?.trim() ? { notes: score.notes.trim() } : {}),
      descriptors: score.descriptors ?? [],
      favorite: ballot.favoriteLabel === sample.label,
      ...(format === 'blind' && category.revealedAt ? { revealedAt: category.revealedAt } : {}),
      ...(ballot.unblinded && format === 'blind' ? { notFullyBlind: true } : {}),
      ...(partyKind === 'dual' && group ? { experience: group } : {}),
      savedAt: now,
    })
  }
  return out
}
