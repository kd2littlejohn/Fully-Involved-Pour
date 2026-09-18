import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type { Bottle, RarityConfidence, RaritySuggestion } from '../types'

export const RARITY_CLASSIFIER_VERSION = 'rarity-v1'

export interface RarityIdentity {
  bottleName: string
  distillery?: string
  type?: string
  region?: string
  ageStatement?: string
  proof?: number
  singleBarrel?: boolean
  storePick?: boolean
}

export function rarityIdentity(bottle: Pick<Bottle, 'name' | 'distillery' | 'type' | 'region' | 'ageStatement' | 'proof'>): RarityIdentity {
  const flags = detectPickFlags(bottle.name)
  return {
    bottleName: bottle.name.trim(),
    distillery: bottle.distillery,
    type: bottle.type,
    region: bottle.region,
    ageStatement: bottle.ageStatement,
    proof: bottle.proof,
    ...flags,
  }
}

// Same threshold philosophy as FIP Guide's own lookup — a bare name alone
// isn't enough to ask honestly, but name + one more real identifying field
// is. "Normally bottle name plus distillery or brand," per spec.
export function hasSufficientRarityIdentity(identity: RarityIdentity): boolean {
  return identity.bottleName.trim().length >= 3 && Boolean(identity.distillery?.trim() || identity.type?.trim())
}

// Recognizes an already-typed single-barrel/store-pick bottle name so the
// suggestion request can flag it without asking the user to fill in a
// separate field. Deliberately conservative — a false negative just means
// the AI judges from the name text itself (which it also sees).
export function detectPickFlags(name: string): { singleBarrel: boolean; storePick: boolean } {
  const lower = name.toLowerCase()
  return {
    singleBarrel: /single[\s-]?barrel/.test(lower),
    storePick: /store pick|barrel pick|private select(ion)?|hand[\s-]?(picked|selected)/.test(lower),
  }
}

// Normalized-identity cache key — mirrors fipGuide.ts's fipGuideKey
// normalization, plus every other identity field that could change the
// suggestion, plus the classifier version (so a prompt/model upgrade
// invalidates every previously-cached suggestion automatically).
export function rarityIdentityKey(identity: RarityIdentity): string {
  const normalize = (value: string | undefined) =>
    (value ?? '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const parts = [
    normalize(identity.bottleName),
    normalize(identity.distillery),
    normalize(identity.type),
    normalize(identity.region),
    normalize(identity.ageStatement),
    identity.proof ? String(identity.proof) : '',
    identity.singleBarrel ? 'sb' : '',
    identity.storePick ? 'sp' : '',
  ]
  return `${parts.join('|')}::${RARITY_CLASSIFIER_VERSION}`
}

export type RaritySuggestionOutcome =
  | { status: 'ready'; suggestion: RaritySuggestion }
  | { status: 'failed' }
  | { status: 'unavailable' }

interface SuggestBottleRarityResult {
  rarity: RaritySuggestion['rarity']
  confidence: RarityConfidence
  reason: string
  normalizedBottleName?: string
  generatedAt: number
  classifierVersion: string
}

function mockSuggestionFor(identity: RarityIdentity): RaritySuggestion {
  return {
    rarity: 'uncommon',
    confidence: 'medium',
    reason: 'Usually findable with some searching — availability varies by region.',
    normalizedBottleName: identity.bottleName,
    identityKey: rarityIdentityKey(identity),
    generatedAt: Date.now(),
    classifierVersion: RARITY_CLASSIFIER_VERSION,
  }
}

// Never throws. Reuses `existing` with zero network calls when it was
// generated for this exact identity and classifier version — this is the
// literal "reuse a valid existing suggestion unless bottle identity
// changes" requirement. Otherwise calls the suggestBottleRarity Cloud
// Function and stamps the result with this identity's key.
export async function requestRaritySuggestion(identity: RarityIdentity, existing?: RaritySuggestion): Promise<RaritySuggestionOutcome> {
  const key = rarityIdentityKey(identity)
  if (existing && existing.identityKey === key && existing.classifierVersion === RARITY_CLASSIFIER_VERSION) {
    return { status: 'ready', suggestion: existing }
  }

  if (isMockAuthEnabled()) {
    return { status: 'ready', suggestion: mockSuggestionFor(identity) }
  }

  try {
    const callable = httpsCallable<
      { bottleName: string; distillery?: string; type?: string; region?: string; ageStatement?: string; proof?: number; singleBarrel?: boolean; storePick?: boolean },
      SuggestBottleRarityResult
    >(functions, 'suggestBottleRarity')
    const result = await callable({
      bottleName: identity.bottleName,
      distillery: identity.distillery,
      type: identity.type,
      region: identity.region,
      ageStatement: identity.ageStatement,
      proof: identity.proof,
      singleBarrel: identity.singleBarrel,
      storePick: identity.storePick,
    })
    const suggestion: RaritySuggestion = { ...result.data, identityKey: key }
    return { status: 'ready', suggestion }
  } catch (err) {
    const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined
    if (code === 'functions/resource-exhausted' || code === 'functions/unavailable' || code === 'functions/deadline-exceeded') {
      console.error('[rarity] suggestion temporarily unavailable', { key, err })
      return { status: 'unavailable' }
    }
    console.error('[rarity] requestRaritySuggestion failed', { key, err })
    return { status: 'failed' }
  }
}
