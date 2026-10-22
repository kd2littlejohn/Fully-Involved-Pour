import type { GoogleLookup } from '../../data/repositories/barcode'

// What Scan Barcode tells the user about the Google step for a barcode FIP
// doesn't know: nothing when Google answered with confidence, otherwise
// why it didn't — skipped (switched off, no key, budget, limit) or failed
// (key rejected, quota, model unavailable, timeout) — so a Google step
// that isn't working never looks like a plain "no match".

const NEXT_STEPS = 'Ask AXE, scan the front label, or enter it yourself.'

const GOOGLE_SKIPPED: Partial<Record<GoogleLookup['status'], string>> = {
  off: 'Google search is turned off in FIP right now.',
  'config-error': 'Google search couldn’t load its settings.',
  'no-key': 'Google search isn’t set up yet (no API key).',
  'app-check': 'Google search couldn’t verify this app.',
  budget: 'Google search has reached this month’s spending limit.',
  'rate-limited': 'You’ve reached the hourly limit for Google searches.',
}

const GOOGLE_FAILED: Record<NonNullable<GoogleLookup['reason']>, string> = {
  'model-unavailable': 'Google’s search model isn’t available to FIP right now.',
  auth: 'Google didn’t accept FIP’s API key.',
  quota: 'Google’s usage limit for FIP has been reached.',
  unavailable: 'Google’s service is temporarily unavailable.',
  'bad-request': 'Google couldn’t process this request.',
  timeout: 'Google took too long to answer.',
  network: 'FIP couldn’t reach its server to search Google.',
  unknown: 'Google search failed.',
}

// What to tell the user about the Google step: nothing while it worked
// with confidence, otherwise why it didn't (never a silent "no match").
// `kind` 'problem' is shown as an error.
export function googleMessage(
  google: GoogleLookup | undefined,
  skipped: GoogleLookup['status'] | 'available' | undefined,
): { text: string; kind: 'info' | 'problem' } | null {
  if (google?.status === 'identified') {
    return google.result?.confidence === 'low'
      ? { text: 'Google isn’t sure about this one. Check it carefully against your label, or ask AXE.', kind: 'info' }
      : null
  }
  if (google?.status === 'not-found') return { text: `Google couldn’t identify this barcode. ${NEXT_STEPS}`, kind: 'info' }
  if (google?.status === 'error') return { text: `${GOOGLE_FAILED[google.reason ?? 'unknown']} ${NEXT_STEPS}`, kind: 'problem' }
  const status = google?.status ?? (skipped && skipped !== 'available' ? skipped : undefined)
  if (!status) return null
  return { text: `${GOOGLE_SKIPPED[status] ?? 'Google search isn’t available right now.'} ${NEXT_STEPS}`, kind: 'problem' }
}

