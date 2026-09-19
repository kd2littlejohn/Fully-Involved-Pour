import type { Bottle, BottleRarity, RaritySuggestion } from '../../data/types'

// The exact confirmed-rarity field set — both the Add/Edit form and the
// useUserData mutators build patches through these two functions so they
// can never drift out of sync with each other.
export type RarityFieldPatch = Pick<
  Bottle,
  'rarity' | 'raritySource' | 'rarityConfidence' | 'rarityReason' | 'rarityConfirmedAt' | 'raritySuggestion'
>

// A manual pick always wins: it's confirmed immediately, and explicitly
// clears any AI confidence/reason (stale AI confidence must never survive a
// manual override) and any pending suggestion (nothing left to review).
// `ignoreUndefinedProperties: true` is explicitly enabled on this app's
// Firestore client (see web/src/data/firebase.ts) specifically so that
// writing `undefined` here is a real key removal, not a no-op — this
// mirrors the same "blank field = literal undefined" convention already
// used throughout the rest of the app's mutations.
export function manualRarityFields(rarity: BottleRarity, now = Date.now()): RarityFieldPatch {
  return {
    rarity,
    raritySource: 'manual',
    rarityConfidence: undefined,
    rarityReason: undefined,
    rarityConfirmedAt: now,
    raritySuggestion: undefined,
  }
}

// Accepting a suggestion with rarity: null is a no-op — there is nothing to
// confirm, since the classifier explicitly declined. Returns null in that
// case so callers know not to apply anything.
export function acceptedRarityFields(suggestion: RaritySuggestion, now = Date.now()): RarityFieldPatch | null {
  if (suggestion.rarity === null) return null
  return {
    rarity: suggestion.rarity,
    raritySource: 'suggested-confirmed',
    rarityConfidence: suggestion.confidence,
    rarityReason: suggestion.reason,
    rarityConfirmedAt: now,
    raritySuggestion: undefined,
  }
}

export function isRarityConfirmed(bottle: Pick<Bottle, 'rarity' | 'raritySource'>): boolean {
  return Boolean(bottle.rarity && bottle.raritySource)
}

export function isRarityManual(bottle: Pick<Bottle, 'raritySource'>): boolean {
  return bottle.raritySource === 'manual'
}

// 'allocated' existed as its own level before it was removed from the
// scale — a bottle confirmed that way keeps its historical Firestore value
// untouched (no rewrite), but reads back as 'rare' everywhere in the app,
// the closest remaining tier, rather than an unrecognized/undefined rarity.
const LEGACY_RARITY_ALIASES: Record<string, BottleRarity> = { allocated: 'rare' }

export function confirmedRarityOf(bottle: Pick<Bottle, 'rarity' | 'raritySource'>): BottleRarity | undefined {
  if (!isRarityConfirmed(bottle)) return undefined
  const raw = bottle.rarity as string
  return LEGACY_RARITY_ALIASES[raw] ?? bottle.rarity
}

// Bottles you don't yet physically hold (Wishlist, and Incoming — the
// "Buy Next" bottles on the existing My Bar "Incoming" filter chip) never
// count toward the rarity chart or the bulk-review queue. This does NOT
// restrict the Add/Edit form's rarity field itself — a wishlist/incoming
// bottle can still be manually or AI-classified while you're deciding
// whether to chase it; only the owned-inventory chart/queue exclude them.
export function isOwnedForRarity(bottle: Pick<Bottle, 'status'>): boolean {
  return bottle.status !== 'wishlist' && bottle.status !== 'incoming'
}
