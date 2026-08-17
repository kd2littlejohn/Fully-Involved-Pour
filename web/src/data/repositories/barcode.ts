import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'
import { isMockAuthEnabled } from '../devMode'

// Mirrors LabelScanResult's shape (data/repositories/ai.ts) on purpose —
// both feed the exact same "prefill the Add Bottle form" consumer, so
// keeping the fields identical means AddBottlePage can treat a barcode
// match and a label scan match interchangeably.
export interface BarcodeLookupResult {
  found: boolean
  upc: string
  name?: string
  distillery?: string
  type?: string
  proof?: number
  ageStatement?: string
  imageUrl?: string
}

export interface CatalogBottleInput {
  name: string
  distillery?: string
  type?: string
  proof?: number
  ageStatement?: string
  imageUrl?: string
}

const LOOKUP_TIMEOUT_MS = 15000

export class BarcodeLookupTimeoutError extends Error {
  constructor() {
    super('The barcode lookup is taking too long.')
    this.name = 'BarcodeLookupTimeoutError'
  }
}

// Step 1 of the scan flow — a fast, free, public-read direct Firestore
// lookup against what other users (or this user, on a prior scan) have
// already confirmed. Only when this misses does the flow fall through to
// the slower, secret-gated lookupBottleByBarcode below (see
// AddBottlePage.tsx). Never throws on a miss — undefined just means
// "nothing cached yet," not an error.
export async function findBottleByUpc(upc: string): Promise<BarcodeLookupResult | undefined> {
  if (isMockAuthEnabled()) {
    if (upc === '000000000000') {
      return {
        found: true,
        upc,
        name: 'Eagle Rare 10 Year',
        distillery: 'Buffalo Trace',
        type: 'Bourbon',
        proof: 90,
        ageStatement: '10 Year',
      }
    }
    return undefined
  }
  const snap = await getDoc(doc(db, 'bottleCatalog', upc))
  if (!snap.exists()) return undefined
  const data = snap.data() as Partial<CatalogBottleInput>
  return {
    found: true,
    upc,
    name: data.name,
    distillery: data.distillery,
    type: data.type,
    proof: data.proof,
    ageStatement: data.ageStatement,
    imageUrl: data.imageUrl,
  }
}

// Step 2 — only reached once findBottleByUpc has already missed. Calls the
// external UPC lookup service through a Cloud Function so its API key never
// reaches the client (see functions/index.js). Races a client-side timeout
// separate from the function's own server-side one, since a network issue
// reaching Cloud Functions at all wouldn't otherwise surface as a timeout —
// it'd just hang.
export async function lookupBottleByBarcode(upc: string): Promise<BarcodeLookupResult> {
  if (isMockAuthEnabled()) {
    if (upc === '111111111111') {
      return {
        found: true,
        upc,
        name: 'Stagg Jr.',
        distillery: 'Buffalo Trace',
        type: 'Bourbon',
        proof: 128,
      }
    }
    return { found: false, upc }
  }
  const callable = httpsCallable<{ upc: string }, BarcodeLookupResult>(functions, 'lookupBottleByBarcode')
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new BarcodeLookupTimeoutError()), LOOKUP_TIMEOUT_MS)
  })
  const result = await Promise.race([callable({ upc }), timeout])
  return result.data
}

// Fire-and-forget from the caller's point of view (AddBottlePage swallows
// failures here — a failed catalog contribution should never block or fail
// the user's own "Add Bottle" save). Only ever called once a human has
// confirmed the UPC is correct: from "Add to My Bar" on the review screen,
// or from finishing the form manually after an unknown-UPC scan. Never
// called automatically just because an external lookup returned a result.
export async function saveBottleToCatalog(upc: string, bottle: CatalogBottleInput): Promise<void> {
  if (isMockAuthEnabled()) return
  const callable = httpsCallable<{ upc: string; bottle: CatalogBottleInput }, { saved: boolean }>(
    functions,
    'saveBottleToCatalog',
  )
  await callable({ upc, bottle })
}
