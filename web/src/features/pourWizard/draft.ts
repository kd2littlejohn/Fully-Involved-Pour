import { resolvePouredWith } from './pourPeople'
import type { BuyAgain, Pour, PourPerson, PourPersonRef } from '../../data/types'

export interface PourDraft {
  date: string
  ounces?: number
  occasion?: string
  companion?: string
  // Structured "Poured With" selections — plain serializable objects, safe
  // to persist alongside the rest of the draft (unlike the pending memory
  // photo File, see steps/StepProps.ts and PourWizard.tsx).
  pouredWith?: PourPersonRef[]
  sharedWithUids?: string[]
  location?: string
  mood?: string
  glass?: string
  weather?: string
  notes?: string
  nose: number
  noseAromas: string[]
  noseNotes?: string
  palate: number
  palateFlavors: string[]
  palateNotes?: string
  finish: number
  finishNotes?: string
  complexity: number
  complexityNotes?: string
  buyAgain?: BuyAgain
  wouldBuyAgain?: boolean
  memory?: string
}

export function blankDraft(): PourDraft {
  return {
    date: new Date().toISOString().slice(0, 10),
    nose: 0,
    noseAromas: [],
    palate: 0,
    palateFlavors: [],
    finish: 0,
    complexity: 0,
  }
}

export function pourToDraft(pour: Pour, people: PourPerson[]): PourDraft {
  return {
    date: pour.date,
    ounces: pour.ounces,
    occasion: pour.occasion,
    companion: pour.companion,
    pouredWith: resolvePouredWith(pour, people),
    sharedWithUids: pour.sharedWithUids,
    location: pour.location,
    mood: pour.mood,
    glass: pour.glass,
    weather: pour.weather,
    notes: pour.notes,
    nose: pour.fip.nose,
    noseAromas: pour.fip.noseAromas,
    noseNotes: pour.fip.noseNotes,
    palate: pour.fip.palate,
    palateFlavors: pour.fip.palateFlavors,
    palateNotes: pour.fip.palateNotes,
    finish: pour.fip.finish,
    finishNotes: pour.fip.finishNotes,
    complexity: pour.fip.complexity,
    complexityNotes: pour.fip.complexityNotes,
    buyAgain: pour.buyAgain,
    wouldBuyAgain: pour.wouldBuyAgain,
    memory: pour.memory,
  }
}
