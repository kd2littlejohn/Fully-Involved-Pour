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
export interface FipGuide {
  bottleKey: string
  whySpecial: string
  bestFor: string
  value: string
  buyIf: string
  skipIf: string
  verdict: string
  story: string
  availability: string
  flavorProfile: string[]
  intensity: number | null
  generatedAt: number
}

interface GenerateFipGuideResult {
  known: boolean
  whySpecial?: string
  bestFor?: string
  value?: string
  buyIf?: string
  skipIf?: string
  verdict?: string
  story?: string
  availability?: string
  flavorProfile?: string[]
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
  return distilleryPart ? `${base}__${distilleryPart}` : base
}

function mashBillText(bottle: Bottle): string | undefined {
  const parts: string[] = []
  if (bottle.mashBillCorn) parts.push(`${bottle.mashBillCorn}% corn`)
  if (bottle.mashBillRyeWheat) parts.push(`${bottle.mashBillRyeWheat}% rye/wheat`)
  if (bottle.mashBillMalted) parts.push(`${bottle.mashBillMalted}% malted barley`)
  return parts.length > 0 ? parts.join(', ') : undefined
}

const mockGuides = new Map<string, FipGuide>()

function mockGuideFor(key: string, bottle: Bottle): FipGuide {
  return {
    bottleKey: key,
    whySpecial: `${bottle.ageStatement ? `${bottle.ageStatement} ` : ''}${bottle.distillery ? `from ${bottle.distillery}` : 'A well-regarded pour'}.`.trim(),
    bestFor: 'Drinkers who enjoy a classic, well-balanced profile.',
    value: bottle.msrp ? 'Fair at MSRP.' : 'Value depends on what you pay.',
    buyIf: 'You want a dependable bottle for regular pours.',
    skipIf: 'You are chasing something more experimental.',
    verdict: 'Worth having in the rotation.',
    story: 'A steady favorite among bourbon drinkers for its balance of price and pour-ability.',
    availability: 'Widely Available',
    flavorProfile: ['Caramel', 'Vanilla', 'Oak'],
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
    whySpecial: result.data.whySpecial ?? '',
    bestFor: result.data.bestFor ?? '',
    value: result.data.value ?? '',
    buyIf: result.data.buyIf ?? '',
    skipIf: result.data.skipIf ?? '',
    verdict: result.data.verdict ?? '',
    story: result.data.story ?? '',
    availability: result.data.availability ?? '',
    flavorProfile: result.data.flavorProfile ?? [],
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
