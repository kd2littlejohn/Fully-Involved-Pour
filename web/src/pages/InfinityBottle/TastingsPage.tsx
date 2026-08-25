import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { InfinityBottleHeader } from '../../features/infinityBottle/InfinityBottleHeader'
import { ScoreEvolutionChart } from '../../features/infinityBottle/ScoreEvolutionChart'
import { TastingDetailModal } from '../../features/infinityBottle/TastingDetailModal'
import { averageScore, batchDisplayName, currentScore, scoreEvolution, sortedTastings } from '../../features/infinityBottle/selectors'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { fipTier } from '../../features/fip/tiers'
import { useUserData } from '../../hooks/useUserData'
import type { InfinityTasting } from '../../data/types'
import styles from './TastingsPage.module.css'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function TastingsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { userDoc } = useUserData()
  const [selected, setSelected] = useState<InfinityTasting | null>(null)

  const ib = userDoc.infinityBottles.find((b) => b.id === id)
  const batch = ib?.batches[ib.batches.length - 1]

  if (!ib || !batch) {
    return (
      <div className={styles.page}>
        <InfinityBottleHeader backTo="/collection/infinity" title="Tastings" />
        <div className={styles.body}>
          <EmptyState title="We couldn't find that Infinity Bottle." message="It may have been deleted." />
        </div>
      </div>
    )
  }

  const tastings = [...sortedTastings(batch)].reverse()
  const current = currentScore(batch)
  const average = averageScore(batch)

  return (
    <div className={styles.page}>
      <InfinityBottleHeader backTo={`/collection/infinity/${ib.id}`} title="Tastings" />

      <div className={styles.body}>
        <h2 className={styles.batchName}>{batchDisplayName(ib, batch)}</h2>

        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statValue} style={{ color: current != null ? fipTier(current).color : undefined }}>
              {current != null ? current.toFixed(1) : '—'}
            </div>
            <div className={styles.statLabel}>Current Score</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{average != null ? average.toFixed(1) : '—'}</div>
            <div className={styles.statLabel}>Avg Score</div>
          </div>
        </div>

        {scoreEvolution(batch).length >= 2 ? <ScoreEvolutionChart points={scoreEvolution(batch)} /> : null}

        <Button onClick={() => navigate(`/collection/infinity/${ib.id}/tastings/new`)} className={styles.logButton}>
          Log New Tasting
        </Button>

        <h3 className={styles.heading}>Tasting History</h3>
        {tastings.length === 0 ? (
          <EmptyState title="No tastings yet." message="Log your first tasting of this batch." />
        ) : (
          <div className={styles.history}>
            {tastings.map((tasting) => {
              const tier = fipTier(tasting.score)
              const summary = tasting.overallNotes?.trim() || [...tasting.noseAromas, ...tasting.palateFlavors].slice(0, 3).join(', ')
              return (
                <button type="button" className={styles.historyRow} key={tasting.id} onClick={() => setSelected(tasting)}>
                  <div className={styles.historyScore} style={{ color: tier.color }}>
                    {tasting.score.toFixed(1)}
                  </div>
                  <div className={styles.historyBody}>
                    <div className={styles.historyDate}>{dateFormatter.format(new Date(tasting.date))}</div>
                    {summary ? <div className={styles.historySummary}>{summary}</div> : null}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selected ? <TastingDetailModal infinityBottleId={ib.id} batchId={batch.id} tasting={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}
