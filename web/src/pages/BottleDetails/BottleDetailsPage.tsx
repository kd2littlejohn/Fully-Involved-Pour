import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Button } from '../../components/ui/Button'
import { SignInButton } from '../../components/domain/SignInButton'
import { Badge } from '../../components/ui/Badge'
import { ScoreRing } from '../../components/ui/ScoreRing'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { StatTile } from '../../components/ui/StatTile'
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
  incoming: 'Incoming',
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
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading, deleteBottle } = useUserData()
  const [activeTab, setActiveTab] = useState('overview')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  const quickStats: { value: string; label: string }[] = []
  if (bottle.proof) quickStats.push({ value: String(bottle.proof), label: 'Proof' })
  if (bottle.ageStatement) quickStats.push({ value: bottle.ageStatement, label: 'Age' })
  if (bottle.msrp) quickStats.push({ value: `$${bottle.msrp}`, label: 'MSRP' })
  if (bottle.distillery) quickStats.push({ value: bottle.distillery, label: 'Distillery' })

  const currentBottleId = bottle.id
  async function handleDelete() {
    setDeleting(true)
    await deleteBottle(currentBottleId)
    setDeleting(false)
    navigate('/collection')
  }

  return (
    <>
      <div className={styles.topRow}>
        <Link to="/collection" className={styles.back}>
          ← Back to Collection
        </Link>

        {confirmingDelete ? (
          <div className={styles.confirm}>
            <span className={styles.confirmText}>Delete this bottle?</span>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Confirm Delete'}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
            Delete Bottle
          </Button>
        )}
      </div>

      <div className={styles.hero}>
        <div className={styles.imageWrap}>
          {bottle.imageUrl ? <img className={styles.image} src={bottle.imageUrl} alt="" /> : <BottlePlaceholder name={bottle.name} />}
        </div>
        <div className={styles.info}>
          <h1 className={styles.name}>{bottle.name}</h1>
          {bottle.distillery ? <div className={styles.distillery}>{bottle.distillery}</div> : null}
          <div className={styles.badges}>
            <Badge
              tone={bottle.status === 'open' ? 'amber' : bottle.status === 'wishlist' || bottle.status === 'incoming' ? 'brass' : 'default'}
            >
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

      {quickStats.length > 0 ? (
        <div className={styles.quickStats}>
          {quickStats.map((stat) => (
            <StatTile key={stat.label} value={stat.value} label={stat.label} />
          ))}
        </div>
      ) : null}

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <TabPanel>
        {activeTab === 'overview' ? <OverviewTab bottle={bottle} pours={userDoc.pours} /> : null}
        {activeTab === 'pour-stories' ? <PourStoriesTab bottle={bottle} pours={userDoc.pours} /> : null}
        {activeTab === 'journey' ? <JourneyTab bottle={bottle} pours={userDoc.pours} /> : null}
        {activeTab === 'gallery' ? <GalleryTab bottle={bottle} /> : null}
        {activeTab === 'compare' ? <CompareTab bottle={bottle} otherBottles={otherBottles} pours={userDoc.pours} /> : null}
      </TabPanel>
    </>
  )
}
