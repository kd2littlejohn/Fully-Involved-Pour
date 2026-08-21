import { Link } from 'react-router-dom'
import type { SharedItem } from './useSharedWithYou'
import { timeAgo } from './timeAgo'
import styles from './SharedPreviewCard.module.css'

interface SharedPreviewCardProps {
  item: SharedItem
}

// The compact horizontal card in FriendsPage's "Shared With You" row —
// SharedMomentCard/RecommendationCard (rendered in the full list further
// down the same tab) stay the actionable, full-detail versions; this is
// just a preview. A shared-moment preview taps through to the dedicated
// SharedPourStoryPage; a recommendation preview doesn't link anywhere on
// its own (there's no separate detail page for one) — its Add/Dismiss
// actions live on the full card below.
export function SharedPreviewCard({ item }: SharedPreviewCardProps) {
  if (item.kind === 'shared-moment') {
    const { moment } = item
    return (
      <Link to={`/friends/shared/${moment.id}`} className={styles.card}>
        <div className={styles.imageWrap}>
          {moment.snapshot.bottleImageUrl ? <img className={styles.image} src={moment.snapshot.bottleImageUrl} alt="" /> : null}
        </div>
        <div className={styles.body}>
          <div className={styles.eyebrow}>
            {moment.ownerDisplayName || moment.ownerUsername} shared a Pour Story with you
          </div>
          <div className={styles.bottleName}>{moment.snapshot.bottleName}</div>
          <div className={styles.time}>{timeAgo(moment.createdAt)}</div>
        </div>
      </Link>
    )
  }

  const { recommendation } = item
  return (
    <div className={styles.card}>
      <div className={styles.imageWrap}>
        {recommendation.bottleImageUrl ? <img className={styles.image} src={recommendation.bottleImageUrl} alt="" /> : null}
      </div>
      <div className={styles.body}>
        <div className={styles.eyebrow}>{recommendation.senderDisplayName || recommendation.senderUsername} recommended a bottle</div>
        <div className={styles.bottleName}>{recommendation.bottleName}</div>
        <div className={styles.time}>{timeAgo(recommendation.createdAt)}</div>
      </div>
    </div>
  )
}
