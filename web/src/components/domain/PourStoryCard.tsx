import { useState } from 'react'
import type { Bottle, Pour } from '../../data/types'
import { FipScoreBadge } from '../ui/FipScoreBadge'
import { BottlePlaceholder } from '../ui/BottlePlaceholder'
import { OverflowMenu, type OverflowMenuItem } from '../ui/OverflowMenu'
import { PourStoryDetail } from '../../features/pourWizard/PourStoryDetail'
import { useUserData } from '../../hooks/useUserData'
import { FEATURE_REASON_LABEL, type JourneyCardFeatureReason, type JourneyCardVariant } from '../../features/journal/journeyCardVariant'
import styles from './PourStoryCard.module.css'

interface PourStoryCardProps {
  pour: Pour
  bottle: Bottle
  variant?: JourneyCardVariant
  reason?: JourneyCardFeatureReason
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function PourStoryCard({ pour, bottle, variant = 'standard', reason }: PourStoryCardProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const { updatePour } = useUserData()
  const metaParts = [dateFormatter.format(new Date(pour.date)), pour.occasion].filter(Boolean)
  // Quick Pour writes its optional note to pour.notes; the full wizard's
  // dedicated "memory" field is a separate, longer-form spot — either one is
  // a real short note worth surfacing here, memory takes priority since it's
  // the field explicitly meant for "what do you want to remember."
  const note = pour.memory?.trim() || pour.notes?.trim()
  // Pour/memory photos are lifestyle shots — cover fills the frame naturally.
  // A bottle photo fallback is product photography — contain keeps the
  // whole bottle in frame instead of cropping the neck or base.
  const photoUrl = pour.photoUrl
  const isLifestylePhoto = Boolean(photoUrl)
  const fallbackImage = photoUrl ?? bottle.imageUrl
  const featured = variant === 'featured'

  async function toggleFeatured() {
    const { id: _id, bottleId: _bottleId, ...patch } = pour
    await updatePour(pour.id, { ...patch, isFeatured: !pour.isFeatured })
  }

  const menuItems: OverflowMenuItem[] = [
    { label: pour.isFeatured ? 'Remove From Featured' : 'Feature This Memory', onClick: () => void toggleFeatured() },
  ]

  return (
    <>
      <div className={featured ? `${styles.card} ${styles.cardFeatured}` : styles.card}>
        <div className={styles.menuOverlay}>
          <OverflowMenu items={menuItems} label={`${bottle.name} pour actions`} />
        </div>
        <button
          type="button"
          className={featured ? `${styles.trigger} ${styles.triggerFeatured}` : styles.trigger}
          onClick={() => setDetailOpen(true)}
        >
          <div className={featured ? `${styles.media} ${styles.mediaFeatured}` : styles.media}>
            {fallbackImage ? (
              <img
                className={isLifestylePhoto ? `${styles.photo} ${styles.photoCover}` : `${styles.photo} ${styles.photoContain}`}
                src={fallbackImage}
                alt=""
              />
            ) : (
              <BottlePlaceholder name={bottle.name} compact />
            )}
            {featured && reason ? <span className={styles.badge}>{FEATURE_REASON_LABEL[reason]}</span> : null}
          </div>
          <div className={styles.body}>
            <div className={featured ? `${styles.bottleName} ${styles.bottleNameFeatured}` : styles.bottleName}>{bottle.name}</div>
            <div className={styles.meta}>{metaParts.join(' · ')}</div>
            {pour.companion ? <div className={styles.companion}>With {pour.companion}</div> : null}
            {note ? <p className={featured ? `${styles.memory} ${styles.memoryFeatured}` : styles.memory}>{note}</p> : null}
            <div className={styles.scoreRow}>
              <FipScoreBadge score={pour.rating} />
            </div>
          </div>
        </button>
      </div>

      {detailOpen ? <PourStoryDetail pour={pour} bottle={bottle} onClose={() => setDetailOpen(false)} /> : null}
    </>
  )
}
