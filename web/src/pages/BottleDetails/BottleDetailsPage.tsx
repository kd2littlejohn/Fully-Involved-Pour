import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Button } from '../../components/ui/Button'
import { SignInButton } from '../../components/domain/SignInButton'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { RarityBadge } from '../../components/ui/RarityBadge'
import { FillLevelBar } from '../../components/ui/FillLevelBar'
import { Tabs, TabPanel } from '../../components/ui/Tabs'
import { OverflowMenu, type OverflowMenuItem } from '../../components/ui/OverflowMenu'
import { ChangeBottleStatusModal } from '../../components/domain/ChangeBottleStatusModal'
import { FillLevelModal } from '../../components/domain/FillLevelModal'
import { useAuth } from '../../hooks/useAuth'
import { useUserData, type BottlePatch } from '../../hooks/useUserData'
import type { Bottle, BottleStatus } from '../../data/types'
import { bottleJourneyStage } from '../../features/collection/journeyStage'
import { needsReplacement } from '../../features/collection/inventoryFilters'
import {
  abvFromProof,
  currentScoreDate,
  distilleryLocation,
  fillLevelPercent,
  getCurrentScore,
  parseLocalDate,
  pourHistorySummary,
} from '../../features/bottleDetails/selectors'
import { useFipGuide } from '../../features/bottleDetails/useFipGuide'
import { splitBottleTitle } from '../../features/collection/bottleTitle'
import { currentBatch } from '../../features/infinityBottle/selectors'
import { BottleKillCelebration } from '../../features/bottleKill/BottleKillCelebration'
import { RecommendToFriendModal } from '../../features/friends/RecommendToFriendModal'
import { StartAPourButton } from '../../features/startAPour/StartAPourButton'
import { OverviewTab } from './tabs/OverviewTab'
import { YourTakeTab, type HistoryView } from './tabs/YourTakeTab'
import { FlavorProfileTab } from './tabs/FlavorProfileTab'
import { GuideTab } from './tabs/GuideTab'
import { BottlePhotoLightbox } from './BottlePhotoLightbox'
import styles from './BottleDetailsPage.module.css'
import { bottlePhotoUrl } from '../../features/photoUpload/bottlePhotoUrl'
import { useInventoryReturnPath } from '../../features/collection/inventoryViewState'

const STATUS_LABEL: Record<BottleStatus, string> = {
  open: 'Opened',
  sealed: 'Sealed',
  wishlist: 'Wishlist',
  finished: 'Finished',
  incoming: 'Incoming',
}

// A dedicated map rather than reusing fipTier/journeyStage colors — this dot
// is purely "what state is this bottle in," open being the one genuinely
// positive state worth calling out in green (see the FIP palette rule:
// green only for positive semantic states).
const STATUS_DOT_COLOR: Record<BottleStatus, string> = {
  open: 'var(--fip-success)',
  sealed: 'var(--fip-copper)',
  incoming: 'var(--fip-brass)',
  wishlist: 'var(--fip-brass)',
  finished: 'var(--fip-muted)',
}

// Where the bottle sits in the user's world, shown above its name.
const EYEBROW: Record<BottleStatus, string> = {
  open: 'My Collection',
  sealed: 'My Collection',
  finished: 'My Collection',
  incoming: 'Incoming',
  wishlist: 'Wishlist',
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'your-take', label: 'Your Take' },
  { id: 'flavor', label: 'Flavor Profile' },
  { id: 'guide', label: 'Guide' },
]

const TAB_IDS = new Set(TABS.map((t) => t.id))

// Tab ids other screens still link with (e.g. "Compare" from the pour
// chooser), mapped onto the tab that now holds that content.
const LEGACY_TABS: Record<string, { tab: string; history?: HistoryView }> = {
  compare: { tab: 'flavor' },
  journey: { tab: 'your-take', history: 'journey' },
  'pour-stories': { tab: 'your-take', history: 'pour-stories' },
  photos: { tab: 'overview' },
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

interface BottleDetailsLocationState {
  initialTab?: string
}

export function BottleDetailsPage() {
  const { bottleId } = useParams()
  // The user's last My Bar view (search, filters, sort, scroll) — never a
  // reset list. See features/collection/inventoryViewState.ts.
  const inventoryPath = useInventoryReturnPath()
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading } = useUserData()

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
          action={<LinkButton to={inventoryPath}>Back to My Bar</LinkButton>}
        />
      </>
    )
  }

  return <BottleDetailsContent bottle={bottle} inventoryPath={inventoryPath} />
}

