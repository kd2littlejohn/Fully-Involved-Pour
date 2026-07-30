import type { BuyAgain } from '../../data/types'

// FIP Rating rubric — FIP_PRODUCT_VISION_AND_DESIGN_SYSTEM.md §13.
// Nose 2.5 + Palate 3.5 + Finish 2.0 + Complexity & Balance 1.0 + Value/Buy Again 1.0 = 10
export const FIP_MAX = {
  nose: 2.5,
  palate: 3.5,
  finish: 2.0,
  complexity: 1.0,
  value: 1.0,
} as const

export const NOSE_AROMAS = [
  'Brown Sugar',
  'Vanilla',
  'Oak',
  'Caramel',
  'Cherry',
  'Honey',
  'Cinnamon',
  'Orange Peel',
  'Leather',
  'Baking Spice',
  'Toffee',
  'Other',
]

export const PALATE_FLAVORS = [
  'Vanilla',
  'Caramel',
  'Oak',
  'Butterscotch',
  'Dark Fruit',
  'Black Pepper',
  'Corn Sweetness',
  'Cinnamon',
  'Toffee',
  'Leather',
  'Tobacco',
  'Other',
]

export const BUY_AGAIN_OPTIONS: { value: BuyAgain; label: string; score: number }[] = [
  { value: 'absolutely', label: 'Absolutely', score: 1 },
  { value: 'probably', label: 'Probably', score: 0.75 },
  { value: 'maybe', label: 'Maybe', score: 0.5 },
  { value: 'probably-not', label: 'Probably Not', score: 0.25 },
  { value: 'no', label: 'No', score: 0 },
]

export function buyAgainToValueScore(buyAgain: BuyAgain | undefined): number {
  return BUY_AGAIN_OPTIONS.find((o) => o.value === buyAgain)?.score ?? 0
}

export interface FipComponentScores {
  nose: number
  palate: number
  finish: number
  complexity: number
  value: number
}

export function computeFipTotal(scores: FipComponentScores): number {
  const total = scores.nose + scores.palate + scores.finish + scores.complexity + scores.value
  return Math.round(Math.max(0, Math.min(10, total)) * 10) / 10
}
