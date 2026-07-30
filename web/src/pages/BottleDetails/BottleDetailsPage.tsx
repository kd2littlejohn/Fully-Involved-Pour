import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { LinkButton } from '../../components/ui/LinkButton'
import { SignInButton } from '../../components/domain/SignInButton'
import { Badge } from '../../components/ui/Badge'
import { ScoreRing } from '../../components/ui/ScoreRing'
import { Tabs, TabPanel } from '../../components/ui/Tabs'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import type { BottleStatus } from '../../data/types'
import { bottleJourneyStage } from '../../features/collection/journeyStage'
import { getCurrentScore } from '../../features/bottleDetails/selectors'
import { OverviewTab } from './tabs/OverviewTab'
import { PourStoriesTab } from './tabs/PourStoriesTab'
import { JourneyTab } from './tabs/JourneyTab'
import { GalleryTab } from './tabs/GalleryTab'
import { CompareTab } from './tabs/CompareTab'
import styles from './BottleDetailsPage.module.css'

const STATUS_LABEL: Record<BottleStatus, string> = {
  open: 'Opened',
  sealed: 'Sealed',
  wishlist: 'Wishlist',
  finished: 'Finished',
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pour-stories', label: 'Pour Stories' },
  { id: 'journey', label: 'Journey' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'compare', label: 'Compare' },
]

export function BottleDetailsPage() {
  const { bottleId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading } = useUserData()
  const [activeTab, setActiveTab] = useState('overview')

  if (authLoading || dataLoading) {
    return <PageHeader eyebrow="Bottle" title="Bottle details" />
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="Bottle" title="Bottle details" />
        <EmptyState
          title="Sign in to continue."
          message="Fully Involved Pour uses Google sign-in to sync your collection."
          action={<SignInButton />}
        />
      </>
    )
  }

  const bottle = userDoc.bottles.find((b) => b.id === bottleId)

  if (!bottle) {
    return (
      <>
        <PageHeader eyebrow="Bottle" title="Bottle not found" />
        <EmptyState
          title="We couldn't find this bottle."
          message="It may have been removed from your collection."
          action={<LinkButton to="/collection">Back to Collection</LinkButton>}
        />
      </>
    )
  }

  const journeyStage = bottleJourneyStage(bottle)
  const score = getCurrentScore(bottle, userDoc.pours)
  const otherBottles = userDoc.bottles.filter((b) => b.id !== bottle.id)

  return (
    <>
      <Link to="/collection" className={styles.back}>
        ← Back to Collection
      </Link>

      <div className={styles.hero}>
        <div className={styles.imageWrap}>
          {bottle.imageUrl ? (
            <img className={styles.image} src={bottle.imageUrl} alt="" />
          ) : (
            <span className={styles.placeholder}>No photo</span>
          )}
        </div>
        <div className={styles.info}>
          <h1 className={styles.name}>{bottle.name}</h1>
          {bottle.distillery ? <div className={styles.distillery}>{bottle.distillery}</div> : null}
          <div className={styles.badges}>
            <Badge tone={bottle.status === 'open' ? 'amber' : bottle.status === 'wishlist' ? 'brass' : 'default'}>
              {STATUS_LABEL[bottle.status]}
            </Badge>
            {journeyStage ? (
              <span className={styles.journey} style={{ color: journeyStage.color }}>
                <span className={styles.journeyDot} style={{ background: journeyStage.color }} />
                {journeyStage.label}
              </span>
            ) : null}
          </div>
        </div>
        {typeof score === 'number' ? (
          <div className={styles.score}>
            <ScoreRing score={score} />
          </div>
        ) : null}
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <TabPanel>
        {activeTab === 'overview' ? <OverviewTab bottle={bottle} /> : null}
        {activeTab === 'pour-stories' ? <PourStoriesTab bottle={bottle} pours={userDoc.pours} /> : null}
        {activeTab === 'journey' ? <JourneyTab bottle={bottle} pours={userDoc.pours} /> : null}
        {activeTab === 'gallery' ? <GalleryTab bottle={bottle} /> : null}
        {activeTab === 'compare' ? <CompareTab bottle={bottle} otherBottles={otherBottles} pours={userDoc.pours} /> : null}
      </TabPanel>
    </>
  )
}
