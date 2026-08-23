import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { isMockAuthEnabled } from '../devMode'

export interface SommelierTurn {
  role: 'user' | 'assistant'
  content: string
}

// Same 7 Cloud Functions the live app calls (functions/index.js) — untouched
// on the backend. Dev-mode mock sessions have no real Firebase Auth ID token,
// so calling these for real would just fail with "unauthenticated"; return
// canned responses instead so the UI flow stays testable without real
// Anthropic API cost.

export async function askSommelier(prompt: string, history: SommelierTurn[], collectionSummary: string): Promise<string> {
  if (isMockAuthEnabled()) {
    return "That sounds like a great pour. Based on what's in your collection, I'd reach for something with a bit more oak and spice next — but trust your own palate over mine."
  }
  const callable = httpsCallable<{ prompt: string; history: SommelierTurn[]; collectionSummary: string }, { reply: string }>(
    functions,
    'askSommelier',
  )
  const result = await callable({ prompt, history, collectionSummary })
  return result.data.reply
}

export interface BottleLookupResult {
  known: boolean
  distillery?: string
  type?: string
  region?: string
  proof?: number
  ageStatement?: string
  mashBillCorn?: number
  mashBillRyeWheat?: number
  mashBillMalted?: number
}

export async function lookupBottleInfo(bottleName: string): Promise<BottleLookupResult> {
  if (isMockAuthEnabled()) {
    return { known: false }
  }
  const callable = httpsCallable<{ bottleName: string }, BottleLookupResult>(functions, 'lookupBottleInfo')
  const result = await callable({ bottleName })
  return result.data
}

export interface TastingProfileInput {
  bottleName: string
  distillery?: string
  type?: string
  proof?: number
  flavors?: string[]
}

export interface TastingProfileResult {
  nose: string
  palate: string
  finish: string
  flavors: string[]
}

export async function generateTastingProfile(input: TastingProfileInput): Promise<TastingProfileResult> {
  if (isMockAuthEnabled()) {
    return {
      nose: 'Caramel, oak, and a hint of dried cherry.',
      palate: 'Sweet entry with baking spice and vanilla.',
      finish: 'Medium-long, warm, with a lingering oak note.',
      flavors: ['caramel', 'oak', 'vanilla', 'cherry'],
    }
  }
  const callable = httpsCallable<TastingProfileInput, TastingProfileResult>(functions, 'generateTastingProfile')
  const result = await callable(input)
  return result.data
}

export interface LabelScanResult {
  found: boolean
  name?: string
  distillery?: string
  type?: string
  region?: string
  proof?: number
  ageStatement?: string
  msrp?: number
}

export async function scanBottleLabel(imageBase64: string, mediaType: string): Promise<LabelScanResult> {
  if (isMockAuthEnabled()) {
    return {
      found: true,
      name: 'Eagle Rare 10 Year',
      distillery: 'Buffalo Trace',
      type: 'Bourbon',
      region: 'Kentucky',
      proof: 90,
      ageStatement: '10 Year',
      msrp: 40,
    }
  }
  const callable = httpsCallable<{ imageBase64: string; mediaType: string }, LabelScanResult>(functions, 'scanBottleLabel')
  const result = await callable({ imageBase64, mediaType })
  return result.data
}

export interface DistilleryInfoResult {
  known: boolean
  location?: string
  founded?: number
  parentCompany?: string
  description?: string
}

export async function lookupDistillery(distilleryName: string): Promise<DistilleryInfoResult> {
  if (isMockAuthEnabled()) {
    return {
      known: true,
      location: 'Frankfort, Kentucky',
      founded: 1857,
      parentCompany: 'Sazerac Company',
      description: 'One of the oldest continuously operating distilleries in the US, known for its high-rye and wheated bourbon mash bills.',
    }
  }
  const callable = httpsCallable<{ distilleryName: string }, DistilleryInfoResult>(functions, 'lookupDistillery')
  const result = await callable({ distilleryName })
  return result.data
}

export interface RecommendedBottle {
  name: string
  distillery: string
  type: string
  reason: string
}

export async function recommendBottles(collectionSummary: string): Promise<RecommendedBottle[]> {
  if (isMockAuthEnabled()) {
    return [
      {
        name: 'Elijah Craig Barrel Proof',
        distillery: 'Heaven Hill',
        type: 'Bourbon',
        reason: 'Your top-rated bottles lean toward high-proof, oak-forward bourbons.',
      },
      {
        name: 'Redbreast 12',
        distillery: 'Midleton',
        type: 'Irish',
        reason: 'A rich, sherry-cask Irish pot still worth trying alongside your bourbon collection.',
      },
    ]
  }
  const callable = httpsCallable<{ collectionSummary: string }, { recommendations: RecommendedBottle[] }>(
    functions,
    'recommendBottles',
  )
  const result = await callable({ collectionSummary })
  return result.data.recommendations
}

export async function removeBottleBackground(imageBase64: string): Promise<string> {
  if (isMockAuthEnabled()) {
    return imageBase64
  }
  const callable = httpsCallable<{ imageBase64: string }, { imageBase64: string }>(functions, 'removeBottleBackground')
  const result = await callable({ imageBase64 })
  return result.data.imageBase64
}
