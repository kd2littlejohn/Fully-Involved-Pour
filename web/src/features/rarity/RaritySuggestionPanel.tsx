import type { RaritySuggestion } from '../../data/types'
import { Button } from '../../components/ui/Button'
import { RARITY_LABEL, CONFIDENCE_LABEL } from './rarityLevels'
import { rarityErrorMessage } from './rarityErrors'
import type { RaritySuggestionOutcome } from '../../data/repositories/rarity'
import styles from './RaritySuggestionPanel.module.css'

export type RaritySuggestionPanelState = 'idle' | 'loading' | 'ready' | 'failed' | 'unavailable'

interface RaritySuggestionPanelProps {
  state: RaritySuggestionPanelState
  suggestion?: RaritySuggestion
  busy?: boolean
  onAccept: () => void
  onChoose: () => void
  onRefresh?: () => void
}

// Shared between the Add/Edit form's RarityFieldsCard and the bulk
// RarityReviewPage, modeled on Friends' RecommendationCard — an AI
// proposal the owner must explicitly accept or change, never silently
// confirmed. 'idle' renders nothing (no suggestion requested/available
// yet); every other state shows something.
export function RaritySuggestionPanel({ state, suggestion, busy, onAccept, onChoose, onRefresh }: RaritySuggestionPanelProps) {
  if (state === 'idle') return null

  if (state === 'loading') {
    return <p className={styles.status}>Looking at this bottle…</p>
  }

  if (state === 'failed' || state === 'unavailable') {
    const message = rarityErrorMessage(state === 'failed' ? { status: 'failed' } : { status: 'unavailable' })
    return (
      <div className={styles.panel}>
        <p className={styles.error}>{message}</p>
        {onRefresh ? (
          <Button variant="ghost" onClick={onRefresh} disabled={busy}>
            Try Again
          </Button>
        ) : null}
      </div>
    )
  }

  // state === 'ready'
  if (!suggestion) return null

  if (suggestion.rarity === null) {
    return (
      <div className={styles.panel}>
        <p className={styles.status}>{rarityErrorMessage({ status: 'ready', suggestion })}</p>
        <Button variant="ghost" onClick={onChoose} disabled={busy}>
          Choose a Rarity
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <p className={styles.suggested}>
        Suggested: <strong>{RARITY_LABEL[suggestion.rarity]}</strong> · {CONFIDENCE_LABEL[suggestion.confidence]} confidence
      </p>
      <p className={styles.reason}>{suggestion.reason}</p>
      <div className={styles.actions}>
        <Button onClick={onAccept} disabled={busy}>
          Accept Suggestion
        </Button>
        <Button variant="ghost" onClick={onChoose} disabled={busy}>
          Choose Different Rarity
        </Button>
      </div>
    </div>
  )
}

export type { RaritySuggestionOutcome }
