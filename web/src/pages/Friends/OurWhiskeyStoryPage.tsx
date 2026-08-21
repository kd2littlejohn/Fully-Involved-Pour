import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatTile } from '../../components/ui/StatTile'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { useFriendProfile } from '../../features/friends/useFriendProfile'
import { useOurWhiskeyStory } from '../../features/friends/useOurWhiskeyStory'
import styles from './OurWhiskeyStoryPage.module.css'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

// The full-page destination "Our Whiskey Story" links to from a friend's
// profile (see FriendProfilePage.tsx) — everything OurWhiskeyStoryCard
// already computes, given a full page's room: the same real derived stats
// plus the actual list of recent shared pours and shared blind tastings,
// not just counts.
export function OurWhiskeyStoryPage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { profile: myProfile } = useUserData()
  const { data, loading: profileLoading, notFound } = useFriendProfile(username, user?.uid)
  const { story, loading: storyLoading } = useOurWhiskeyStory(user?.uid, data?.uid)

  if (authLoading || profileLoading) {
    return <PageHeader eyebrow="Friends" title="Our Whiskey Story" />
  }

  if (notFound || !data) {
    return (
      <>
        <PageHeader eyebrow="Friends" title="Our Whiskey Story" />
        <EmptyState title="We couldn't find that profile." message="Double-check the link, or search for them by @username." />
      </>
    )
  }

  const myName = firstName(myProfile?.displayName || user?.displayName || 'You')
  const friendName = firstName(data.profile.displayName || data.profile.username || 'Friend')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="Back">
          ←
        </button>
        <div className={styles.headerText}>
          <div className={styles.eyebrow}>Our Whiskey Story</div>
          <h1 className={styles.title}>
            {myName} <span className={styles.amp}>&amp;</span> {friendName}
          </h1>
        </div>
      </div>

      {storyLoading ? null : !story || (story.poursTogetherCount === 0 && story.blindTastingsTogetherCount === 0) ? (
        <EmptyState
          title="Nothing shared yet."
          message={`Tag ${friendName} in a Pour Story, or take on a Blind Room together, to start your story.`}
        />
      ) : (
        <>
          <div className={styles.statsRow}>
            <StatTile value={story.poursTogetherCount} label="Pours Together" />
            <StatTile value={story.blindTastingsTogetherCount} label="Blind Tastings" />
          </div>

          {story.mostSharedBottle ? (
            <div className={styles.mostShared}>
              <span className={styles.mostSharedLabel}>Most Shared</span>
              <span className={styles.mostSharedName}>{story.mostSharedBottle.name}</span>
            </div>
          ) : null}

          {story.recentSharedMoments.length > 0 ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Recent Shared Pours</h2>
              <div className={styles.list}>
                {story.recentSharedMoments.map((moment) => (
                  <Link key={moment.id} to={`/friends/shared/${moment.id}`} className={styles.row}>
                    <div className={styles.rowMain}>
                      <span className={styles.rowName}>{moment.snapshot.bottleName}</span>
                      {moment.snapshot.distillery ? <span className={styles.rowMeta}>{moment.snapshot.distillery}</span> : null}
                    </div>
                    <span className={styles.rowDate}>{formatDate(moment.snapshot.date)}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {story.sharedBlindRooms.length > 0 ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Shared Blind Tastings</h2>
              <div className={styles.list}>
                {story.sharedBlindRooms.map((room) => (
                  <div key={room.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <span className={styles.rowName}>{room.name}</span>
                    </div>
                    <span className={styles.rowDate}>{formatDate(new Date(room.createdAt).toISOString())}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
