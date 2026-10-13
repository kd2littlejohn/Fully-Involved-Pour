import { useState } from 'react'
import type { Bottle, Memory, Pour } from '../../../data/types'
import type { BottlePatch } from '../../../hooks/useUserData'
import { YourTakeCard } from '../../../features/bottleDetails/YourTakeCard'
import type { PourHistorySummary } from '../../../features/bottleDetails/selectors'
import { JourneyTab } from './JourneyTab'
import { PourStoriesTab } from './PourStoriesTab'
import styles from './YourTakeTab.module.css'

interface YourTakeTabProps {
  bottle: Bottle
  pours: Pour[]
  memories: Memory[]
  score: number | undefined
  scoreDate?: string
  pourHistory: PourHistorySummary
  onUpdate: (patch: BottlePatch) => void
  history: HistoryView
  onHistoryChange: (view: HistoryView) => void
}

export type HistoryView = 'journey' | 'pour-stories'

// Your Take: the editable verdict (rating, buy again, replace), then the
// tasting history behind it — the bottle's Journey timeline or the full
// list of Pour Stories, unchanged from their former tabs.
export function YourTakeTab({ bottle, pours, memories, score, scoreDate, pourHistory, onUpdate, history, onHistoryChange }: YourTakeTabProps) {
  const [historyEl, setHistoryEl] = useState<HTMLElement | null>(null)

  function show(view: HistoryView) {
    onHistoryChange(view)
    historyEl?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <YourTakeCard
        bottle={bottle}
        score={score}
        scoreDate={scoreDate}
        pourHistory={pourHistory}
        onUpdate={onUpdate}
        onViewJourney={() => show('journey')}
      />

      <section ref={setHistoryEl} className={styles.history} aria-labelledby="tasting-history-title">
        <div className={styles.historyHeader}>
          <h3 id="tasting-history-title" className={styles.heading}>
            Tasting History
          </h3>
          <div className={styles.switcher} role="group" aria-label="Tasting history view">
            <button
              type="button"
              className={history === 'journey' ? `${styles.switch} ${styles.switchActive}` : styles.switch}
              aria-pressed={history === 'journey'}
              onClick={() => onHistoryChange('journey')}
            >
              Journey
            </button>
            <button
              type="button"
              className={history === 'pour-stories' ? `${styles.switch} ${styles.switchActive}` : styles.switch}
              aria-pressed={history === 'pour-stories'}
              onClick={() => onHistoryChange('pour-stories')}
            >
              Pour Stories
            </button>
          </div>
        </div>

        {history === 'journey' ? (
          <JourneyTab bottle={bottle} pours={pours} memories={memories} onViewAllPours={() => show('pour-stories')} />
        ) : (
          <PourStoriesTab bottle={bottle} pours={pours} />
        )}
      </section>
    </>
  )
}
