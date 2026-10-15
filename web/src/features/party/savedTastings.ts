import type { Bottle, SavedTasting } from '../../data/types'
import { partyFormat, type Party, type PartyBallot, type PartyCategory, type PartyCategoryResults } from './types'

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
// are known to them: a revealed blind round, or any round of a regular
// tasting once results are out. Unscored samples are skipped.
export function buildSavedTastings({
  party,
  category,
  results,
  ballot,
  myBar,
  now = Date.now(),
}: {
  party: Party
  category: PartyCategory
  results: PartyCategoryResults | undefined
  ballot: PartyBallot | undefined
  myBar: Bottle[]
  now?: number
}): SavedTasting[] {
  if (!results || !ballot || category.state !== 'revealed') return []
  const format = partyFormat(party)
  const date = tastedOn(party, category)
  const out: SavedTasting[] = []
  for (const sample of results.samples) {
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
      ...(ballot.unblinded ? { notFullyBlind: true } : {}),
      savedAt: now,
    })
  }
  return out
}
