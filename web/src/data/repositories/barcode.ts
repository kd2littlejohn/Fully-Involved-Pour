import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'

// Scan Barcode — client side of functions/barcode/lookup.js. The order:
// FIP-verified candidates and this user's own saved entries first; Google
// (Gemini + Search grounding) for a barcode they don't cover; AXE (Claude)
// when the user asks after Google couldn't identify it.

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

/** 'google' is never saved as a barcode entry (Google's terms); it only labels a hand-off. */
export type EntryOrigin = 'verified' | 'axe-barcode' | 'axe-label' | 'manual' | 'google'

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

/**
 * Google's answer for an unknown barcode. Anything but 'identified' /
 * 'not-found' means Google wasn't asked (switched off, over budget or the
 * hourly limit, App Check missing) or failed — the app offers AXE instead.
 */
export type GoogleStatus = 'identified' | 'not-found' | 'off' | 'budget' | 'rate-limited' | 'app-check' | 'error'

export interface GoogleLookup {
  status: GoogleStatus
  /** Same shape as an AXE suggestion; sources are Google's own grounding links. */
  result?: Omit<AxeSuggestion, 'cached'>
  /** Google Search Suggestions (HTML) — must be shown with the result. */
  searchEntryPoint?: string | null
  latencyMs?: number
  costUsd?: number | null
  model?: string
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
  /** Plain lookup only: whether the app should ask Google next. */
  googleAvailable?: boolean
  google?: GoogleLookup
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

type LookupRequest = { barcode: string; useAxe?: boolean; useGoogle?: boolean }

export async function lookupBarcode(barcode: string, options: { useAxe?: boolean } = {}): Promise<BarcodeLookupResult> {
  const callable = httpsCallable<LookupRequest, BarcodeLookupResult>(functions, 'lookupBarcode')
  return (await callable({ barcode, useAxe: options.useAxe })).data
}

// Rescanning the same bottle while the app is open shouldn't ask Google
// again. Kept in memory only, for this tab and a short while, so it is just
// the answer already shown to this user — never stored.
const GOOGLE_SESSION_MS = 30 * 60 * 1000
const googleThisSession = new Map<string, { at: number; result: BarcodeLookupResult }>()

export function clearGoogleSessionMemory(): void {
  googleThisSession.clear()
}

export async function lookupBarcodeWithGoogle(gtin13: string): Promise<BarcodeLookupResult> {
  const remembered = googleThisSession.get(gtin13)
  if (remembered && Date.now() - remembered.at < GOOGLE_SESSION_MS) return remembered.result
  const callable = httpsCallable<LookupRequest, BarcodeLookupResult>(functions, 'lookupBarcode')
  const result = (await callable({ barcode: gtin13, useGoogle: true })).data
  // Only answers Google actually gave; a skipped or failed call can be retried.
  if (result.google?.status === 'identified' || result.google?.status === 'not-found') {
    googleThisSession.set(gtin13, { at: Date.now(), result })
  }
  return result
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
// verify it. A bottle identified by Google is never saved here: Google's
// terms don't allow storing its grounded results or building on them.
export async function saveBarcodeEntry(
  uid: string,
  entry: {
    gtin13: string
    bottle: BarcodeBottle
    origin: Exclude<EntryOrigin, 'google'>
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
