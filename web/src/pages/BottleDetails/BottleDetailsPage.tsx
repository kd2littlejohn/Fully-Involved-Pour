import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
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
import { OverflowMenu, type OverflowMenuItem } from '../../components/ui/OverflowMenu'
import { ChangeBottleStatusModal } from '../../components/domain/ChangeBottleStatusModal'
import { useAuth } from '../../hooks/useAuth'
import { useUserData, type BottlePatch } from '../../hooks/useUserData'
import type { BottleStatus } from '../../data/types'
import { bottleJourneyStage } from '../../features/collection/journeyStage'
import { getCurrentScore } from '../../features/bottleDetails/selectors'
import { fipTier } from '../../features/fip/tiers'
import { BottleKillCelebration } from '../../features/bottleKill/BottleKillCelebration'
import { RecommendToFriendModal } from '../../features/friends/RecommendToFriendModal'
import { YourTakeCard } from '../../features/bottleDetails/YourTakeCard'
import { StartAPourButton } from '../../features/startAPour/StartAPourButton'
import { OverviewTab } from './tabs/OverviewTab'
import { PourStoriesTab } from './tabs/PourStoriesTab'
import { JourneyTab } from './tabs/JourneyTab'
import { GalleryTab } from './tabs/GalleryTab'
import { CompareTab } from './tabs/CompareTab'
import { BottlePhotoLightbox } from './BottlePhotoLightbox'
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
  { id: 'photos', label: 'Photos' },
  { id: 'compare', label: 'Compare' },
]

const TAB_IDS = new Set(TABS.map((t) => t.id))

interface BottleDetailsLocationState {
  initialTab?: string
}

export function BottleDetailsPage() {
  const { bottleId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading, updateBottle, deleteBottle } = useUserData()
  const [activeTab, setActiveTab] = useState('overview')

  // A plain useState initializer only runs on first mount, so it misses the
  // case where Comparison is chosen from *within* an already-mounted Bottle
  // Details page — same route, same component instance, just a fresh
  // navigate() with new state. location.key changes on every navigation
  // (even to the same path), so syncing off that catches both cases without
  // fighting the user's own manual tab clicks (which never touch location).
  useEffect(() => {
    const requestedTab = (location.state as BottleDetailsLocationState | null)?.initialTab
    if (requestedTab && TAB_IDS.has(requestedTab)) {
      setActiveTab(requestedTab)
    }
  }, [location.key])
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showPhotoLightbox, setShowPhotoLightbox] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showBottleKillCelebration, setShowBottleKillCelebration] = useState(false)
  const [showRecommendModal, setShowRecommendModal] = useState(false)

  if (authLoading || dataLoading) {
    return <PageHeader eyebrow="Bottle" title="Bottle details" />
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="Bottle" title="Bottle details" />
        <EmptyState
          title="Sign in to continue."
          message="Fully Involved Pour uses Google sign-in to sync your bar."
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
          message="It may have been removed from your bar."
          action={<LinkButton to="/collection">Back to My Bar</LinkButton>}
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
  const currentFavorite = bottle.favorite
  const currentName = bottle.name
  const currentDistillery = bottle.distillery
  const currentType = bottle.type

  async function handleDelete() {
    setDeleting(true)
    await deleteBottle(currentBottleId)
    setDeleting(false)
    navigate('/collection')
  }

  async function handleToggleFavorite() {
    await updateBottle(currentBottleId, { favorite: !currentFavorite })
  }

  function handleReplaceBottle() {
    navigate('/bottles/new', {
      state: { prefill: { name: currentName, distillery: currentDistillery, type: currentType }, defaultStatus: 'sealed' },
    })
  }

  async function handleYourTakeUpdate(patch: BottlePatch) {
    await updateBottle(currentBottleId, patch)
  }

  const menuItems: OverflowMenuItem[] = [
    { label: 'Edit Bottle', onClick: () => navigate(`/bottles/${bottle.id}/edit`) },
    { label: bottle.favorite ? 'Remove from Favorites' : 'Add to Favorites', onClick: () => void handleToggleFavorite() },
    { label: 'Recommend to Friend', onClick: () => setShowRecommendModal(true) },
    { label: 'Replace Bottle', onClick: handleReplaceBottle },
    { label: 'Delete Bottle', onClick: () => setConfirmingDelete(true), tone: 'danger' },
  ]

  return (
    <>
      <div className={styles.topRow}>
        <Link to="/collection" className={styles.back}>
          ← Back to My Bar
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
          <OverflowMenu items={menuItems} label="Bottle actions" />
        )}
      </div>

      <div className={styles.hero}>
        <button type="button" className={styles.imageWrap} onClick={() => setShowPhotoLightbox(true)} aria-label="View photo">
          {bottle.imageUrl ? <img className={styles.image} src={bottle.imageUrl} alt="" /> : <BottlePlaceholder name={bottle.name} />}
        </button>
        <div className={styles.info}>
          <h1 className={styles.name}>{bottle.name}</h1>
          {bottle.distillery ? <div className={styles.distillery}>{bottle.distillery}</div> : null}
          <div className={styles.badges}>
            {bottle.type ? <Badge>{bottle.type}</Badge> : null}
            <button type="button" className={styles.statusButton} onClick={() => setShowStatusModal(true)}>
              <Badge
                tone={bottle.status === 'open' ? 'amber' : bottle.status === 'wishlist' || bottle.status === 'incoming' ? 'brass' : 'default'}
              >
                {STATUS_LABEL[bottle.status]}
              </Badge>
            </button>
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
            <div className={styles.scoreTier} style={{ color: fipTier(score).color }}>
              {fipTier(score).label}
            </div>
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

      <div className={styles.primaryActions}>
        <StartAPourButton bottleId={bottle.id} label="Start a Pour" />
      </div>

      <YourTakeCard bottle={bottle} score={score} onUpdate={handleYourTakeUpdate} />

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <TabPanel>
        {activeTab === 'overview' ? <OverviewTab bottle={bottle} pours={userDoc.pours} /> : null}
        {activeTab === 'pour-stories' ? <PourStoriesTab bottle={bottle} pours={userDoc.pours} /> : null}
        {activeTab === 'journey' ? (
          <JourneyTab bottle={bottle} pours={userDoc.pours} memories={userDoc.memories} onViewAllPours={() => setActiveTab('pour-stories')} />
        ) : null}
        {activeTab === 'photos' ? <GalleryTab bottle={bottle} /> : null}
        {activeTab === 'compare' ? <CompareTab bottle={bottle} otherBottles={otherBottles} pours={userDoc.pours} /> : null}
      </TabPanel>

      {showPhotoLightbox ? <BottlePhotoLightbox bottle={bottle} onClose={() => setShowPhotoLightbox(false)} /> : null}

      {showBottleKillCelebration ? (
        <BottleKillCelebration bottle={bottle} pours={userDoc.pours} onClose={() => setShowBottleKillCelebration(false)} />
      ) : null}

      {showRecommendModal ? <RecommendToFriendModal bottle={bottle} onClose={() => setShowRecommendModal(false)} /> : null}

      {showStatusModal ? (
        <ChangeBottleStatusModal
          bottle={bottle}
          onUpdate={updateBottle}
          onClose={() => setShowStatusModal(false)}
          onStatusChanged={(status) => {
            if (status === 'finished') setShowBottleKillCelebration(true)
          }}
        />
      ) : null}
    </>
  )
}
