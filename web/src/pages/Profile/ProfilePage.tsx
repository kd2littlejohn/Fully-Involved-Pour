import { signOut } from 'firebase/auth'
import { PageHeader } from '../../components/layout/PageHeader'
import { Section } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { StatTile } from '../../components/ui/StatTile'
import { Badge } from '../../components/ui/Badge'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { auth } from '../../data/firebase'
import {
  getCollectionStats,
  getAverageProof,
  getFavoriteFlavors,
  getMostSharedBottle,
  getLegacyShelfBottles,
} from '../../features/profile/selectors'
import { getDistilleryStats } from '../../features/discover/selectors'
import { getCompanionStats } from '../../features/journal/selectors'
import { UsernameClaim } from '../../features/profile/UsernameClaim'
import styles from './ProfilePage.module.css'

export function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading } = useUserData()

  if (authLoading || dataLoading) {
    return <PageHeader eyebrow="Profile" title="My Journey" />
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="Profile" title="My Journey" subtitle="Sign in to see your whiskey journey." />
        <EmptyState
          title="Sign in to continue."
          message="Fully Involved Pour uses Google sign-in to sync your collection."
          action={<SignInButton />}
        />
      </>
    )
  }

  const { bottles, pours, memories } = userDoc
  const stats = getCollectionStats(bottles, pours, memories.length)
  const averageProof = getAverageProof(bottles)
  const flavors = getFavoriteFlavors(bottles)
  const distilleries = getDistilleryStats(bottles)
  const companions = getCompanionStats(pours)
  const mostShared = getMostSharedBottle(bottles, pours)
  const legacyBottles = getLegacyShelfBottles(bottles)
  const hasAnyFavorites = distilleries.length > 0 || companions.length > 0 || Boolean(mostShared) || typeof averageProof === 'number'

  return (
    <>
      <PageHeader eyebrow="Profile" title="My Journey" subtitle={user.displayName ?? user.email ?? undefined} />

      <UsernameClaim current={userDoc.username} />

      <Section title="Collection at a Glance">
        <div className={styles.statsGrid}>
          <StatTile value={stats.totalBottles} label="Bottles" />
          <StatTile value={stats.openBottles} label="Opened" />
          <StatTile value={stats.totalPours} label="Pour Stories" />
          <StatTile value={stats.totalMemories} label="Memories" />
        </div>
      </Section>

      <Section title="Favorites">
        {!hasAnyFavorites && flavors.length === 0 ? (
          <EmptyState title="Your favorites will build up here." message="Add bottles and log pours to see your patterns emerge." />
        ) : (
          <>
            <div className={styles.favoritesList}>
              {distilleries.length > 0 ? (
                <div className={styles.favoriteRow}>
                  <span className={styles.favoriteLabel}>Favorite Distillery</span>
                  <span className={styles.favoriteValue}>{distilleries[0]?.name}</span>
                </div>
              ) : null}
              {companions.length > 0 ? (
                <div className={styles.favoriteRow}>
                  <span className={styles.favoriteLabel}>Favorite Companion</span>
                  <span className={styles.favoriteValue}>{companions[0]?.name}</span>
                </div>
              ) : null}
              {mostShared ? (
                <div className={styles.favoriteRow}>
                  <span className={styles.favoriteLabel}>Most Shared Bottle</span>
                  <span className={styles.favoriteValue}>{mostShared.bottle.name}</span>
                </div>
              ) : null}
              {typeof averageProof === 'number' ? (
                <div className={styles.favoriteRow}>
                  <span className={styles.favoriteLabel}>Average Proof</span>
                  <span className={styles.favoriteValue}>{averageProof.toFixed(1)}</span>
                </div>
              ) : null}
            </div>

            {flavors.length > 0 ? (
              <div className={styles.chips}>
                {flavors.map((f) => (
                  <Badge key={f.name} tone="brass">
                    {f.name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </>
        )}
      </Section>

      <Section title="Legacy Shelf">
        {legacyBottles.length === 0 ? (
          <EmptyState
            title="No Legacy Shelf bottles yet."
            message="Mark a bottle as Legacy Shelf when it earns a permanent place in your story."
          />
        ) : (
          <div className={styles.legacyList}>
            {legacyBottles.map((bottle) => (
              <div className={styles.legacyRow} key={bottle.id}>
                <div className={styles.legacyName}>{bottle.name}</div>
                {bottle.legacyShelfReason ? <div className={styles.legacyReason}>{bottle.legacyShelfReason}</div> : null}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Button variant="secondary" className={styles.signOut} onClick={() => signOut(auth)}>
        Sign out
      </Button>
    </>
  )
}
