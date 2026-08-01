import { useState } from 'react'
import { lookupDistillery, type DistilleryInfoResult } from '../../data/repositories/ai'
import type { DistilleryStat } from './selectors'
import styles from './DistilleryList.module.css'

interface DistilleryRowProps {
  distillery: DistilleryStat
}

function DistilleryRow({ distillery }: DistilleryRowProps) {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<DistilleryInfoResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && !info && !loading) {
      setLoading(true)
      try {
        const result = await lookupDistillery(distillery.name)
        setInfo(result)
      } catch {
        setInfo({ known: false })
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className={styles.statRow}>
      <button type="button" className={styles.statHeader} onClick={() => void handleToggle()} aria-expanded={open}>
        <span className={styles.statName}>{distillery.name}</span>
        <span className={styles.statMeta}>
          {distillery.count} {distillery.count === 1 ? 'bottle' : 'bottles'}
        </span>
      </button>

      {open ? (
        <div className={styles.detail}>
          {loading ? (
            <p className={styles.detailText}>Looking it up…</p>
          ) : info?.known ? (
            <>
              <p className={styles.detailText}>
                {[info.location, info.founded ? `founded ${info.founded}` : null].filter(Boolean).join(' · ')}
                {info.parentCompany ? ` · owned by ${info.parentCompany}` : ''}
              </p>
              {info.description ? <p className={styles.detailText}>{info.description}</p> : null}
            </>
          ) : (
            <p className={styles.detailText}>No verified background info for this distillery yet.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function DistilleryList({ distilleries }: { distilleries: DistilleryStat[] }) {
  return (
    <>
      <div className={styles.favorite}>
        <div className={styles.favoriteLabel}>Favorite Distillery</div>
        <div className={styles.favoriteName}>{distilleries[0]?.name}</div>
      </div>
      <div className={styles.statList}>
        {distilleries.map((d) => (
          <DistilleryRow key={d.name} distillery={d} />
        ))}
      </div>
    </>
  )
}
