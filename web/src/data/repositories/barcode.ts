import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'

// Scan Barcode proof of concept — client side of functions/barcode/lookup.js.
// The server decides the order: FIP-verified candidates and this user's own
// saved entries first, and AXE (Claude) only when the user asks for it.

export type ReleaseKind = 'standard' | 'barrel-proof-batch' | 'single-barrel' | 'store-pick' | 'limited-release'

export interface BarcodeBottle {
  name: string
  distillery: string | null
  brand: string | null
  expression: string | null
  category: string | null
  sizeMl: number | null
  /** Set only when this release has one known proof. */
  proof: number | null
  proofVaries: boolean
  ageStatement: string | null
  releaseKind: ReleaseKind | null
  /** Only ever set by an administrator-verified candidate or by the user. */
  batch: string | null
  barrel: string | null
  storePick: string | null
  releaseYear: number | null
}

export interface VerifiedCandidate extends BarcodeBottle {
  id: string
}

export type EntryOrigin = 'verified' | 'axe-barcode' | 'axe-label' | 'manual'

export interface YourEntry {
  entryId: string
  origin: EntryOrigin
  candidateId: string | null
  bottleId: string | null
  submitForReview: boolean
  bottle: BarcodeBottle
}

export interface AxeCandidate {
  id: string
  name: string
  distillery: string | null
  brand: string | null
  expression: string | null
  category: string | null
  sizeMl: number | null
  releaseKind: ReleaseKind
  proof: number | null
  proofVaries: boolean
  ageStatement: string | null
  notes: string | null
}

/** Exactly what AXE read on the photographed label — about this bottle only. */
export interface LabelReading {
  name: string | null
  distillery: string | null
  proof: number | null
  batch: string | null
  barrel: string | null
  storePick: string | null
  ageStatement: string | null
  sizeMl: number | null
}

export interface AxeSuggestion {
  identified: boolean
  candidates: AxeCandidate[]
  upcSharedAcrossVariants: boolean
  confidence: 'low' | 'medium' | 'high'
  sources: { url: string; title: string | null }[]
  notes: string | null
  label: LabelReading | null
  /** True when this reused a recent suggestion for the same barcode (no new AI cost). */
  cached: boolean
}

export type LookupStatus = 'matched' | 'no-match' | 'suggested' | 'not-found' | 'restricted'

export interface BarcodeLookupResult {
  gtin13: string
  upcA: string | null
  symbology: string
  status: LookupStatus
  verified: VerifiedCandidate[]
  yours: YourEntry[]
  axe?: AxeSuggestion
  latencyMs?: number
  costUsd?: number | null
  model?: string
}

export interface LabelScanResult {
  gtin13: string | null
  status: 'suggested' | 'not-found'
  axe: AxeSuggestion
  latencyMs?: number
  costUsd?: number | null
  model?: string
}

export async function lookupBarcode(barcode: string, options: { useAxe?: boolean } = {}): Promise<BarcodeLookupResult> {
  const callable = httpsCallable<{ barcode: string; useAxe?: boolean }, BarcodeLookupResult>(functions, 'lookupBarcode')
  return (await callable({ barcode, useAxe: options.useAxe })).data
}

export async function identifyBottleLabel(input: {
  barcode: string | null
  imageBase64: string
  mediaType: string
}): Promise<LabelScanResult> {
  const callable = httpsCallable<{ barcode?: string; imageBase64: string; mediaType: string }, LabelScanResult>(
    functions,
    'identifyBottleLabel',
  )
  return (await callable({ barcode: input.barcode ?? undefined, imageBase64: input.imageBase64, mediaType: input.mediaType })).data
}

// Saves what this user says the barcode is, privately (see firestore.rules
// users/{uid}/barcodeEntries). `submitForReview` only asks an administrator
// to consider it for the shared catalog; nothing becomes shared until they
// verify it.
export async function saveBarcodeEntry(
  uid: string,
  entry: {
    gtin13: string
    bottle: BarcodeBottle
    origin: EntryOrigin
    candidateId?: string | null
    bottleId?: string | null
    submitForReview: boolean
  },
): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'barcodeEntries'), {
    gtin13: entry.gtin13,
    bottle: entry.bottle,
    origin: entry.origin,
    candidateId: entry.candidateId ?? null,
    bottleId: entry.bottleId ?? null,
    submitForReview: entry.submitForReview,
    createdAt: serverTimestamp(),
  })
  return ref.id
}
