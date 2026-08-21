import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useSharedPourStory } from '../../features/friends/useSharedPourStory'
import { acceptSharedMoment } from '../../data/repositories/sharedMoments'
import { ReactionBar } from '../../features/friends/ReactionBar'
import { CommentsList } from '../../features/friends/CommentsList'
import styles from './SharedPourStoryPage.module.css'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// The full-page destination "Shared With You" cards on FriendsPage link
// into — everything SharedMomentCard shows inline in a list, given more
// room: every tagged person (not just the owner), the full-size image, and
// the same reaction/comment surfaces (see ReactionBar/CommentsList, reused
// as-is rather than re-implemented).
export function SharedPourStoryPage() {
  const { momentId } = useParams<{ momentId: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { data, loading, notFound } = useSharedPourStory(momentId)

  if (authLoading || loading) {
    return <PageHeader eyebrow="Friends" title="Pour Story (Shared)" />
  }

  if (notFound || !data) {
    return (
      <>
        <PageHeader eyebrow="Friends" title="Pour Story (Shared)" />
        <EmptyState title="We couldn't find that story." message="It may have been removed, or isn't shared with you." />
      </>
    )
  }

  const { moment, people } = data
  const isParticipant = user ? moment.participantIds.includes(user.uid) : false
  const hasAccepted = user ? moment.acceptedParticipantIds.includes(user.uid) : true

  async function handleAccept() {
    if (!user) return
    await acceptSharedMoment(moment.id, user.uid)
    navigate(0)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="Back">
          ←
        </button>
        <div>
          <div className={styles.eyebrow}>Pour Story (Shared)</div>
          <div className={styles.date}>{formatDate(moment.snapshot.date)}</div>
        </div>
      </div>

      {moment.snapshot.memory ? <p className={styles.memory}>{moment.snapshot.memory}</p> : null}

      {people.length > 0 ? (
        <div className={styles.peopleRow}>
          <span className={styles.peopleLabel}>Shared with</span>
          <div className={styles.avatars}>
            {people.map((person) => {
              const label = person.displayName || person.username || 'FIP User'
              const image = person.photoURL ? (
                <img className={styles.avatarImage} src={person.photoURL} alt="" />
              ) : (
                <span className={styles.avatarFallback} aria-hidden="true">
                  {initials(label)}
                </span>
              )
              return person.username ? (
                <Link key={person.uid} to={`/friends/u/${person.username}`} className={styles.avatarLink} aria-label={label}>
                  {image}
                </Link>
              ) : (
                <span key={person.uid} className={styles.avatarLink} aria-label={label}>
                  {image}
                </span>
              )
            })}
          </div>
        </div>
      ) : null}

      {moment.snapshot.bottleImageUrl ? <img className={styles.bottleImage} src={moment.snapshot.bottleImageUrl} alt="" /> : null}

      <div className={styles.bottleInfo}>
        <div className={styles.bottleName}>{moment.snapshot.bottleName}</div>
        {moment.snapshot.distillery ? <div className={styles.distillery}>{moment.snapshot.distillery}</div> : null}
        {moment.snapshot.occasion ? <div className={styles.occasion}>{moment.snapshot.occasion}</div> : null}
      </div>

      {typeof moment.snapshot.rating === 'number' ? (
        <div className={styles.scoreRow}>
          <span className={styles.score}>{moment.snapshot.rating.toFixed(1)}</span>
          <span className={styles.scoreLabel}>FIP Score</span>
        </div>
      ) : null}

      {isParticipant && !hasAccepted ? (
        <Button onClick={() => void handleAccept()} className={styles.acceptButton}>
          Add to My Shared Memories
        </Button>
      ) : null}

      <div className={styles.reactionsRow}>
        <ReactionBar sharedMomentId={moment.id} storyOwnerId={moment.ownerId} />
      </div>

      <div className={styles.commentsSection}>
        <h2 className={styles.commentsHeading}>Comments</h2>
        <CommentsList sharedMomentId={moment.id} storyOwnerId={moment.ownerId} />
      </div>
    </div>
  )
}
