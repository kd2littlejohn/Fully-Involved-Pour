import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { isMockAuthEnabled } from '../devMode'

export interface TastingSummaryInput {
  noseAromas: string[]
  noseNotes?: string
  palateFlavors: string[]
  palateNotes?: string
  finishNotes?: string
  rating: number
}

interface GenerateTastingSummaryResult {
  known: boolean
  summary?: string
}

function hasTastingContent(input: TastingSummaryInput): boolean {
  return (
    input.noseAromas.length > 0 ||
    input.palateFlavors.length > 0 ||
    Boolean(input.noseNotes?.trim()) ||
    Boolean(input.palateNotes?.trim()) ||
    Boolean(input.finishNotes?.trim())
  )
}

// A stable fingerprint of exactly the tasting-note fields the AI summary is
// built from — used to skip regenerating when nothing tasting-relevant
// actually changed (e.g. the user only edited location, mood, or ounces).
export function hashTastingInput(input: TastingSummaryInput): string {
  const payload = JSON.stringify({
    noseAromas: [...input.noseAromas].sort(),
    noseNotes: input.noseNotes ?? '',
    palateFlavors: [...input.palateFlavors].sort(),
    palateNotes: input.palateNotes ?? '',
    finishNotes: input.finishNotes ?? '',
    rating: input.rating,
  })
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 31 + payload.charCodeAt(i)) | 0
  }
  return hash.toString(36)
}

const mockSummaries = new Map<string, string>()

function mockSummaryFor(input: TastingSummaryInput): string {
  const tags = [...input.noseAromas, ...input.palateFlavors].slice(0, 3)
  return tags.length > 0
    ? `You picked up on ${tags.join(', ').toLowerCase()}, landing at ${input.rating.toFixed(1)}.`
    : 'A pour worth remembering, by the sound of your notes.'
}

// Reflects only the tasting notes/tags the user actually entered into one
// short paragraph — never invents a flavor they didn't mention. Returns null
// when there's nothing meaningful to summarize (no tags, no notes) or the AI
// declines to produce one, without ever blocking a pour save on this result.
export async function generateTastingSummary(input: TastingSummaryInput): Promise<string | null> {
  if (!hasTastingContent(input)) return null

  if (isMockAuthEnabled()) {
    const key = hashTastingInput(input)
    const cached = mockSummaries.get(key)
    if (cached) return cached
    const summary = mockSummaryFor(input)
    mockSummaries.set(key, summary)
    return summary
  }

  const callable = httpsCallable<TastingSummaryInput, GenerateTastingSummaryResult>(functions, 'generateTastingSummary')
  const result = await callable(input)
  if (!result.data.known || !result.data.summary) return null
  return result.data.summary
}
