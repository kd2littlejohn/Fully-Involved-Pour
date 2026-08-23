import { doc, getDoc, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type { Bottle } from '../types'

// Canonical, shared reference content for a bottle — not per-user. Generated
// once (via the generateFipGuide Cloud Function) and cached in Firestore at
// fipGuides/{bottleKey} so every FIP user who owns the same bottle reads the
// same already-generated guide instead of paying for a fresh AI call every
// time the Overview tab opens. See firestore.rules for why this is
// create-only (no update): shared content shouldn't be casually overwritten.
//
// v2 schema (bottleKey suffixed "::v2" — see fipGuideKey) replaces the v1
// whySpecial/bestFor/value/skipIf shape. Old-shape cached docs are simply
// never read again under the new key, so no migration is needed.
export interface FipGuide {
  bottleKey: string
  confidence: 'high' | 'medium' | 'low'
  story: string | null
  special: string[]
  expectSummary: string
  expectFlavors: string[]
  buyIf: string[]
  passIf: string[]
  verdict: string
  availability: string
  intensity: number | null
  generatedAt: number
}

interface GenerateFipGuideResult {
  known: boolean
  story?: string | null
  special?: string[]
  expectSummary?: string
  expectFlavors?: string[]
  buyIf?: string[]
  passIf?: string[]
  verdict?: string
  availability?: string
  intensity?: number | null
}

// Two different bottles' worth of the same product (same name, same
// distillery) share one guide — a slightly different price paid or bottle
// size shouldn't fork the cache. Distillery-less bottles (sourced/undisclosed)
// key on name alone, which is the best "same canonical product" signal
// available without one.
function fipGuideKey(name: string, distillery?: string): string {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const base = normalize(name)
  const distilleryPart = distillery?.trim() ? normalize(distillery) : ''
  const identity = distilleryPart ? `${base}__${distilleryPart}` : base
  return `${identity}::v2`
}

function mashBillText(bottle: Bottle): string | undefined {
  const parts: string[] = []
  if (bottle.mashBillCorn) parts.push(`${bottle.mashBillCorn}% corn`)
  if (bottle.mashBillRyeWheat) parts.push(`${bottle.mashBillRyeWheat}% rye/wheat`)
  if (bottle.mashBillMalted) parts.push(`${bottle.mashBillMalted}% malted barley`)
  return parts.length > 0 ? parts.join(', ') : undefined
}

// Deterministic "how much do we actually know about this bottle" signal —
// computed purely from the bottle's own factual fields, never from the AI's
// own self-reported confidence. The model never sees or influences this.
export function computeFipGuideConfidence(bottle: Bottle): FipGuide['confidence'] {
  const hasDistillery = Boolean(bottle.distillery?.trim())
  const hasType = Boolean(bottle.type?.trim())
  const supportingCount = [bottle.proof, bottle.ageStatement, mashBillText(bottle), bottle.msrp].filter(Boolean).length
  if (hasDistillery && hasType && supportingCount >= 2) return 'high'
  if (hasDistillery || hasType) return 'medium'
  return 'low'
}

const mockGuides = new Map<string, FipGuide>()

function mockGuideFor(key: string, bottle: Bottle): FipGuide {
  return {
    bottleKey: key,
    confidence: computeFipGuideConfidence(bottle),
    story: 'A steady favorite among bourbon drinkers for its balance of price and pour-ability.',
    special: [
      bottle.ageStatement ? `${bottle.ageStatement} age statement` : 'A consistent, well-regarded release',
      bottle.distillery ? `Produced by ${bottle.distillery}` : 'A dependable everyday pour',
    ],
    expectSummary: 'Balanced sweetness with classic oak and vanilla notes.',
    expectFlavors: ['Caramel', 'Vanilla', 'Oak'],
    buyIf: ['You want a dependable bottle for regular pours.'],
    passIf: ['You are chasing something more experimental.'],
    verdict: 'Worth having in the rotation.',
    availability: 'Widely Available',
    intensity: 0.5,
    generatedAt: Date.now(),
  }
}

// Reads the cached guide if one already exists; otherwise asks the AI once
// and caches the result for every future reader. Returns undefined when the
// bottle isn't confidently recognized or the name is too short to search on
// — callers should simply omit the FIP Guide section rather than show
// nothing/loading forever.
export async function getFipGuide(bottle: Bottle): Promise<FipGuide | undefined> {
  const name = bottle.name.trim()
  if (name.length < 3) return undefined
  const key = fipGuideKey(name, bottle.distillery)

  if (isMockAuthEnabled()) {
    const cached = mockGuides.get(key)
    if (cached) return cached
    const guide = mockGuideFor(key, bottle)
    mockGuides.set(key, guide)
    return guide
  }

  const cachedSnap = await getDoc(doc(db, 'fipGuides', key))
  if (cachedSnap.exists()) return cachedSnap.data() as FipGuide

  const callable = httpsCallable<
    { bottleName: string; distillery?: string; type?: string; proof?: number; ageStatement?: string; mashBill?: string; msrp?: number },
    GenerateFipGuideResult
  >(functions, 'generateFipGuide')
  const result = await callable({
    bottleName: name,
    distillery: bottle.distillery,
    type: bottle.type,
    proof: bottle.proof,
    ageStatement: bottle.ageStatement,
    mashBill: mashBillText(bottle),
    msrp: bottle.msrp,
  })

  if (!result.data.known) return undefined

  const guide: FipGuide = {
    bottleKey: key,
    confidence: computeFipGuideConfidence(bottle),
    story: result.data.story ?? null,
    special: result.data.special ?? [],
    expectSummary: result.data.expectSummary ?? '',
    expectFlavors: result.data.expectFlavors ?? [],
    buyIf: result.data.buyIf ?? [],
    passIf: result.data.passIf ?? [],
    verdict: result.data.verdict ?? '',
    availability: result.data.availability ?? '',
    intensity: result.data.intensity ?? null,
    generatedAt: Date.now(),
  }

  try {
    await setDoc(doc(db, 'fipGuides', key), guide)
  } catch (err) {
    // Another client may have cached it first (rules make this create-only,
    // so a genuine race just means someone beat us to it) — either way this
    // view already has a perfectly good guide to show, just not persisted
    // from here.
    console.error('[fipGuide] caching new guide failed', { key, err })
  }

  return guide
}
