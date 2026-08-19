import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useUserData } from '../../hooks/useUserData'
import { setRecommendationStatus } from '../../data/repositories/recommendations'
import type { Recommendation } from '../../data/types'
import styles from './RecommendationCard.module.css'

interface RecommendationCardProps {
  recommendation: Recommendation
  onChange?: () => void
}

export function RecommendationCard({ recommendation, onChange }: RecommendationCardProps) {
  const { addBottle } = useUserData()
  const [busy, setBusy] = useState(false)

  async function handleAddToWishlist() {
    setBusy(true)
    try {
      await addBottle({
        name: recommendation.bottleName,
        distillery: recommendation.bottleDistillery,
        imageUrl: recommendation.bottleImageUrl,
        status: 'wishlist',
      })
      await setRecommendationStatus(recommendation.id, 'added-to-wishlist')
      onChange?.()
    } finally {
      setBusy(false)
    }
  }

  async function handleDismiss() {
    setBusy(true)
    try {
      await setRecommendationStatus(recommendation.id, 'dismissed')
      onChange?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.sender}>{recommendation.senderDisplayName || recommendation.senderUsername}</span>
        <span className={styles.eyebrow}>recommended a bottle</span>
      </div>
      <div className={styles.body}>
        {recommendation.bottleImageUrl ? <img className={styles.image} src={recommendation.bottleImageUrl} alt="" /> : null}
        <div className={styles.bottleInfo}>
          <div className={styles.bottleName}>{recommendation.bottleName}</div>
          {recommendation.bottleDistillery ? <div className={styles.distillery}>{recommendation.bottleDistillery}</div> : null}
        </div>
      </div>
      {recommendation.message ? <p className={styles.message}>&ldquo;{recommendation.message}&rdquo;</p> : null}
      {recommendation.status === 'pending' ? (
        <div className={styles.actions}>
          <Button onClick={() => void handleAddToWishlist()} disabled={busy}>
            Add to Wish List
          </Button>
          <Button variant="ghost" onClick={() => void handleDismiss()} disabled={busy}>
            Dismiss
          </Button>
        </div>
      ) : (
        <div className={styles.status}>{recommendation.status === 'added-to-wishlist' ? 'Added to Wish List' : 'Dismissed'}</div>
      )}
    </div>
  )
}
