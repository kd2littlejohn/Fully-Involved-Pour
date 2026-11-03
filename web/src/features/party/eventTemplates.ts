// Ready-made tasting events: a full Dual Experience setup the host can
// load into the Create a Party wizard and then edit like any other draft.
// Bottles are entered as manual snapshots (nothing is taken from or added
// to My Bar). Only facts that don't vary by batch are filled in: a
// barrel-proof or cask-strength bottle's proof is left for the host to
// enter from the bottle being poured.
import { draftKey, newDraftCategory, SUGGESTED_PAIRINGS, SUGGESTED_STATIONS, type DraftCategory, type PartyDraft } from './setupDraft'
import type { PartyBottle } from './types'

export interface EventTemplate {
  id: string
  name: string
  summary: string
  build: (base: PartyDraft) => PartyDraft
}

function bottle(name: string, distillery: string, type: string, proof?: number): PartyBottle {
  return { name, distillery, type, ...(proof !== undefined ? { proof } : {}), source: 'manual' }
}

function flight(libraryId: string | null, name: string, description: string, bottles: PartyBottle[]) {
  const category = newDraftCategory({ libraryId, name, description })
  return {
    ...category,
    // Glass order is the pour order; letters follow it so the room tastes
    // A, B, C in sequence. The blind group still sees letters only.
    samples: bottles.map((b, i) => ({ key: draftKey('s'), label: 'ABCDEFGHIJKL'[i]!, bottle: b })),
    manualLabels: true,
    samplesDirty: true,
  }
}

export const PROOF_OF_GRADUATION: EventTemplate = {
  id: 'proof-of-graduation',
  name: 'Proof of Graduation',
  summary: 'Dual Experience · 10 tasters (7 guided, 3 blind) · 3 flights · 9 glasses',
  build: (base) => withPairings({
    ...base,
    name: 'Proof of Graduation',
    description:
      'A graduation tasting in three flights: wheated bourbon, rye whiskey and double oaked. Guided tasters learn each bottle as they go; blind tasters score by glass letter until the reveal.',
    eventDate: '2026-11-07',
    capacity: '10',
    hostName: 'The Bourbon Daddy',
    presenters: ['Kevin D. Littlejohn', 'Nathaniel D. Rhodes'],
    format: 'dual',
    // The host runs the event; ten guests taste.
    hostTasting: false,
    dual: { joinGroup: 'blind', plannedGuided: 7, plannedBlind: 3 },
    settings: { ...base.settings, defaultScoring: 'detailed', revealByCategory: false, allowEdits: true },
    categories: [
      flight('wheated-bourbon', 'Flight 1 — Wheated Bourbon', 'Wheat in place of rye: softer, sweeter, bready.', [
        bottle('Castle & Key Wheated', 'Castle & Key Distillery', 'Wheated Bourbon'),
        bottle('Weller Antique 107', 'Buffalo Trace Distillery', 'Wheated Bourbon', 107),
        bottle('Redwood Empire Colonel Armstrong', 'Redwood Empire Whiskey', 'Wheated Bourbon'),
      ]),
      flight('rye-whiskey', 'Flight 2 — Rye Whiskey', 'At least 51% rye: spice, pepper, herbs.', [
        bottle('E.H. Taylor Straight Rye', 'Buffalo Trace Distillery', 'Rye Whiskey', 100),
        bottle('1792 Straight Rye', 'Barton 1792 Distillery', 'Rye Whiskey'),
        bottle('Elijah Craig Barrel Proof Rye', 'Heaven Hill Distillery', 'Rye Whiskey'),
      ]),
      flight('double-oaked', 'Flight 3 — Double Oaked', 'A second barrel for deeper oak, toast and caramel.', [
        bottle('Woodford Reserve Double Oaked', 'Woodford Reserve Distillery', 'Bourbon', 90.4),
        bottle('Barrell Foundation Double Barrel', 'Barrell Craft Spirits', 'Bourbon'),
        bottle('Peerless Double Oak', 'Kentucky Peerless Distilling Co.', 'Bourbon'),
      ]),
    ],
    stations: SUGGESTED_STATIONS.map((s) => ({ ...s })),
    pairings: {},
  }),
}

// The suggested pairing for each flight's style, keyed by draft round.
function withPairings(draft: PartyDraft): PartyDraft {
  const pairings: PartyDraft['pairings'] = {}
  draft.categories.forEach((c: DraftCategory) => {
    const name = c.libraryId ? SUGGESTED_PAIRINGS[c.libraryId] : undefined
    if (name) pairings[c.key] = { name, note: '' }
  })
  return { ...draft, pairings }
}

export const EVENT_TEMPLATES: EventTemplate[] = [PROOF_OF_GRADUATION]