function BottleDetailsContent({ bottle, inventoryPath }: { bottle: Bottle; inventoryPath: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { userDoc, updateBottle, deleteBottle } = useUserData()
  // One fetch, shared by the Availability card, Bottle Info, Flavor
  // Profile's reference profile and the Guide tab.
  const { state: guideState, guide } = useFipGuide(bottle)
  const [activeTab, setActiveTab] = useState('overview')
  const [historyView, setHistoryView] = useState<HistoryView>('journey')
  const [tabsEl, setTabsEl] = useState<HTMLDivElement | null>(null)

  // A plain useState initializer only runs on first mount, so it misses the
  // case where Comparison is chosen from *within* an already-mounted Bottle
  // Details page — same route, same component instance, just a fresh
  // navigate() with new state. location.key changes on every navigation
  // (even to the same path), so syncing off that catches both cases without
  // fighting the user's own manual tab clicks (which never touch location).
  useEffect(() => {
    const requestedTab = (location.state as BottleDetailsLocationState | null)?.initialTab
    if (!requestedTab) return
    if (TAB_IDS.has(requestedTab)) {
      setActiveTab(requestedTab)
      return
    }
    const legacy = LEGACY_TABS[requestedTab]
    if (legacy) {
      setActiveTab(legacy.tab)
      if (legacy.history) setHistoryView(legacy.history)
    }
  }, [location.key])
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showPhotoLightbox, setShowPhotoLightbox] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showFillLevelModal, setShowFillLevelModal] = useState(false)
  const [showBottleKillCelebration, setShowBottleKillCelebration] = useState(false)
  const [showRecommendModal, setShowRecommendModal] = useState(false)

  const journeyStage = bottleJourneyStage(bottle)
  const score = getCurrentScore(bottle, userDoc.pours)
  const scoreDate = currentScoreDate(bottle, userDoc.pours)
  const pourHistory = pourHistorySummary(bottle, userDoc.pours)
  const bottleLocation = distilleryLocation(bottle)
  const fillPercent = fillLevelPercent(bottle)
  const otherBottles = userDoc.bottles.filter((b) => b.id !== bottle.id)
  const { title, subtitle } = splitBottleTitle(bottle.name)
  const photoUrl = bottlePhotoUrl(bottle)
  // Same reasoning as the My Bar cards: status is ambiguous once there's
  // more than one physical bottle, so this pill stops being a status-
  // change trigger and becomes a plain summary — real per-instance status
  // changes happen in the "Your Bottles" section instead.
  const multiInstance = (bottle.instances?.length ?? 0) > 1

  // Proof, ABV and size: ABV is derived from proof at full precision; a
  // missing value shows as "—" (not recorded), never a guess.
  const specs = [
    { label: 'Proof', value: typeof bottle.proof === 'number' ? String(bottle.proof) : undefined },
    { label: 'ABV', value: abvFromProof(bottle.proof) },
    { label: 'Size', value: bottle.bottleSize ? `${bottle.bottleSize}ml` : undefined },
  ]

  const currentBottleId = bottle.id
  const currentFavorite = bottle.favorite
  const currentName = bottle.name
  const currentDistillery = bottle.distillery
  const currentType = bottle.type

  async function handleDelete() {
    setDeleting(true)
    await deleteBottle(currentBottleId)
    setDeleting(false)
    navigate(inventoryPath)
  }

  async function handleToggleFavorite() {
    await updateBottle(currentBottleId, { favorite: !currentFavorite })
  }

  const currentNeedsReplacement = needsReplacement(bottle)
  async function handleToggleReplacement() {
    await updateBottle(currentBottleId, { wouldReplace: currentNeedsReplacement ? undefined : 'yes' })
  }

  function handleReplaceBottle() {
    navigate('/bottles/new', {
      state: { prefill: { name: currentName, distillery: currentDistillery, type: currentType }, defaultStatus: 'sealed' },
    })
  }

  async function handleYourTakeUpdate(patch: BottlePatch) {
    await updateBottle(currentBottleId, patch)
  }

  function openTab(tab: string) {
    setActiveTab(tab)
    tabsEl?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  // Fill level is only meaningful for a single, currently-open bottle —
  // ambiguous once there's more than one physical copy (see the "Your
  // Bottles" section for per-instance fill level instead).
  const canUpdateFillLevel = bottle.status === 'open' && !multiInstance

  // Add to Blend reuses the Infinity Bottle flow: straight into the only
  // active blend with this bottle already selected, or the Infinity Bottle
  // home to pick one. Only open bottles can be poured into a blend.
  const activeBlends = userDoc.infinityBottles.filter((ib) => currentBatch(ib))
  const canAddToBlend = bottle.status === 'open'
  function handleAddToBlend() {
    if (activeBlends.length === 1) {
      navigate(`/collection/infinity/${activeBlends[0]!.id}/add`, { state: { preselectBottleId: currentBottleId } })
    } else {
      navigate('/collection/infinity')
    }
  }

  const menuItems: OverflowMenuItem[] = [
    { label: 'Edit Bottle', onClick: () => navigate(`/bottles/${bottle.id}/edit`) },
    ...(canUpdateFillLevel ? [{ label: 'Update Fill Level', onClick: () => setShowFillLevelModal(true) }] : []),
    { label: bottle.favorite ? 'Remove from Favorites' : 'Add to Favorites', onClick: () => void handleToggleFavorite() },
    {
      label: currentNeedsReplacement ? 'Remove from Replacement List' : 'Add to Replacement List',
      onClick: () => void handleToggleReplacement(),
    },
    { label: 'Recommend to Friend', onClick: () => setShowRecommendModal(true) },
    { label: 'Replace Bottle', onClick: handleReplaceBottle },
    { label: 'Delete Bottle', onClick: () => setConfirmingDelete(true), tone: 'danger' },
  ]

  // Compact facts: each one only when it's real user data (or, for
  // availability, the FIP Guide's reference phrase, labelled as such).
  // Purchase date is never filled in from the date the bottle was added.
  const infoCards: { key: string; icon: ReactNode; value: string; label: string; meter?: number; onClick?: () => void }[] = []
  if (multiInstance) {
    infoCards.push({ key: 'bottles', icon: ICONS.bottle, value: `${bottle.instances!.length} bottles`, label: 'In Your Bar' })
  } else if (bottle.status === 'open') {
    infoCards.push({
      key: 'fill',
      icon: ICONS.bottle,
      value: fillPercent != null ? `${fillPercent}%` : 'Not set',
      label: 'Fill Level',
      meter: fillPercent ?? undefined,
      onClick: () => setShowFillLevelModal(true),
    })
  }
  if (bottle.purchaseDate) {
    infoCards.push({ key: 'purchased', icon: ICONS.calendar, value: dateFormatter.format(parseLocalDate(bottle.purchaseDate)), label: 'Purchased' })
  }
  if (guide?.availability) {
    infoCards.push({ key: 'availability', icon: ICONS.pin, value: guide.availability, label: 'Per FIP Guide' })
  } else if (subtitle) {
    infoCards.push({ key: 'batch', icon: ICONS.pin, value: subtitle, label: 'Batch / Release' })
  }
  if (bottle.type) {
    infoCards.push({ key: 'type', icon: ICONS.layers, value: bottle.type, label: 'Type' })
  }

  return (
    <>
      <div className={styles.stage}>
        {photoUrl ? <img className={styles.atmosphere} src={photoUrl} alt="" aria-hidden="true" /> : null}

        <div className={styles.topRow}>
          <Link to={inventoryPath} className={styles.back} aria-label="Back to My Bar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            My Bar
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
            <div className={styles.topActions}>
              <button
                type="button"
                className={currentFavorite ? `${styles.iconButton} ${styles.iconButtonActive}` : styles.iconButton}
                onClick={() => void handleToggleFavorite()}
                aria-pressed={Boolean(currentFavorite)}
                aria-label="Favorite"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill={currentFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M12 20.5l-1.3-1.2C5.6 14.7 2.5 11.9 2.5 8.4 2.5 5.6 4.7 3.5 7.4 3.5c1.6 0 3.1.7 4.1 1.9 1-1.2 2.5-1.9 4.1-1.9 2.7 0 4.9 2.1 4.9 4.9 0 3.5-3.1 6.3-8.2 10.9L12 20.5z" strokeLinejoin="round" />
                </svg>
              </button>
              <OverflowMenu items={menuItems} label="Bottle actions" />
            </div>
          )}
        </div>

        <div className={styles.hero}>
          <button type="button" className={styles.photoButton} onClick={() => setShowPhotoLightbox(true)} aria-label="View photo">
            {photoUrl ? (
              <img className={styles.photo} src={photoUrl} alt="" />
            ) : (
              <span className={styles.photoPlaceholder}>
                <BottlePlaceholder name={bottle.name} />
              </span>
            )}
          </button>

          <div className={styles.info}>
            <p className={styles.eyebrow}>{EYEBROW[bottle.status]}</p>
            <h1 className={styles.name}>
              {title}
              {subtitle ? (
                <>
                  {' '}
                  <span className={styles.batch}>{subtitle}</span>
                </>
              ) : null}
            </h1>
            {bottle.distillery || bottleLocation ? (
              <div className={styles.distillery}>
                {bottle.distillery}
                {bottle.distillery && bottleLocation ? ' · ' : ''}
                {bottleLocation}
              </div>
            ) : null}

            <div className={styles.badges}>
              {multiInstance ? (
                <span className={styles.statusPill}>
                  <span className={styles.statusDot} style={{ background: STATUS_DOT_COLOR[bottle.status] }} aria-hidden="true" />
                  {bottle.instances!.length} bottles
                </span>
              ) : (
                <button type="button" className={styles.statusPill} onClick={() => setShowStatusModal(true)}>
                  <span className={styles.statusDot} style={{ background: STATUS_DOT_COLOR[bottle.status] }} aria-hidden="true" />
                  {STATUS_LABEL[bottle.status]}
                </button>
              )}
              <RarityBadge bottle={bottle} />
              {journeyStage ? (
                <span className={styles.journey} style={{ color: journeyStage.color }}>
                  <span className={styles.journeyDot} style={{ background: journeyStage.color }} aria-hidden="true" />
                  {journeyStage.label}
                </span>
              ) : null}
            </div>

            <dl className={styles.specs}>
              {specs.map((spec) => (
                <div key={spec.label} className={styles.spec}>
                  <dd className={spec.value ? styles.specValue : `${styles.specValue} ${styles.specMissing}`}>
                    {spec.value ?? (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className={styles.srOnly}>Not recorded</span>
                      </>
                    )}
                  </dd>
                  <dt className={styles.specLabel}>{spec.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <StartAPourButton bottleId={bottle.id} label="Start a Pour" className={styles.primaryAction} />
        <div className={styles.secondaryActions}>
          <Button variant="secondary" className={styles.secondaryAction} onClick={() => navigate(`/bottles/${bottle.id}/edit`)}>
            {ICONS.edit}
            Edit Bottle
          </Button>
          <Button variant="secondary" className={styles.secondaryAction} onClick={() => openTab('your-take')}>
            {ICONS.chart}
            View History
          </Button>
          {canAddToBlend ? (
            <Button variant="secondary" className={styles.secondaryAction} onClick={handleAddToBlend}>
              {ICONS.blend}
              Add to Blend
            </Button>
          ) : null}
        </div>
      </div>

      {infoCards.length > 0 ? (
        <div className={styles.infoCards} style={{ '--info-cols': infoCards.length } as CSSProperties}>
          {infoCards.map((card) => {
            const content = (
              <>
                <span className={styles.infoIcon}>{card.icon}</span>
                <span className={styles.infoValue}>{card.value}</span>
                <span className={styles.infoLabel}>{card.label}</span>
                {typeof card.meter === 'number' ? <FillLevelBar percent={card.meter} /> : null}
              </>
            )
            return card.onClick ? (
              <button key={card.key} type="button" className={`${styles.infoCard} ${styles.infoCardButton}`} onClick={card.onClick}>
                {content}
              </button>
            ) : (
              <div key={card.key} className={styles.infoCard}>
                {content}
              </div>
            )
          })}
        </div>
      ) : null}

      <div ref={setTabsEl} className={styles.tabs}>
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      <TabPanel>
        {activeTab === 'overview' ? (
          <OverviewTab
            bottle={bottle}
            pours={userDoc.pours}
            guide={guide}
            score={score}
            pourCount={pourHistory.pourCount}
            onOpenYourTake={() => openTab('your-take')}
          />
        ) : null}
        {activeTab === 'your-take' ? (
          <YourTakeTab
            bottle={bottle}
            pours={userDoc.pours}
            memories={userDoc.memories}
            score={score}
            scoreDate={scoreDate}
            pourHistory={pourHistory}
            onUpdate={handleYourTakeUpdate}
            history={historyView}
            onHistoryChange={setHistoryView}
          />
        ) : null}
        {activeTab === 'flavor' ? (
          <FlavorProfileTab bottle={bottle} pours={userDoc.pours} otherBottles={otherBottles} guideState={guideState} guide={guide} />
        ) : null}
        {activeTab === 'guide' ? <GuideTab state={guideState} guide={guide} /> : null}
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

      {showFillLevelModal ? (
        <FillLevelModal bottle={bottle} onUpdate={updateBottle} onClose={() => setShowFillLevelModal(false)} />
      ) : null}
    </>
  )
}

const ICON_PROPS = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true } as const

const ICONS = {
  bottle: (
    <svg {...ICON_PROPS}>
      <path d="M10 2h4v4l1.5 2.5V21a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V8.5L10 6V2z" strokeLinejoin="round" />
    </svg>
  ),
  calendar: (
    <svg {...ICON_PROPS}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  ),
  pin: (
    <svg {...ICON_PROPS}>
      <path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  ),
  layers: (
    <svg {...ICON_PROPS}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" strokeLinejoin="round" />
    </svg>
  ),
  edit: (
    <svg {...ICON_PROPS}>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" strokeLinejoin="round" />
    </svg>
  ),
  chart: (
    <svg {...ICON_PROPS}>
      <path d="M6 20V11M12 20V4M18 20v-6" strokeLinecap="round" />
    </svg>
  ),
  blend: (
    <svg {...ICON_PROPS}>
      <path d="M4 6h10M4 12h7M4 18h6" strokeLinecap="round" />
      <circle cx="17" cy="15" r="3.5" />
      <path d="M17 13.5v3M15.5 15h3" strokeLinecap="round" />
    </svg>
  ),
}
