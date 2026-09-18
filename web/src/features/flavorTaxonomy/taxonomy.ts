// The single source of truth for every selectable tasting-note descriptor
// and which flavor family/families it belongs to. Both the tasting-note
// chip selectors (NoseStep/PalateStep/FinishStep, Infinity Bottle's
// TastingForm) and the radar/palate-profile calculation
// (features/flavorRadar/flavorCategories.ts) read from this one list —
// nothing hard-codes its own copy or its own descriptor->axis mapping
// anymore, which is what let descriptors silently fall off the radar
// before this module existed.
//
// Every descriptor string here is permanent once shipped — Pour.fip.
// noseAromas/palateFlavors/finishTags store these exact strings, so
// renaming one would orphan every pour that already selected it.

export type FamilyId = 'sweet' | 'fruit' | 'spice' | 'oakWood' | 'nutty' | 'grain' | 'herbalFloral' | 'smokeEarthy'

export interface FlavorFamily {
  id: FamilyId
  /** Full display label, used as the selector's group header. */
  label: string
  /** Compact label — this is also the radar chart's axis name. */
  shortLabel: string
  /** Whiskey-Identity-style phrasing for Profile/Home (e.g. "Fruit-Forward"). */
  identityLabel: string
  color: string
}

// Order here is the order families render in the selector UI and on the
// radar chart — matches the order they were specified in.
export const FLAVOR_FAMILIES: FlavorFamily[] = [
  { id: 'sweet', label: 'Sweet', shortLabel: 'Sweet', identityLabel: 'Sweet', color: '#c17a2e' },
  { id: 'fruit', label: 'Fruit', shortLabel: 'Fruit', identityLabel: 'Fruit-Forward', color: '#a8324a' },
  { id: 'spice', label: 'Spice', shortLabel: 'Spice', identityLabel: 'Spice-Forward', color: '#b5541f' },
  { id: 'oakWood', label: 'Oak/Wood', shortLabel: 'Oak', identityLabel: 'Oak-Forward', color: '#8a5a2b' },
  { id: 'nutty', label: 'Nutty', shortLabel: 'Nutty', identityLabel: 'Nutty', color: '#8c6a3f' },
  { id: 'grain', label: 'Grain', shortLabel: 'Grain', identityLabel: 'Grain-Forward', color: '#c9a94e' },
  { id: 'herbalFloral', label: 'Herbal/Floral', shortLabel: 'Herbal', identityLabel: 'Herbal/Floral', color: '#5c7a4a' },
  { id: 'smokeEarthy', label: 'Smoke/Earthy', shortLabel: 'Smoke', identityLabel: 'Smoky', color: '#4a4038' },
]

export function familyById(id: FamilyId): FlavorFamily {
  const family = FLAVOR_FAMILIES.find((f) => f.id === id)
  if (!family) throw new Error(`Unknown flavor family: ${id}`)
  return family
}

export interface FlavorDescriptor {
  /** Exact string stored on Pour.fip.noseAromas/palateFlavors — never renamed. */
  label: string
  family: FamilyId
  /** Half-weighted radar contribution only — never affects label ranking/percentages. */
  secondaryFamily?: FamilyId
  /** Free-text synonyms that resolve to this descriptor but aren't their own chip. */
  aliases?: string[]
}

export const OTHER_LABEL = 'Other'

