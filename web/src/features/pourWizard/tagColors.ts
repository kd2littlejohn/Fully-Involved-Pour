import { findDescriptor, familyById } from '../flavorTaxonomy/taxonomy'

// Maps aroma/flavor tags to a representative color, so a pour's tasting
// notes can render as a colorful gradient strip instead of just a list of
// chips. The 16 legacy tags below keep their exact original hex values
// (no visual shift on existing data); every other descriptor falls back
// to its flavor family's color (features/flavorTaxonomy/taxonomy.ts), so
// a newly added descriptor always gets a sensible, on-theme color without
// a third hand-maintained list to keep in sync.
const LEGACY_TAG_COLORS: Record<string, string> = {
  'Brown Sugar': '#b8752e',
  Vanilla: '#f0dfa1',
  Oak: '#8a5a2b',
  Caramel: '#c17a2e',
  Cherry: '#a8324a',
  Honey: '#e2a63c',
  Cinnamon: '#b5541f',
  'Orange Peel': '#d97b2b',
  Leather: '#5c3a28',
  'Baking Spice': '#8c4a2f',
  Toffee: '#b8863a',
  Butterscotch: '#d9a441',
  'Dark Fruit': '#6b2540',
  'Black Pepper': '#3a3a3a',
  'Corn Sweetness': '#e8c96b',
  Tobacco: '#6e4a2e',
}

const OTHER_COLOR = '#7f766c'

export function colorForTag(tag: string): string {
  const legacy = LEGACY_TAG_COLORS[tag]
  if (legacy) return legacy
  const descriptor = findDescriptor(tag)
  if (descriptor) return familyById(descriptor.family).color
  return OTHER_COLOR
}
