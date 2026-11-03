// What the lobby and join screen show about an event: counts and names
// only, never a bottle.
import { totalGlasses } from './liveProgress'
import type { Party, PartyPreview, PartyRosterEntry } from './types'

export interface EventFactsInput {
  hostName: string
  presenters: string[]
  eventDate: string | null
  participants: number | null
  capacity: number | null
  flights: number
  pours: number
  plannedGuided: number | null
  plannedBlind: number | null
  dual: boolean
}

export function factsFromPreview(preview: PartyPreview): EventFactsInput {
  return {
    hostName: preview.hostName,
    presenters: preview.presenters ?? [],
    eventDate: preview.eventDate,
    participants: preview.participantCount ?? null,
    capacity: preview.capacity ?? null,
    flights: preview.categoryCount,
    pours: preview.pourCount ?? 0,
    plannedGuided: preview.plannedGuided ?? null,
    plannedBlind: preview.plannedBlind ?? null,
    dual: preview.format === 'dual',
  }
}

export function factsFromParty(party: Party, roster: PartyRosterEntry[]): EventFactsInput {
  return {
    hostName: party.hostName,
    presenters: party.presenters ?? [],
    eventDate: party.eventDate,
    participants: roster.filter((e) => e.tasting).length || party.counts?.guests || 0,
    capacity: party.capacity,
    flights: party.categories.length,
    pours: totalGlasses(party),
    plannedGuided: party.dual?.plannedGuided ?? null,
    plannedBlind: party.dual?.plannedBlind ?? null,
    dual: party.format === 'dual',
  }
}
