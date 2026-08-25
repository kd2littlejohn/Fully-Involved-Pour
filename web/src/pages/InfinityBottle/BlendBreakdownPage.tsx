import { useNavigate, useParams } from 'react-router-dom'
import { InfinityBottleHeader } from '../../features/infinityBottle/InfinityBottleHeader'
import {
  batchComposition,
  batchDisplayName,
  batchVolumeMl,
  estimatedProof,
  latestTasting,
  resolveAdditionSourceBottle,
  BLEND_GOAL_LABELS,
} from '../../features/infinityBottle/selectors'
import { fipTier } from '../../features/fip/tiers'
import { EmptyState } from '../../components/ui/EmptyState'
import { useUserData } from '../../hooks/useUserData'
import styles from './BlendBreakdownPage.module.css'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const SLICE_COLORS = ['var(--fip-amber)', 'var(--fip-brass)', 'var(--fip-copper)', 'var(--fip-warning)', 'var(--fip-success)']

export function BlendBreakdownPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { userDoc } = useUserData()

  const ib = userDoc.infinityBottles.find((b) => b.id === id)
  const batch = ib ? ib.batches[ib.batches.length - 1] : undefined

  if (!ib || !batch) {
    return (
      <div className={styles.page}>
        <InfinityBottleHeader backTo="/collection/infinity" title="Blend Breakdown" />
        <div className={styles.body}>
          <EmptyState title="We couldn't find that Infinity Bottle." message="It may have been deleted." />
        </div>
      </div>
    )
  }

  const volumeMl = batchVolumeMl(batch)
  const proof = estimatedProof(batch)
  const composition = batchComposition(batch)
  const take = latestTasting(batch)
  const timeline = [...batch.additions].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt).reverse()

  function goToSource(sourceBottleId: string | undefined) {
    if (!sourceBottleId) return
    const bottle = resolveAdditionSourceBottle(userDoc.bottles, sourceBottleId)
    if (bottle) navigate(`/collection/${bottle.id}`)
  }

  return (
    <div className={styles.page}>
      <InfinityBottleHeader
        backTo="/collection/infinity"
        title={batchDisplayName(ib, batch)}
        action={
          <button type="button" className={styles.menuButton} onClick={() => navigate(`/collection/infinity/${ib.id}/manage`)} aria-label="Batch management">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        }
      />

      <div className={styles.body}>
        <div className={styles.statusRow}>
          <span className={batch.status === 'active' ? styles.statusActive : styles.statusComplete}>
            {batch.status === 'active' ? 'Current Batch' : 'Batch Complete'}
          </span>
          {batch.goal ? <span className={styles.goalBadge}>Goal: {BLEND_GOAL_LABELS[batch.goal]}</span> : null}
        </div>

        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statValue}>
              {volumeMl}ml{ib.capacityMl ? ` / ${ib.capacityMl}ml` : ''}
            </div>
            <div className={styles.statLabel}>Total Volume{ib.capacityMl ? ' / Capacity' : ''}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{proof != null ? proof.toFixed(1) : 'Unavailable'}</div>
            <div className={styles.statLabel}>Estimated Proof</div>
          </div>
        </div>
        {proof == null && composition.length > 0 ? (
          <p className={styles.proofNote}>Add a proof to every bottle in this blend to see an estimate.</p>
        ) : null}

        {take ? (
          <section className={styles.section}>
            <h2 className={styles.heading}>Current Take</h2>
            <div className={styles.takeCard}>
              <div className={styles.takeScore} style={{ color: fipTier(take.score).color }}>
                {take.score.toFixed(1)}
              </div>
              <div className={styles.takeBody}>
                <div className={styles.takeTier} style={{ color: fipTier(take.score).color }}>
                  {fipTier(take.score).label}
                </div>
                {[...take.noseAromas, ...take.palateFlavors].length > 0 ? (
                  <div className={styles.takeNotes}>{[...take.noseAromas, ...take.palateFlavors].slice(0, 4).join(', ')}</div>
                ) : null}
                {take.overallNotes ? (
                  <p className={styles.takeSummary}>
                    {take.overallNotes.length > 140 ? `${take.overallNotes.slice(0, 140)}…` : take.overallNotes}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {composition.length > 0 ? (
          <section className={styles.section}>
            <h2 className={styles.heading}>Composition</h2>
            <div className={styles.compositionBar}>
              {composition.map((slice, i) => (
                <div
                  key={slice.key}
                  className={styles.compositionSegment}
                  style={{ width: `${slice.percent}%`, background: SLICE_COLORS[i % SLICE_COLORS.length] }}
                />
              ))}
            </div>
            <div className={styles.compositionList}>
              {composition.map((slice, i) => {
                const bottle = resolveAdditionSourceBottle(userDoc.bottles, slice.sourceBottleId)
                const Row = bottle ? 'button' : 'div'
                return (
                  <Row
                    key={slice.key}
                    type={bottle ? 'button' : undefined}
                    className={bottle ? `${styles.compositionRow} ${styles.compositionRowLink}` : styles.compositionRow}
                    onClick={bottle ? () => goToSource(slice.sourceBottleId) : undefined}
                  >
                    <span className={styles.compositionDot} style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                    <span className={styles.compositionName}>{slice.name}</span>
                    <span className={styles.compositionAmount}>{Math.round(slice.ml)}ml</span>
                    <span className={styles.compositionPercent}>{Math.round(slice.percent)}%</span>
                  </Row>
                )
              })}
            </div>
          </section>
        ) : (
          <EmptyState title="Nothing blended yet." message="Add a bottle to start this batch's blend." />
        )}

        {timeline.length > 0 ? (
          <section className={styles.section}>
            <h2 className={styles.heading}>Blend Timeline</h2>
            <div className={styles.timeline}>
              {timeline.map((addition) => {
                const bottle = resolveAdditionSourceBottle(userDoc.bottles, addition.sourceBottleId)
                const Row = bottle ? 'button' : 'div'
                return (
                  <Row
                    key={addition.id}
                    type={bottle ? 'button' : undefined}
                    className={bottle ? `${styles.timelineRow} ${styles.timelineRowLink}` : styles.timelineRow}
                    onClick={bottle ? () => goToSource(addition.sourceBottleId) : undefined}
                  >
                    <span className={styles.timelineDate}>{dateFormatter.format(new Date(addition.date))}</span>
                    <span className={styles.timelineText}>
                      Added {addition.amountMl}ml {addition.bottleName}
                    </span>
                    {addition.note ? <span className={styles.timelineNote}>Why I Added It: {addition.note}</span> : null}
                  </Row>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
