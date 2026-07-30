import { useState } from 'react'
import type { Bottle, Pour } from '../../data/types'
import { FipScoreBadge } from '../ui/FipScoreBadge'
import { PourStoryDetail } from '../../features/pourWizard/PourStoryDetail'
import styles from './PourStoryCard.module.css'

interface PourStoryCardProps {
  pour: Pour
  bottle: Bottle
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function PourStoryCard({ pour, bottle }: PourStoryCardProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const metaParts = [dateFormatter.format(new Date(pour.date)), pour.occasion, pour.companion].filter(Boolean)

  return (
    <>
      <button type="button" className={styles.card} onClick={() => setDetailOpen(true)}>
        <div className={styles.header}>
          <div>
            <div className={styles.bottleName}>{bottle.name}</div>
            <div className={styles.meta}>{metaParts.join(' · ')}</div>
          </div>
          <FipScoreBadge score={pour.rating} />
        </div>
        {pour.memory ? <p className={styles.memory}>{pour.memory}</p> : null}
      </button>

      {detailOpen ? <PourStoryDetail pour={pour} bottle={bottle} onClose={() => setDetailOpen(false)} /> : null}
    </>
  )
}
