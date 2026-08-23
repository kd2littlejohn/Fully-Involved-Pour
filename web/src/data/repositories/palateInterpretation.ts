import { doc, getDoc, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type { PalateProfile } from '../../features/yourPalate/palateProfile'

// A small, pre-summarized view of PalateProfile — deliberately excludes the
// nested Bottle object inside `loyalty.mostRepeated` (only its name/count
// travel) and every raw bottle/pour — this is exactly what gets sent to the
// interpretPalateProfile Cloud Function and what the cache is keyed on.
interface PalateProfileSummary {
  qualifyingPourCount: number
  maturity: PalateProfile['maturity']
  topCategory?: string
  topCategoryAverageRating?: number
  proofBucket?: string
  proofAverageRating?: number
  topFlavors: string[]
  mostRepeatedBottleName?: string
  mostRepeatedPourCount?: number
}

interface InterpretPalateProfileResult {
  known: boolean
  interpretation?: string
}

function toPalateProfileSummary(profile: PalateProfile): PalateProfileSummary {
  const top = profile.categoryScores[0]
  return {
    qualifyingPourCount: profile.qualifyingPourCount,
    maturity: profile.maturity,
    topCategory: top?.category,
    topCategoryAverageRating: top?.averageRating,
    proofBucket: profile.proofAffinity?.bucketLabel,
    proofAverageRating: profile.proofAffinity?.averageRating,
    topFlavors: profile.topRatedFlavors.map((f) => f.tag),
    mostRepeatedBottleName: profile.loyalty?.mostRepeated?.bottle.name,
    mostRepeatedPourCount: profile.loyalty?.mostRepeated?.pourCount,
  }
}

// A stable fingerprint of exactly the profile fields the interpretation is
// built from — regenerating only when these meaningfully change, not on
// every render or every minor pour edit.
export function hashPalateProfile(profile: PalateProfile): string {
  const payload = JSON.stringify(toPalateProfileSummary(profile))
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 31 + payload.charCodeAt(i)) | 0
  }
  return hash.toString(36)
}

function mockInterpretationFor(profile: PalateProfile): string {
  const topCategory = profile.categoryScores[0]?.category
  const topFlavor = profile.topRatedFlavors[0]?.tag
  if (topCategory && topFlavor) {
    return `You've been leaning into ${topCategory}, especially pours with real ${topFlavor.toLowerCase()} character.`
  }
  if (topCategory) {
    return `${topCategory} has been your go-to so far.`
  }
  return `FIP is still connecting the dots across your pours — keep logging and patterns will start to show.`
}

// Reads the cached interpretation for this user if the profile hasn't
// meaningfully changed since it was generated; otherwise asks the AI once
// and caches the result. Returns undefined below the maturity floor (not
// enough real data to honestly interpret yet) — callers should simply omit
// the "What FIP Is Learning" block rather than show a guess.
export async function getPalateInterpretation(uid: string, profile: PalateProfile): Promise<string | undefined> {
  if (profile.maturity === 'learning') return undefined

  const profileHash = hashPalateProfile(profile)

  if (isMockAuthEnabled()) {
    return mockInterpretationFor(profile)
  }

  const cachedSnap = await getDoc(doc(db, 'palateInterpretations', uid))
  if (cachedSnap.exists()) {
    const cached = cachedSnap.data() as { text: string; profileHash: string; generatedAt: number }
    if (cached.profileHash === profileHash) return cached.text
  }

  const callable = httpsCallable<PalateProfileSummary, InterpretPalateProfileResult>(functions, 'interpretPalateProfile')
  const result = await callable(toPalateProfileSummary(profile))
  if (!result.data.known || !result.data.interpretation) return undefined

  const text = result.data.interpretation
  try {
    await setDoc(doc(db, 'palateInterpretations', uid), { text, profileHash, generatedAt: Date.now() })
  } catch (err) {
    console.error('[palateInterpretation] caching interpretation failed', { uid, err })
  }

  return text
}
