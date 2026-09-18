import type { RaritySuggestionOutcome } from '../../data/repositories/rarity'

export const BULK_PARTIAL_FAILURE_MESSAGE = 'Some bottles could not be classified.'

// The 4 required nontechnical messages — never a raw error code/message.
export function rarityErrorMessage(outcome: RaritySuggestionOutcome): string | null {
  if (outcome.status === 'failed') return "We couldn't suggest a rarity for this bottle."
  if (outcome.status === 'unavailable') return 'Rarity suggestions are temporarily unavailable.'
  if (outcome.status === 'ready' && outcome.suggestion.rarity === null) return 'This bottle needs your review.'
  return null
}