// The 8 provided family lists, verbatim, plus every legacy NOSE_AROMAS/
// PALATE_FLAVORS string not already present (only 'Corn Sweetness', added
// to Grain). Duplicate labels that appeared in two families in the source
// lists (Praline, Nutmeg, Mint, Smoke) keep one visible chip each, under
// their most natural primary family, with the other family as a half-
// weighted secondary — see the plan's dedup table.
export const FLAVOR_DESCRIPTORS: FlavorDescriptor[] = [
  // Sweet
  { label: 'Caramel', family: 'sweet' },
  { label: 'Vanilla', family: 'sweet', aliases: ['vanilla bean'] },
  { label: 'Brown Sugar', family: 'sweet' },
  { label: 'Honey', family: 'sweet' },
  { label: 'Toffee', family: 'sweet' },
  { label: 'Butterscotch', family: 'sweet' },
  { label: 'Maple', family: 'sweet', aliases: ['maple syrup'] },
  { label: 'Molasses', family: 'sweet' },
  { label: 'Marshmallow', family: 'sweet' },
  { label: 'Chocolate', family: 'sweet' },
  { label: 'Dark Chocolate', family: 'sweet' },
  { label: 'Cocoa', family: 'sweet' },
  { label: "Confectioners' Sugar", family: 'sweet' },
  { label: 'Custard', family: 'sweet' },

  // Fruit
  { label: 'Cherry', family: 'fruit' },
  { label: 'Dark Cherry', family: 'fruit' },
  { label: 'Apple', family: 'fruit' },
  { label: 'Baked Apple', family: 'fruit' },
  { label: 'Pear', family: 'fruit' },
  { label: 'Peach', family: 'fruit' },
  { label: 'Apricot', family: 'fruit' },
  { label: 'Plum', family: 'fruit' },
  { label: 'Raisin', family: 'fruit' },
  { label: 'Fig', family: 'fruit' },
  { label: 'Date', family: 'fruit' },
  { label: 'Grape', family: 'fruit' },
  { label: 'Strawberry', family: 'fruit' },
  { label: 'Blackberry', family: 'fruit' },
  { label: 'Blueberry', family: 'fruit' },
  { label: 'Banana', family: 'fruit' },
  { label: 'Orange', family: 'fruit' },
  { label: 'Orange Peel', family: 'fruit', aliases: ['candied orange', 'orange zest'] },
  { label: 'Lemon', family: 'fruit' },
  { label: 'Citrus', family: 'fruit', aliases: ['citrusy'] },
  { label: 'Candied Fruit', family: 'fruit' },
  { label: 'Dark Fruit', family: 'fruit' },
  { label: 'Stone Fruit', family: 'fruit' },
  { label: 'Dried Fruit', family: 'fruit' },

  // Spice
  { label: 'Cinnamon', family: 'spice' },
  { label: 'Baking Spice', family: 'spice' },
  { label: 'Black Pepper', family: 'spice' },
  { label: 'White Pepper', family: 'spice' },
  { label: 'Clove', family: 'spice' },
  { label: 'Nutmeg', family: 'spice', secondaryFamily: 'nutty' },
  { label: 'Allspice', family: 'spice' },
  { label: 'Ginger', family: 'spice' },
  { label: 'Anise', family: 'spice' },
  { label: 'Rye Spice', family: 'spice' },
  { label: 'Red Hots', family: 'spice' },
  { label: 'Tobacco Spice', family: 'spice' },

  // Oak/Wood
  { label: 'Oak', family: 'oakWood' },
  { label: 'Toasted Oak', family: 'oakWood' },
  { label: 'Charred Oak', family: 'oakWood' },
  { label: 'Fresh Oak', family: 'oakWood' },
  { label: 'Dry Oak', family: 'oakWood' },
  { label: 'Cedar', family: 'oakWood' },
  { label: 'Leather', family: 'oakWood' },
  { label: 'Tobacco', family: 'oakWood' },
  { label: 'Barrel Char', family: 'oakWood' },
  { label: 'Toast', family: 'oakWood' },

  // Nutty
  { label: 'Peanut', family: 'nutty' },
  { label: 'Almond', family: 'nutty' },
  { label: 'Pecan', family: 'nutty' },
  { label: 'Walnut', family: 'nutty' },
  { label: 'Hazelnut', family: 'nutty' },
  { label: 'Roasted Nuts', family: 'nutty' },
  { label: 'Praline', family: 'nutty', secondaryFamily: 'sweet' },

  // Grain
  { label: 'Corn', family: 'grain' },
  { label: 'Cornbread', family: 'grain' },
  { label: 'Malt', family: 'grain' },
  { label: 'Wheat', family: 'grain' },
  { label: 'Rye', family: 'grain' },
  { label: 'Cereal Grain', family: 'grain' },
  { label: 'Graham Cracker', family: 'grain' },
  { label: 'Biscuit', family: 'grain' },
  // Legacy PALATE_FLAVORS descriptor, not in the source Grain list — kept
  // so every pour that already selected it stays valid (see backward-
  // compatibility rule in the plan).
  { label: 'Corn Sweetness', family: 'grain' },

  // Herbal/Floral
  { label: 'Mint', family: 'herbalFloral', secondaryFamily: 'spice' },
  { label: 'Dill', family: 'herbalFloral' },
  { label: 'Tea', family: 'herbalFloral' },
  { label: 'Black Tea', family: 'herbalFloral' },
  { label: 'Eucalyptus', family: 'herbalFloral' },
  { label: 'Grass', family: 'herbalFloral' },
  { label: 'Hay', family: 'herbalFloral' },
  { label: 'Floral', family: 'herbalFloral' },
  { label: 'Rose', family: 'herbalFloral' },
  { label: 'Honeysuckle', family: 'herbalFloral' },
  { label: 'Herbal', family: 'herbalFloral', aliases: ['herby'] },

  // Smoke/Earthy
  { label: 'Smoke', family: 'smokeEarthy', secondaryFamily: 'oakWood', aliases: ['smokey'] },
  { label: 'Charcoal', family: 'smokeEarthy' },
  { label: 'Peat', family: 'smokeEarthy' },
  { label: 'Ash', family: 'smokeEarthy' },
  { label: 'Earthy', family: 'smokeEarthy' },
  { label: 'Brine', family: 'smokeEarthy' },
  { label: 'Sea Salt', family: 'smokeEarthy' },
  { label: 'Iodine', family: 'smokeEarthy' },
  { label: 'Coffee', family: 'smokeEarthy' },
  { label: 'Espresso', family: 'smokeEarthy' },
]

export function descriptorsByFamily(id: FamilyId): FlavorDescriptor[] {
  return FLAVOR_DESCRIPTORS.filter((d) => d.family === id)
}

export function findDescriptor(label: string): FlavorDescriptor | undefined {
  return FLAVOR_DESCRIPTORS.find((d) => d.label === label)
}

export interface FinishDescriptor {
  label: string
  /** Set only for the handful of Finish words that are also real flavor words. */
  family?: FamilyId
}

// Finish is textural/structural (length, temperature, mouthfeel), not a
// flavor family — most of these deliberately map to no family at all, so
// the radar never fabricates a flavor association for a word like "Long"
// or "Dry". Sweet/Spicy/Oaky are the exception: those are genuinely
// flavor words too, so selecting them still moves the matching radar axis.
export const FINISH_DESCRIPTORS: FinishDescriptor[] = [
  { label: 'Short' },
  { label: 'Medium' },
  { label: 'Long' },
  { label: 'Lingering' },
  { label: 'Warm' },
  { label: 'Hot' },
  { label: 'Smooth' },
  { label: 'Dry' },
  { label: 'Sweet', family: 'sweet' },
  { label: 'Spicy', family: 'spice' },
  { label: 'Oaky', family: 'oakWood' },
  { label: 'Tannic' },
  { label: 'Bitter' },
  { label: 'Clean' },
  { label: 'Fading' },
  { label: 'Mouth-Coating' },
]

export function findFinishDescriptor(label: string): FinishDescriptor | undefined {
  return FINISH_DESCRIPTORS.find((d) => d.label === label)
}
