import { PageHeader } from '../../components/layout/PageHeader'
import { Section } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatTile } from '../../components/ui/StatTile'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { getCollectionStats, getFavoriteBottle, getMostSharedBottle } from '../../features/profile/selectors'
import { getDistilleryStats } from '../../features/discover/selectors'
import { getCompanionStats } from '../../features/journal/selectors'
import { getCurrentScore } from '../../features/bottleDetails/selectors'
import { getWhiskeyIdentity } from '../../features/profile/identity'
import { getRecentMilestones } from '../../features/profile/milestones'
import { useBlindProfileStats } from '../../features/profile/useBlindProfileStats'
import { ProfileHeader } from '../../features/profile/ProfileHeader'
import { WhiskeyIdentityCard } from '../../features/profile/WhiskeyIdentityCard'
import { FavoritesGrid } from '../../features/profile/FavoritesGrid'
import { BlindProfileCard } from '../../features/profile/BlindProfileCard'
import { MilestonesRow } from '../../features/profile/MilestonesRow'
import { PalateBreakdown } from '../../features/profile/PalateBreakdown'
import { YourPalateSection } from '../../features/yourPalate/YourPalateSection'
import styles from './ProfilePage.module.css'

export function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const { userDoc, profile, loading: dataLoading } = useUserData()
  const { stats: blindStats } = useBlindProfileStats(user?.uid)

  if (authLoading || dataLoading) {
    return <PageHeader eyebrow="Profile" title="My Journey" />
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="Profile" title="My Journey" subtitle="Sign in to see your whiskey journey." />
        <EmptyState
          title="Sign in to continue."
          message="Fully Involved Pour uses Google sign-in to sync your bar."
          action={<SignInButton />}
        />
      </>
    )
  }

  const { bottles, pours, memories } = userDoc
  const displayName = profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Whiskey Explorer'

  const stats = getCollectionStats(bottles, pours, memories.length)
  const experiencedBottles = bottles.filter((b) => b.status !== 'wishlist' && b.status !== 'incoming').length

  const identity = getWhiskeyIdentity(bottles, pours)

  const favoriteBottle = getFavoriteBottle(bottles, pours)
  const distilleries = getDistilleryStats(bottles)
  const companions = getCompanionStats(pours)
  const mostShared = getMostSharedBottle(bottles, pours)

  const milestones = getRecentMilestones(bottles, pours, blindStats?.completedRooms ?? [])

  return (
    <>
      <ProfileHeader
        photoURL={profile?.photoURL}
        displayName={displayName}
        username={userDoc.username}
        location={profile?.location}
        bio={profile?.bio}
      />

      <WhiskeyIdentityCard identity={identity} />

      <Section title="Journey at a Glance">
        <div className={styles.statsGrid}>
          <StatTile value={experiencedBottles} label="Bottles Experienced" />
          <StatTile value={stats.openBottles} label="Bottles Opened" />
          <StatTile value={stats.totalPours} label="Pour Stories" />
          <StatTile value={blindStats?.completedCount ?? 0} label="Blind Tastings" />
        </div>
      </Section>

      <Section title="Favorites">
        <FavoritesGrid
          favoriteBottle={favoriteBottle ? { bottle: favoriteBottle, score: getCurrentScore(favoriteBottle, pours) } : undefined}
          favoriteDistillery={distilleries[0]}
          favoriteCompanion={companions[0]}
          mostShared={mostShared}
        />
      </Section>

      <YourPalateSection bottles={bottles} pours={pours} />
      <div className={styles.palateBreakdownWrap}>
        <PalateBreakdown bottles={bottles} pours={pours} />
      </div>

      <Section title="Blind Profile">
        <BlindProfileCard stats={blindStats} />
      </Section>

      <Section title="Recent Milestones">
        <MilestonesRow milestones={milestones} />
      </Section>
    </>
  )
}
