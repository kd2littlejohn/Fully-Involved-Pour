// "Graduation": one taster's personal summary of a finished event, built
// on the client from their OWN ballots and the PUBLISHED round results
// (which exist only after the reveal). Nothing here reads anyone else's
// ballot or a concealed bottle. Pure, so every rule is unit-tested.
import { FLAVOR_DESCRIPTORS, FLAVOR_FAMILIES, type FamilyId } from '../flavorTaxonomy/taxonomy'
import type { Party, PartyBallot, PartyCategoryResults, PartyGroup, PartyPublicBottle } from './types'

export interface GraduationPour {
  categoryId: string
  categoryName: string
  label: string
  bottle: PartyPublicBottle
  overall: number
  roomAverage: number | null
}

export interface EventGraduation {
  // users/{uid}.graduations is keyed by party: saving again replaces it.
  id: string
  partyId: string
  eventName: string
  eventDate: string | null
  hostName: string
  experience: PartyGroup | null
  poursRated: number
  totalPours: number
  completed: boolean
  favoriteBottles: { name: string; categoryName: string; overall: number }[]
  favoriteFlight: { name: string; average: number } | null
  topFlavors: string[]
  profile: { title: string; summary: string; families: string[] }
  // How this taster compared with the room: their average minus the
  // room's, over the pours they rated.
  versusRoom: number | null
  savedAt: number
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

const FAMILY_BY_DESCRIPTOR = new Map(FLAVOR_DESCRIPTORS.map((d) => [d.label.toLowerCase(), d.family]))
const FAMILY_LABEL = new Map(FLAVOR_FAMILIES.map((f) => [f.id, f.identityLabel]))

// A short, honest title from what the taster actually noticed and loved.
const TITLES: Record<FamilyId, string> = {
  sweet: 'The Caramel Scholar',
  fruit: 'The Orchard Reader',
  spice: 'The Spice Seeker',
  oakWood: 'The Oak Devotee',
  nutty: 'The Toasted Nut',
  grain: 'The Grain Purist',
  herbalFloral: 'The Botanist',
  smokeEarthy: 'The Ember Keeper',
}

export function buildGraduation({
  party,
  ballots,
  results,
  group,
  now = Date.now(),
}: {
  party: Party
  ballots: PartyBallot[]
  results: Record<string, PartyCategoryResults>
  group: PartyGroup | null
  now?: number
}): EventGraduation | null {
  const pours: GraduationPour[] = []
  const descriptorCounts = new Map<string, number>()
  const familyScore = new Map<FamilyId, number>()
  for (const category of party.categories) {
    const result = results[category.id]
    if (category.state !== 'revealed' || !result) continue
    const ballot = ballots.find((b) => b.categoryId === category.id && !b.excluded)
    if (!ballot) continue
    for (const sample of result.samples) {
      const score = ballot.scores?.[sample.label]
      if (!score || typeof score.overall !== 'number') continue
      pours.push({
        categoryId: category.id,
        categoryName: category.name,
        label: sample.label,
        bottle: sample.bottle,
        overall: score.overall,
        roomAverage: sample.average,
      })
      for (const d of score.descriptors ?? []) {
        descriptorCounts.set(d, (descriptorCounts.get(d) ?? 0) + 1)
        const family = FAMILY_BY_DESCRIPTOR.get(d.toLowerCase())
        // Flavors in pours they enjoyed weigh more than ones they didn't.
        if (family) familyScore.set(family, (familyScore.get(family) ?? 0) + 0.5 + score.overall / 10)
      }
    }
  }
  if (!pours.length) return null

  const best = Math.max(...pours.map((p) => p.overall))
  const favoriteBottles = pours
    .filter((p) => p.overall === best)
    .map((p) => ({ name: p.bottle.name, categoryName: p.categoryName, overall: p.overall }))

  const byFlight = new Map<string, { name: string; total: number; n: number; order: number }>()
  pours.forEach((p) => {
    const f = byFlight.get(p.categoryId) ?? { name: p.categoryName, total: 0, n: 0, order: party.categories.findIndex((c) => c.id === p.categoryId) }
    f.total += p.overall
    f.n += 1
    byFlight.set(p.categoryId, f)
  })
  // Ties go to the earlier flight, so the result is stable.
  const flights = [...byFlight.values()].map((f) => ({ name: f.name, average: round1(f.total / f.n), order: f.order }))
  flights.sort((a, b) => b.average - a.average || a.order - b.order)
  const favoriteFlight = flights[0] ? { name: flights[0].name, average: flights[0].average } : null

  const topFlavors = [...descriptorCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([d]) => d)

  const families = [...familyScore.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f)
  const lead = families[0]
  const proofs = pours.filter((p) => typeof p.bottle.proof === 'number')
  const loved = proofs.filter((p) => p.overall >= best - 0.5)
  const highProof = loved.length > 0 && loved.reduce((s, p) => s + (p.bottle.proof as number), 0) / loved.length >= 105
  const title = lead ? TITLES[lead] : highProof ? 'The Proof Chaser' : 'The Open Palate'
  const familyLabels = families.slice(0, 2).map((f) => FAMILY_LABEL.get(f) ?? f)
  const summaryParts: string[] = []
  if (familyLabels.length) summaryParts.push(`You gravitated to ${familyLabels.join(' and ').toLowerCase()} flavors`)
  if (favoriteFlight) summaryParts.push(`${summaryParts.length ? 'and' : 'You'} rated ${favoriteFlight.name.replace(/^Flight \d+\s*[—-]\s*/, '')} highest`)
  if (highProof) summaryParts.push('— higher proof didn’t scare you')
  const summary = summaryParts.length ? `${summaryParts.join(' ')}.` : 'Every pour taught you something. Keep tasting to sharpen your profile.'

  const compared = pours.filter((p) => p.roomAverage !== null)
  const versusRoom = compared.length
    ? round1(compared.reduce((s, p) => s + p.overall - (p.roomAverage as number), 0) / compared.length)
    : null
  const totalPours = party.categories.reduce((s, c) => s + c.sampleLabels.length, 0)

  return {
    id: `party:${party.id}`,
    partyId: party.id,
    eventName: party.name,
    eventDate: party.eventDate,
    hostName: party.hostName,
    experience: group,
    poursRated: pours.length,
    totalPours,
    completed: party.status === 'completed',
    favoriteBottles,
    favoriteFlight,
    topFlavors,
    profile: { title, summary, families: familyLabels },
    versusRoom,
    savedAt: now,
  }
}
