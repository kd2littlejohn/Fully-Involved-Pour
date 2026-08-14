import { useState } from 'react'
import type { Bottle, Pour } from '../../data/types'
import { FipScoreBadge } from '../ui/FipScoreBadge'
import { BottlePlaceholder } from '../ui/BottlePlaceholder'
import { PourStoryDetail } from '../../features/pourWizard/PourStoryDetail'
import styles from './PourStoryCard.module.css'

interface PourStoryCardProps {
  pour: Pour
  bottle: Bottle
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function PourStoryCard({ pour, bottle }: PourStoryCardProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const metaParts = [dateFormatter.format(new Date(pour.date)), pour.occasion].filter(Boolean)
  // Quick Pour writes its optional note to pour.notes; the full wizard's
  // dedicated "memory" field is a separate, longer-form spot — either one is
  // a real short note worth surfacing here, memory takes priority since it's
  // the field explicitly meant for "what do you want to remember."
  const note = pour.memory?.trim() || pour.notes?.trim()
  const photoUrl = pour.photoUrl || bottle.imageUrl

  return (
    <>
      <button type="button" className={styles.card} onClick={() => setDetailOpen(true)}>
        <div className={styles.media}>
          {photoUrl ? <img className={styles.photo} src={photoUrl} alt="" /> : <BottlePlaceholder name={bottle.name} />}
        </div>
        <div className={styles.body}>
          <div className={styles.header}>
            <div>
              <div className={styles.bottleName}>{bottle.name}</div>
              <div className={styles.meta}>{metaParts.join(' · ')}</div>
            </div>
            <FipScoreBadge score={pour.rating} />
          </div>
          {pour.companion ? <div className={styles.companion}>With {pour.companion}</div> : null}
          {note ? <p className={styles.memory}>{note}</p> : null}
        </div>
      </button>

      {detailOpen ? <PourStoryDetail pour={pour} bottle={bottle} onClose={() => setDetailOpen(false)} /> : null}
    </>
  )
}
