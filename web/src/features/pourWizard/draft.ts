import type { BuyAgain, Pour } from '../../data/types'

export interface PourDraft {
  date: string
  ounces?: number
  occasion?: string
  companion?: string
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

export function pourToDraft(pour: Pour): PourDraft {
  return {
    date: pour.date,
    ounces: pour.ounces,
    occasion: pour.occasion,
    companion: pour.companion,
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
