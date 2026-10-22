import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'

// Scan Barcode proof of concept — client side of functions/barcode/lookup.js.
// Lookup order is decided server-side: administrator-verified mapping, then
// this user's own confirmation, then Claude + web search.

export interface BarcodeBottle {
  name: string | null
  distillery: string | null
  brand: string | null
  expression: string | null
  category: string | null
  sizeMl: number | null
  /** Only ever set for a product line bottled at one fixed proof. */
  proof: number | null
  proofVaries: boolean
  ageStatement: string | null
  upcSharedAcrossVariants: boolean
  confidence?: 'low' | 'medium' | 'high'
  sources?: { url: string; title: string | null }[]
  notes?: string | null
}

export type BarcodeLookupSource = 'verified' | 'your-confirmation' | 'ai' | 'not-found' | 'unknown' | 'restricted'

export interface BarcodeLookupResult {
  gtin13: string
  upcA: string | null
  symbology: string
  source: BarcodeLookupSource
  bottle?: BarcodeBottle
  bottleId?: string | null
  latencyMs?: number
  model?: string
}

export async function lookupBarcode(barcode: string, options: { skipAi?: boolean } = {}): Promise<BarcodeLookupResult> {
  const callable = httpsCallable<{ barcode: string; skipAi?: boolean }, BarcodeLookupResult>(functions, 'lookupBarcode')
  const result = await callable({ barcode, skipAi: options.skipAi })
  return result.data
}

export type ConfirmationOrigin = 'verified' | 'ai-claude' | 'ai-gemini' | 'manual'

export interface BarcodeConfirmation {
  name: string
  distillery?: string | null
  brand?: string | null
  expression?: string | null
  category?: string | null
  sizeMl?: number | null
  proof?: number | null
  proofVaries?: boolean
  ageStatement?: string | null
  upcSharedAcrossVariants?: boolean
  /** The bottle in this user's bar it was saved as, once Phase 1 saves it. */
  bottleId?: string
}

// Saves what this user confirmed (or corrected) the barcode to be. Private
// to them (see firestore.rules upcConfirmations) — it never becomes another
// user's answer unless an administrator verifies it into upcMappings.
export async function saveBarcodeConfirmation(
  uid: string,
  gtin13: string,
  confirmation: BarcodeConfirmation,
  origin: ConfirmationOrigin,
): Promise<void> {
  await setDoc(doc(db, 'upcConfirmations', gtin13, 'confirmedBy', uid), {
    gtin13,
    ...confirmation,
    origin,
    confirmedAt: serverTimestamp(),
  })
}
