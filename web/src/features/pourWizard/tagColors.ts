// Maps aroma/flavor tags (features/fip/scoring.ts NOSE_AROMAS / PALATE_FLAVORS)
// to a representative color, so a pour's tasting notes can render as a
// colorful gradient strip instead of just a list of chips.
export const TAG_COLORS: Record<string, string> = {
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
  Other: '#7f766c',
}

export function colorForTag(tag: string): string {
  return TAG_COLORS[tag] ?? TAG_COLORS.Other ?? '#7f766c'
}
