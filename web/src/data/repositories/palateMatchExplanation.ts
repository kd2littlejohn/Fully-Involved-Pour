import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type { PalateMatchConfidence } from '../../features/palateMatch/scoring'

export interface PalateMatchExplanationInput {
  bottleName: string
  score: number
  confidence: PalateMatchConfidence
  reasons: string[]
}

interface ExplainPalateMatchResult {
  known: boolean
  explanation?: string
}

// Called on-demand only (an explicit "why it fits" action) — not cached,
// not fetched automatically per view. The AI only ever narrates the already-
// computed score + reasons; it never sees raw bottles/pours and can't
// change the number.
export async function explainPalateMatch(input: PalateMatchExplanationInput): Promise<string | null> {
  if (isMockAuthEnabled()) {
    return input.reasons.length > 0
      ? `${input.reasons[0]!.replace(/\.$/, '')}, which is why it lands at ${input.score}% for you.`
      : null
  }

  const callable = httpsCallable<PalateMatchExplanationInput, ExplainPalateMatchResult>(functions, 'explainPalateMatch')
  const result = await callable(input)
  if (!result.data.known || !result.data.explanation) return null
  return result.data.explanation
}
