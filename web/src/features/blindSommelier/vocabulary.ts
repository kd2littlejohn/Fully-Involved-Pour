import type { BlindFinishLength, BlindGuidanceLevel } from '../../data/types'

export interface GuidanceOption {
  value: BlindGuidanceLevel
  title: string
  description: string
}

export const GUIDANCE_OPTIONS: GuidanceOption[] = [
  { value: 'guide', title: 'Guide Me', description: 'The full guided tasting, one question at a time.' },
  { value: 'casual', title: 'Keep It Casual', description: 'Just the key questions.' },
  { value: 'minimal', title: 'I’ve Got This', description: 'Minimal guidance — just your reaction.' },
]

// Nose: broad strokes first, so a beginner never faces a wall of technical
// terms — a short, optional second level only for the families with enough
// natural variation to be worth splitting (see NOSE_DETAILS below).
export const NOSE_BROAD_FLAVORS = ['Sweet', 'Fruity', 'Oaky', 'Spicy', 'Rich', 'Light', 'Nutty', 'Not Sure'] as const
export type NoseBroadFlavor = (typeof NOSE_BROAD_FLAVORS)[number]

export const NOSE_DETAILS: Partial<Record<NoseBroadFlavor, readonly string[]>> = {
  Sweet: ['Caramel', 'Vanilla', 'Brown Sugar', 'Honey', 'Chocolate', 'Not Sure'],
  Fruity: ['Cherry', 'Berry', 'Citrus', 'Apple', 'Dark Fruit', 'Not Sure'],
  Spicy: ['Cinnamon', 'Pepper', 'Baking Spice', 'Rye Spice', 'Not Sure'],
}

export const LIKED_CHARACTERISTICS = [
  'Sweetness',
  'Rich Flavor',
  'Smoothness',
  'Spice',
  'Oak',
  'Finish',
  "I'm Not Sure",
  'I Just Like It',
] as const

export interface FinishImpressionOption {
  label: string
  length: BlindFinishLength
}

export const FINISH_IMPRESSIONS: FinishImpressionOption[] = [
  { label: 'Fades Quickly', length: 'short' },
  { label: 'Hangs Around', length: 'medium' },
  { label: 'Keeps Going', length: 'long' },
  { label: 'Gets Sweeter', length: 'building' },
  { label: 'Gets Spicier', length: 'building' },
  { label: 'Gets Hotter', length: 'building' },
]

export function finishLengthFor(label: string): BlindFinishLength | undefined {
  return FINISH_IMPRESSIONS.find((f) => f.label === label)?.length
}

// Chip vocab for the optional Finish/Complexity note-taking screens — same
// tap-to-select pattern as Pour Story's Nose/Palate steps (see
// features/fip/scoring.ts NOSE_AROMAS/PALATE_FLAVORS, reused directly for
// those two dimensions here). Pour Story itself has no chip vocab for
// Finish/Complexity, so these are new.
export const FINISH_FLAVORS = ['Oak', 'Vanilla', 'Caramel', 'Spice', 'Pepper', 'Char', 'Smoke', 'Dry', 'Sweet', 'Other']

export const COMPLEXITY_DESCRIPTORS = ['Layered', 'Evolving', 'Balanced', 'Bold', 'Simple', 'One-Note', 'Well-Rounded', 'Other']

// Baseline options for the Extra Challenge "Type" guess — shown even for a
// taster whose own collection doesn't cover the style being poured.
export const WHISKEY_TYPE_SUGGESTIONS = [
  'Bourbon',
  'Wheated Bourbon',
  'High-Rye Bourbon',
  'Rye',
  'Tennessee Whiskey',
  'Single Malt Scotch',
  'Blended Scotch',
  'Irish Whiskey',
  'Japanese Whisky',
  'Canadian Whisky',
  'Corn Whiskey',
] as const
