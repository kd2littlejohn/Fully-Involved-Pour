import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { isMockAuthEnabled } from '../devMode'

export interface PourRecommendationExplanationInput {
  bottleName: string
  distillery?: string
  type?: string
  moodLabel: string
  reasons: string[]
  tags: string[]
}

interface ExplainPourRecommendationResult {
  known: boolean
  explanation?: string
}

// Called only once a recommendation is actually revealed (never proactively,
// never for every candidate scored) — the deterministic reasons already
// render immediately, this just narrates them more naturally once it
// resolves. Never blocks the reveal itself.
export async function explainPourRecommendation(input: PourRecommendationExplanationInput): Promise<string | null> {
  if (isMockAuthEnabled()) {
    return `${input.moodLabel} calls for ${input.bottleName} tonight — ${(input.reasons[0] ?? 'it fits the moment').toLowerCase()}`
  }

  const callable = httpsCallable<PourRecommendationExplanationInput, ExplainPourRecommendationResult>(functions, 'explainPourRecommendation')
  const result = await callable(input)
  if (!result.data.known || !result.data.explanation) return null
  return result.data.explanation
}
