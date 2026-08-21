import { Link, Navigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatTile } from '../../components/ui/StatTile'
import { Badge } from '../../components/ui/Badge'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { useFriendProfile } from '../../features/friends/useFriendProfile'
import { useOurWhiskeyStory } from '../../features/friends/useOurWhiskeyStory'
import { AddFriendButton } from '../../features/friends/AddFriendButton'
import { OurWhiskeyStoryCard } from '../../features/friends/OurWhiskeyStoryCard'
import { SharedMomentCard } from '../../features/friends/SharedMomentCard'
import { getBottlesInCommon } from '../../features/friends/friendProfileSelectors'
import type { BottleStatus } from '../../data/types'
import styles from './FriendProfilePage.module.css'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

// Matches the STATUS_LABEL/STATUS_TONE convention already used by
// components/domain/BottleListRow.tsx for the viewer's own collection —
// same labels/colors, so a bottle reads the same way here as it does in My
// Bar. 'wishlist' is omitted: only ever shown here for bottles that are
// definitely not wishlist items (Bottles We Both Own, Bottles They're
// Sharing) — the Wish List section itself doesn't need a redundant badge.
const STATUS_LABEL: Partial<Record<BottleStatus, string>> = {
  open: 'Opened',
  sealed: 'Sealed',
  finished: 'Finished',
  incoming: 'Incoming',
}

const STATUS_TONE: Partial<Record<BottleStatus, 'default' | 'amber' | 'brass'>> = {
  open: 'amber',
  sealed: 'default',
  finished: 'default',
  incoming: 'brass',
}

// name/proof/age-statement summary line — the descriptive, non-personal
// detail projected into SharedBottleSummary (see
// data/repositories/sharedCollections.ts and its own comment on exactly
// why price/store/notes/rating never appear here).
function bottleMetaLine(bottle: { type?: string; proof?: number; ageStatement?: string }): string {
  return [bottle.type, bottle.proof != null ? `${bottle.proof} proof` : undefined, bottle.ageStatement].filter(Boolean).join(' · ')
}

interface SharedBottleTileProps {
  name: string
  distillery?: string
  imageUrl?: string
  type?: string
  proof?: number
  ageStatement?: string
  status?: BottleStatus
}

function SharedBottleTile({ name, distillery, imageUrl, type, proof, ageStatement, status }: SharedBottleTileProps) {
  const meta = bottleMetaLine({ type, proof, ageStatement })
  const statusLabel = status ? STATUS_LABEL[status] : undefined
  const statusTone = status ? STATUS_TONE[status] : undefined
  return (
    <div className={styles.bottleTile}>
      <div className={styles.bottleImageWrap}>{imageUrl ? <img className={styles.bottleImage} src={imageUrl} alt="" /> : null}</div>
      <div className={styles.bottleBody}>
        <div className={styles.bottleName}>{name}</div>
        {distillery ? <div className={styles.bottleDistillery}>{distillery}</div> : null}
        {meta ? <div className={styles.bottleMeta}>{meta}</div> : null}
        {statusLabel ? (
          <div className={styles.bottleStatusRow}>
            <Badge tone={statusTone}>{statusLabel}</Badge>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// Privacy-aware by construction, not by hiding fields after the fact:
// everything rendered here comes from either the already-public profiles
// doc, or sharedCollection/sharedMoments — data the owner explicitly chose
// to project (see data/repositories/sharedCollections.ts). Nothing here
// ever reads the friend's private users/{uid} doc.
export function FriendProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user, loading: authLoading } = useAuth()
  const { userDoc } = useUserData()
  const { data, loading, notFound } = useFriendProfile(username, user?.uid)
  const { story, loading: storyLoading } = useOurWhiskeyStory(user?.uid, data?.uid)

  if (authLoading || loading) {
    return <PageHeader eyebrow="Friends" title="Profile" />
  }

  if (data && user && data.uid === user.uid) {
    return <Navigate to="/profile" replace />
  }

  if (notFound || !data) {
    return (
      <>
        <PageHeader eyebrow="Friends" title="Profile" />
        <EmptyState title="We couldn't find that profile." message="Double-check the link, or search for them by @username." />
      </>
    )
  }

  const { profile, uid, sharedCollection, sharedMomentsWithViewer } = data
  const displayName = profile.displayName || profile.username || 'FIP User'
  const commonBottles = sharedCollection ? getBottlesInCommon(userDoc.bottles, sharedCollection.bottles) : []
  const hasAnySharedStat = Boolean(
    story?.poursTogetherCount || sharedCollection?.bottles.length || story?.blindTastingsTogetherCount || sharedMomentsWithViewer.length,
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.avatarWrap}>
          {profile.photoURL ? (
            <img className={styles.avatar} src={profile.photoURL} alt="" />
          ) : (
            <div className={styles.avatarFallback} aria-hidden="true">
              {initials(displayName)}
            </div>
          )}
        </div>
        <h1 className={styles.name}>{displayName}</h1>
        <p className={styles.username}>@{profile.username}</p>
        {profile.location ? <p className={styles.location}>{profile.location}</p> : null}
        {profile.bio ? <p className={styles.bio}>{profile.bio}</p> : null}
        <div className={styles.actionRow}>
          <AddFriendButton targetUid={uid} />
        </div>
      </div>

      {profile.whiskeyIdentityTags && profile.whiskeyIdentityTags.length > 0 ? (
        <div className={styles.identityCard}>
          <div className={styles.identityEyebrow}>Whiskey Identity</div>
          <div className={styles.identityTags}>{profile.whiskeyIdentityTags.join(' · ')}</div>
        </div>
      ) : null}

      {hasAnySharedStat ? (
        <div className={styles.statsGrid}>
          <StatTile value={story?.poursTogetherCount ?? 0} label="Pours Together" />
          <StatTile value={sharedCollection?.bottles.length ?? 0} label="Bottles Shared" />
          <StatTile value={story?.blindTastingsTogetherCount ?? 0} label="Blind Tastings" />
          <StatTile value={sharedMomentsWithViewer.length} label="Shared Stories" />
        </div>
      ) : null}

      {!storyLoading && story ? (
        <Link to={`/friends/u/${username}/story`} className={styles.storyLink}>
          <OurWhiskeyStoryCard story={story} friendFirstName={displayName.split(' ')[0] ?? displayName} />
        </Link>
      ) : null}

      {sharedMomentsWithViewer.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Recent Shared Pours</h2>
          <div className={styles.momentList}>
            {sharedMomentsWithViewer.slice(0, 5).map((moment) => (
              <SharedMomentCard key={moment.id} moment={moment} />
            ))}
          </div>
        </section>
      ) : null}

      {commonBottles.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Bottles We Both Own</h2>
          <div className={styles.bottleGrid}>
            {commonBottles.slice(0, 8).map((bottle) => (
              <SharedBottleTile key={`${bottle.name}-${bottle.distillery ?? ''}`} {...bottle} />
            ))}
          </div>
        </section>
      ) : null}

      {sharedCollection && sharedCollection.wishlist.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Their Wish List</h2>
          <div className={styles.bottleGrid}>
            {sharedCollection.wishlist.slice(0, 8).map((bottle) => (
              <SharedBottleTile key={bottle.id} {...bottle} />
            ))}
          </div>
        </section>
      ) : null}

      {sharedCollection && sharedCollection.bottles.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Bottles They&rsquo;re Sharing</h2>
          <div className={styles.bottleGrid}>
            {sharedCollection.bottles.slice(0, 8).map((bottle) => (
              <SharedBottleTile key={bottle.id} {...bottle} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
