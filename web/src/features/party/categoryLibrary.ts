// The Tasting Category Library — predefined categories every host can pick
// from, plus the host's own saved custom categories (users/{uid}/
// partyCategories). These are selectable options, never mandatory rounds.
//
// `id` is a stable identifier: parties reference a library category by id
// (PartyCategory.libraryId) and snapshot its name/description at the time
// it's added, so renaming or rewording an entry here never alters a past
// party's results. Never reuse or renumber an id.

export interface LibraryCategory {
  id: string
  name: string
  description: string
  tags: string[]
  custom?: boolean
}

export const DEFAULT_CATEGORY_LIBRARY: LibraryCategory[] = [
  { id: 'double-oaked', name: 'Double Oaked', description: 'A second barrel for deeper oak, caramel and spice.', tags: ['oak', 'bourbon'] },
  { id: 'wheated-bourbon', name: 'Wheated Bourbon', description: 'Wheat in place of rye: softer, rounder, bready sweetness.', tags: ['mash bill', 'bourbon'] },
  { id: 'rye-whiskey', name: 'Rye Whiskey', description: 'Rye-forward spice, herbs and pepper.', tags: ['rye', 'mash bill'] },
  { id: 'bottled-in-bond', name: 'Bottled in Bond', description: 'One distillery, one season, four years, 100 proof.', tags: ['style', 'proof'] },
  { id: 'single-barrel', name: 'Single Barrel', description: 'Every bottle from one barrel — no blending.', tags: ['style'] },
  { id: 'barrel-proof', name: 'Barrel Proof / Full Proof', description: 'Uncut or barely cut. Add water if you like.', tags: ['proof'] },
  { id: 'small-batch', name: 'Small Batch', description: 'A handful of barrels blended for a house style.', tags: ['style'] },
  { id: 'finished-whiskey', name: 'Finished Whiskey', description: 'Extra time in wine, rum, port or other casks.', tags: ['finish', 'oak'] },
  { id: 'toasted-barrel', name: 'Toasted Barrel', description: 'Toasted rather than (or as well as) charred oak.', tags: ['oak', 'finish'] },
  { id: 'high-rye-bourbon', name: 'High Rye Bourbon', description: 'A bourbon mash bill with a big rye share.', tags: ['mash bill', 'bourbon'] },
  { id: 'age-statement', name: 'Age Statement', description: 'Does age really matter? Young versus old.', tags: ['age'] },
  { id: 'budget-bourbon', name: 'Budget Bourbon', description: 'Great pours that won’t break the bank.', tags: ['price', 'bourbon'] },
  { id: 'premium-bourbon', name: 'Premium Bourbon', description: 'Special-occasion bottles, tasted honestly.', tags: ['price', 'bourbon'] },
  { id: 'allocated-vs-shelf', name: 'Allocated vs. Shelf', description: 'Is the hunt worth it? Allocated bottles against shelf picks.', tags: ['price', 'head-to-head'] },
  { id: 'craft-vs-heritage', name: 'Craft vs. Heritage', description: 'Young craft distilleries against the legacy houses.', tags: ['head-to-head'] },
  { id: 'bourbon-vs-rye', name: 'Bourbon vs. Rye', description: 'Corn sweetness against rye spice.', tags: ['head-to-head', 'mash bill'] },
  { id: 'american-single-malt', name: 'American Single Malt', description: '100% malted barley, American style.', tags: ['malt'] },
  { id: 'international-whiskey', name: 'International Whiskey', description: 'Scotch, Irish, Japanese and beyond.', tags: ['world'] },
  { id: 'mystery-flight', name: 'Mystery Flight', description: 'No theme given. Taste first, guess later.', tags: ['fun'] },
  { id: 'head-to-head', name: 'Head-to-Head', description: 'Two bottles. One winner.', tags: ['head-to-head'] },
]

export function searchLibrary(categories: LibraryCategory[], query: string, tag?: string): LibraryCategory[] {
  const q = query.trim().toLowerCase()
  return categories.filter((c) => {
    if (tag && !c.tags.includes(tag)) return false
    if (!q) return true
    return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.tags.some((t) => t.includes(q))
  })
}

export function libraryTags(categories: LibraryCategory[]): string[] {
  return [...new Set(categories.flatMap((c) => c.tags))].sort()
}
