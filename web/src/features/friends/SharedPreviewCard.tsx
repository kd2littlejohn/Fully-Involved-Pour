import type { SharedItem } from './useSharedWithYou'
import { timeAgo } from './timeAgo'
import styles from './SharedPreviewCard.module.css'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

interface SharedPreviewCardProps {
  item: SharedItem
  onTap: (item: SharedItem) => void
}

// The compact horizontal card in FriendsPage's "Shared With You" row —
// leads with WHO shared it (avatar + name), same as every other Friends
// surface, with the bottle as supporting detail rather than the headline.
// SharedMomentCard/RecommendationCard (rendered in the full list further
// down the same tab) stay the actionable, full-detail versions; this is
// just a preview. Tapping either kind opens Friend Bottle Quick View
// (never navigates away immediately — see FriendBottleQuickView.tsx),
// which itself offers "See Pour Stories" through to the full story page.
export function SharedPreviewCard({ item, onTap }: SharedPreviewCardProps) {
  const name =
    item.kind === 'shared-moment'
      ? item.moment.ownerDisplayName || item.moment.ownerUsername
      : item.recommendation.senderDisplayName || item.recommendation.senderUsername
  const photoURL = item.kind === 'shared-moment' ? item.moment.ownerPhotoURL : item.recommendation.senderPhotoURL
  const actionText = item.kind === 'shared-moment' ? 'shared a Pour Story' : 'recommended a bottle'
  const bottleName = item.kind === 'shared-moment' ? item.moment.snapshot.bottleName : item.recommendation.bottleName
  const bottleImageUrl = item.kind === 'shared-moment' ? item.moment.snapshot.bottleImageUrl : item.recommendation.bottleImageUrl
  const createdAt = item.kind === 'shared-moment' ? item.moment.createdAt : item.recommendation.createdAt

  return (
    <button type="button" className={styles.card} onClick={() => onTap(item)}>
      <div className={styles.personRow}>
        <span className={styles.avatarWrap}>
          {photoURL ? (
            <img className={styles.avatarImage} src={photoURL} alt="" />
          ) : (
            <span className={styles.avatarFallback} aria-hidden="true">
              {initials(name)}
            </span>
          )}
        </span>
        <span className={styles.personText}>
          <span className={styles.personName}>{name}</span>
          <span className={styles.action}>{actionText}</span>
        </span>
      </div>
      <div className={styles.imageWrap}>{bottleImageUrl ? <img className={styles.image} src={bottleImageUrl} alt="" /> : null}</div>
      <div className={styles.body}>
        <div className={styles.bottleName}>{bottleName}</div>
        <div className={styles.time}>{timeAgo(createdAt)}</div>
      </div>
    </button>
  )
}
