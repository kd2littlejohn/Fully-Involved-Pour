import type { BuyAgain } from '../../data/types'

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
