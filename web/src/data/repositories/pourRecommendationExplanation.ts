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
    // Dev-preview placeholder only. Home passes moodLabel "tonight", which
    // read as "tonight calls for X tonight".
    const lead = input.moodLabel === 'tonight' ? `${input.bottleName} fits tonight` : `${input.moodLabel} calls for ${input.bottleName} tonight`
    return `${lead} — ${(input.reasons[0] ?? 'it fits the moment').toLowerCase()}`
  }

  const callable = httpsCallable<PourRecommendationExplanationInput, ExplainPourRecommendationResult>(functions, 'explainPourRecommendation')
  const result = await callable(input)
  if (!result.data.known || !result.data.explanation) return null
  return result.data.explanation
}
